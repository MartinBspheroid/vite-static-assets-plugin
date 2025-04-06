import type { Plugin } from "vite";
import * as fs from "node:fs";
import * as path from "node:path";
import { normalizePath } from "vite";
import { minimatch } from "minimatch";
import chalk from "chalk";
import chokidar from "chokidar";

type updateTypeScriptFileEvent = "add" | "unlink" | "change";

interface StaticAssetsPluginOptions {
  /**
   * Directory to scan for static assets
   * @default "public"
   */
  directory?: string;
  /**
   * Output file for the generated type definitions
   * @default "src/static-assets.ts"
   */
  outputFile?: string;
  /**
   * Array of glob patterns to ignore
   * 
   * note: docs are using special characters to prevent them from 
   * breaking the code (e.g. ✲✲ instead of **)
   * @default [✲✲/.DS_Store]
   * 
   */
  ignore?: string[];

  /**
   * Debounce time in milliseconds for file system events
   * This is used to avoid too many rebuilds when files are changed rapidly
   * @default 200
   */
  debounce?: number;

  /**
   * Enable generation of directory types and helper functions
   * @default true
   */
  enableDirectoryTypes?: boolean;

  /**
   * Maximum directory nesting level for type generation
   * @default 5
   */
  maxDirectoryDepth?: number;

  /**
   * Whether to allow referencing empty directories
   * @default false
   */
  allowEmptyDirectories?: boolean;

  /**
   * Whether asset URLs should have a leading slash
   * @default true
   */
  addLeadingSlash?: boolean;
}

/**
 * Asynchronously scan a directory and return all file paths
 */
async function getAllFiles(
  dir: string,
  baseDir: string,
  ignorePatterns: string[] = []
): Promise<string[]> {

  try {
    const items = await fs.promises.readdir(dir);

    // Process each item in parallel using Promise.all
    const itemPromises = items.map(async (item) => {
      try {
        const fullPath = path.join(dir, item);
        const relativePath = normalizePath(path.relative(baseDir, fullPath));

        // Check if the file/directory should be ignored
        const shouldIgnore = ignorePatterns.some((pattern) =>
          minimatch(relativePath, pattern, { dot: true })
        );

        if (shouldIgnore) {
          return [];
        }

        const stat = await fs.promises.stat(fullPath);

        if (stat.isDirectory()) {
          // Recursively get files from subdirectory
          const subFiles = await getAllFiles(fullPath, baseDir, ignorePatterns);
          return subFiles;
        }
          return [relativePath];
        
      } catch (err) {
        console.warn(
          `${chalk.yellow("⚠")} Error processing file ${item}: ${err}`
        );
        return []; // Continue with other files instead of breaking completely
      }
    });

    // Wait for all item promises to resolve and flatten the results
    const nestedResults = await Promise.all(itemPromises);
    return nestedResults.flat();
  } catch (err) {
    console.error(`${chalk.red("✗")} Error reading directory ${dir}: ${err}`);
    return []; // Return empty array on directory read failure
  }
}

function extractDirectories(
  files: string[],
  maxDepth = 5
): Set<string> {
  const directories = new Set<string>();

  for (const file of files) {
    const dirPath = path.posix.dirname(file);
    if (dirPath === ".") continue;

    const parts = dirPath.split("/");
    let currentPath = "";

    for (let i = 0; i < Math.min(parts.length, maxDepth); i++) {
      if (parts[i] === "") continue;
      currentPath += `${parts[i]}/`;
      directories.add(currentPath);
    }
  }

  return directories;
}

function generateTypeScriptCode(
  files: string[],
  directory: string,
  basePath= "/",
  options: StaticAssetsPluginOptions = {}
) {
  const {
    enableDirectoryTypes = true,
    maxDirectoryDepth = 5,
  } = options;

  const fileList =
    files.length > 0
      ? files.map((file) => `  '${file}'`).join(" |\n")
      : "  never";

  let directoryTypesCode = "";
  let directoryFunctionsCode = "";

  if (enableDirectoryTypes) {
    const directories = extractDirectories(files, maxDirectoryDepth);

    if (directories.size > 0) {
      const directoryList = Array.from(directories)
        .map((dir) => `  '${dir}'`)
        .join(" |\n");

      directoryTypesCode = `
export type StaticAssetDirectory = 
${directoryList};`;

      directoryFunctionsCode = `

      /**
       * Gets all asset paths from a specific directory
       * @param dirPath Directory path
       * @returns Array of all asset paths in the directory
       */
      function normalizePath(p: string): string {
        // Replace backslashes with slashes
        p = p.replace(/\\\\/g, '/');
        // Remove duplicate slashes
        p = p.replace(/\\/+/g, '/');
        // Remove leading './'
        p = p.replace(/^\\.\\/+/g, '');
        // Resolve trailing slash
        return p.endsWith('/') ? p : p + '/';
      }
      
      export function staticAssetsFromDir(dirPath: StaticAssetDirectory): string[] {
        const normalizedDir = normalizePath(dirPath);
      
        return Array.from(assets)
          .filter(path => path.startsWith(normalizedDir))
          .map(path => '/' + path);
      }
      
`;
    }
  }

  return `// This file is auto-generated. Do not edit it manually.


export type StaticAssetPath = 
${fileList};${directoryTypesCode}

const assets = new Set<string>([
${files.map((file) => `  '${file}'`).join(",\n")}
]);

const BASE_PATH = ${JSON.stringify(basePath)};

/**
 * Gets the URL for a specific static asset
 * @param path Path to the asset
 * @returns The URL for the asset
 */
export function staticAssets(path: StaticAssetPath): string {
  if (!assets.has(path)) {
    throw new Error(\`Static asset "\${path}" does not exist in ${directory} directory\`);
  }
  return \`\${BASE_PATH}\${path}\`;
}${directoryFunctionsCode}
`;
}

// Export these functions for testing purposes
export { getAllFiles, generateTypeScriptCode };

export default function staticAssetsPlugin(
  options: StaticAssetsPluginOptions = {}
): Plugin {
  const directory = path.resolve(process.cwd(), options.directory || "public");
  const outputFile = path.resolve(
    process.cwd(),
    options.outputFile || "src/static-assets.ts"
  );
  const ignorePatterns = options.ignore || ["**/.DS_Store"];

  // Create parent directories and ensure output file placeholder exists
  const ensureOutputFile = async () => {
    const outputDir = path.dirname(outputFile);
    try {
      // Check if directory exists, create if not
      await fs.promises.mkdir(outputDir, { recursive: true });

      // Check if file exists, create empty file if not
      try {
        await fs.promises.access(outputFile);
      } catch {
        // File doesn't exist, create it
        await fs.promises.writeFile(outputFile, "");
      }
    } catch (err) {
      throw new Error(
        `Failed to create necessary directories or files: ${err}`
      );
    }
  };

  // Initialize during module evaluation
  ensureOutputFile().catch((err) => {
    console.error(`${chalk.red("✗")} Initial setup error: ${err}`);
  });

  let watcher: chokidar.FSWatcher | null = null;
  let currentFiles: Set<string> = new Set();
  let basePath = "/"; // Default to root

  return {
    name: "vite-plugin-static-assets",

    configResolved(resolvedConfig) {
      // Get the base path from Vite's config
      basePath = resolvedConfig.base || "/";
    },

    async buildStart() {
      try {
        const fullDir = path.resolve(directory);

        // Ensure directory exists
        try {
          await fs.promises.access(fullDir);
        } catch {
          throw new Error(`Directory "${directory}" does not exist`);
        }

        // Generate initial file
        const files = await getAllFiles(fullDir, fullDir, ignorePatterns);
        currentFiles = new Set(files);
        const code = generateTypeScriptCode(
          files,
          directory,
          basePath,
          options
        );

        // Ensure output directory exists and write file
        await ensureOutputFile();
        await fs.promises.writeFile(outputFile, code);
        console.log(
          `${chalk.green(
            "✓"
          )} Generated static assets type definitions at ${chalk.blue(
            outputFile
          )}`
        );

        // Setup watcher in dev mode
        if (process.env.NODE_ENV !== "production" && !watcher) {
          try {
            watcher = chokidar.watch(fullDir, {
              ignored: ignorePatterns.map((pattern) =>
                path.join(fullDir, pattern)
              ),
              ignoreInitial: true,
              persistent: true,
            });

            // Debounce function to avoid too many rebuilds
            let debounceTimer: NodeJS.Timeout | null = null;

            const updateTypeScriptFile = async (
              eventType: updateTypeScriptFileEvent
            ) => {
              try {
                const updatedFiles = await getAllFiles(
                  fullDir,
                  fullDir,
                  ignorePatterns
                );
                currentFiles = new Set(updatedFiles);
                const updatedCode = generateTypeScriptCode(
                  updatedFiles,
                  directory,
                  basePath,
                  options
                );
                await fs.promises.writeFile(outputFile, updatedCode);
                console.log(
                  `${chalk.green(
                    "✓"
                  )} Updated static assets type definitions (${eventType}).`
                );
              } catch (err) {
                console.error(
                  `${chalk.red("✗")} Error updating static assets: ${err}`
                );
              }
            };

            // Set up event handlers for all relevant file system events
            watcher
              .on("add", () => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(
                  () => updateTypeScriptFile("add"),
                  options.debounce || 200
                );
              })
              .on("unlink", () => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(
                  () => updateTypeScriptFile("unlink"),
                  options.debounce || 200
                );
              })
              .on("change", () => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(
                  () => updateTypeScriptFile("change"),
                  options.debounce || 200
                );
              })
              .on("error", (error) => {
                console.error(`${chalk.red("✗")} Watcher error: ${error}`);
              });
          } catch (err) {
            console.error(
              `${chalk.red("✗")} Error setting up file watcher: ${err}`
            );
            // Don't re-throw here since watcher is non-critical for the build
          }
        }
      } catch (err) {
        // For critical errors, we want to halt the build process
        console.error(`${chalk.red("✗")} Static assets plugin error: ${err}`);
        throw err; // Re-throw to halt the build process for critical errors
      }
    },

    transform(code: string, id: string) {
      try {
        // Only process JSX/TSX/JS/TS/vue/svelte files
        if (!id.match(/\.(jsx?|tsx?|js|ts|vue|svelte)$/)) {
          return null;
        }

        // Look for staticAssets calls
        const staticAssetsRegex = /staticAssets\(['"]([^'"]+)['"]\)/g;
        let match: RegExpExecArray | null = staticAssetsRegex.exec(code);

        while (match !== null) {
          const assetPath = match[1];
          if (!currentFiles.has(assetPath)) {
            throw new Error(
              `

Static asset: ${chalk.yellowBright(assetPath)} 
 (referenced in ${chalk.yellow(id)}) 
 does not exist in ${chalk.yellow(directory)} directory.

Make sure the asset exists and is referenced correctly in your code.

`
            );
          }
          match = staticAssetsRegex.exec(code);
        }

        // Skip directory validation if disabled
        if (options.enableDirectoryTypes === false) {
          return null;
        }

        const staticAssetsDirRegex = /staticAssetsFromDir\(['"]([^'"]+)['"]\)/g;
        let dirMatch: RegExpExecArray | null = staticAssetsDirRegex.exec(code);

        while (dirMatch !== null) {
          const dirPath = dirMatch[1];
          const normalizedPath = path.posix.normalize(dirPath);
          const dirPathWithSlash = normalizedPath.endsWith("/")
            ? normalizedPath
            : `${normalizedPath}/`;

          const hasAssetsInDir = Array.from(currentFiles).some((file) =>
            file.startsWith(dirPathWithSlash)
          );

          if (!hasAssetsInDir && !options.allowEmptyDirectories) {
            const message =
              `\n\nStatic asset directory: ${chalk.yellowBright(
                dirPathWithSlash
              )} \n (referenced in ${chalk.yellow(
                id
              )})\n does not exist or is empty in ${chalk.yellow(
                directory
              )} directory.\n\nMake sure the directory exists and contains assets.\n\n`;

            throw new Error(message);
          }
          dirMatch = staticAssetsDirRegex.exec(code);
        }

        return null;
      } catch (err) {
        // Only re-throw errors we've created (with specific error messages)
        // This prevents unexpected errors from breaking the build completely
        if (
          err instanceof Error &&
          (err.message.includes("Static asset:") ||
            err.message.includes("Static asset directory:"))
        ) {
          throw err;
        }

        // For unexpected errors, log and continue
        console.error(
          `${chalk.red("✗")} Error validating asset references in ${id}: ${err}`
        );
        return null;
      }
    },

    async buildEnd() {
      if (watcher) {
        try {
          await new Promise<void>((resolve) => {
            watcher
              ?.close()
              .then(() => {
                console.log(`${chalk.yellow("⚠")} File watcher closed.`);
                resolve();
              })
              .catch((err) => {
                console.error(
                  `${chalk.red("✗")} Error closing file watcher: ${err}`
                );
                resolve(); // Still resolve to continue shutdown
              });
          });
        } finally {
          watcher = null;
        }
      }
    },
  } as Plugin;
}

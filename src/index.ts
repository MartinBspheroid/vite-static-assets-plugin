import type { Plugin } from 'vite';
import * as fs from 'fs';
import * as path from 'path';
import { normalizePath } from 'vite';
import { minimatch } from 'minimatch';
import chalk from 'chalk';
import chokidar from 'chokidar';


type updateTypeScriptFileEvent = 'add' | 'unlink' | 'change';

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
   * @default [".DS_Store"]
   */
  ignore?: string[];  

  /**
   * Debounce time in milliseconds for file system events
   * This is used to avoid too many rebuilds when files are changed rapidly 
   * @default: 200
   */
  debounce?: number; 
}

/**
 * Asynchronously scan a directory and return all file paths
 */
async function getAllFiles(dir: string, baseDir: string, ignorePatterns: string[] = []): Promise<string[]> {
  const files: string[] = [];
  
  try {
    const items = await fs.promises.readdir(dir);
    
    // Process each item in parallel using Promise.all
    const itemPromises = items.map(async (item) => {
      try {
        const fullPath = path.join(dir, item);
        const relativePath = normalizePath(path.relative(baseDir, fullPath));
        
        // Check if the file/directory should be ignored
        const shouldIgnore = ignorePatterns.some(pattern => 
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
        } else {
          return [relativePath];
        }
      } catch (err) {
        console.warn(`${chalk.yellow('⚠')} Error processing file ${item}: ${err}`);
        return []; // Continue with other files instead of breaking completely
      }
    });
    
    // Wait for all item promises to resolve and flatten the results
    const nestedResults = await Promise.all(itemPromises);
    return nestedResults.flat();
  } catch (err) {
    console.error(`${chalk.red('✗')} Error reading directory ${dir}: ${err}`);
    return []; // Return empty array on directory read failure
  }
}

function generateTypeScriptCode(files: string[], directory: string, basePath: string = '/'): string {
  const fileList = files.length > 0 
    ? files.map(file => `  '${file}'`).join(' |\n')
    : '  never';  // Handle case when no files are found
  
  return `// This file is auto-generated. Do not edit it manually.

export type StaticAssetPath = 
${fileList};

const assets = new Set<string>([
${files.map(file => `  '${file}'`).join(',\n')}
]);
const BASE_PATH = ${JSON.stringify(basePath)};
/**
 * 
 * @param path path to the asset 
 * @returns  the URL for the asset
 * 
 * Function provided by the plugin to get the URL for a static asset
 * 
 * Makes it easier to use the assets in the code without having to remember the path
 * 
 * Also provides a type safety for the asset path and the URL returned 
 * * @example 
 * <img src={staticAssets('logo.svg')} alt="logo">
 * 
 * 
 *  */
export function staticAssets(path: StaticAssetPath): string {
  if (!assets.has(path)) {
    throw new Error(\`Static asset "\${path}" does not exist in ${directory} directory\`);
  }
  return BASE_PATH + path;
}
`;
}

// Export these functions for testing purposes
export { getAllFiles, generateTypeScriptCode };

export default function staticAssetsPlugin(options: StaticAssetsPluginOptions = {}): Plugin {
  const directory = path.resolve(process.cwd(), options.directory || 'public');
  const outputFile = path.resolve(process.cwd(), options.outputFile || 'src/static-assets.ts');
  const ignorePatterns = options.ignore || ['.DS_Store'];
  
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
        await fs.promises.writeFile(outputFile, '');
      }
    } catch (err) {
      throw new Error(`Failed to create necessary directories or files: ${err}`);
    }
  };
  
  // Initialize during module evaluation
  ensureOutputFile().catch(err => {
    console.error(`${chalk.red('✗')} Initial setup error: ${err}`);
  });
  
  let watcher: chokidar.FSWatcher | null = null;
  let currentFiles: Set<string> = new Set();
  let basePath = '/'; // Default to root
  
  return {
    name: 'vite-plugin-static-assets',
    
    configResolved(resolvedConfig) {
      // Get the base path from Vite's config
      basePath = resolvedConfig.base || '/';
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
        const code = generateTypeScriptCode(files, directory, basePath);
        
        // Ensure output directory exists and write file
        await ensureOutputFile();
        await fs.promises.writeFile(outputFile, code);
        console.log(`${chalk.green('✓')} Generated static assets type definitions at ${chalk.blue(outputFile)}`);
        
        // Setup watcher in dev mode
        if (process.env.NODE_ENV !== 'production' && !watcher) {
          try {
            watcher = chokidar.watch(fullDir, {
              ignored: ignorePatterns.map(pattern => path.join(fullDir, pattern)),
              ignoreInitial: true,
              persistent: true
            });

            // Debounce function to avoid too many rebuilds
            let debounceTimer: NodeJS.Timeout | null = null;

            const updateTypeScriptFile = async (eventType: updateTypeScriptFileEvent) => {
              try {
                const updatedFiles = await getAllFiles(fullDir, fullDir, ignorePatterns);
                currentFiles = new Set(updatedFiles);
                const updatedCode = generateTypeScriptCode(updatedFiles, directory, basePath);
                await fs.promises.writeFile(outputFile, updatedCode);
                console.log(`${chalk.green('✓')} Updated static assets type definitions (${eventType}).`);
              } catch (err) {
                console.error(`${chalk.red('✗')} Error updating static assets: ${err}`);
              }
            };

            // Set up event handlers for all relevant file system events
            watcher
              .on('add', () => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => updateTypeScriptFile("add"), options.debounce || 200);
              })
              .on('unlink', () => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => updateTypeScriptFile('unlink'), options.debounce || 200);
              })
              .on('change', () => {
                if (debounceTimer) clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => updateTypeScriptFile('change'), options.debounce || 200);
              })
              .on('error', (error) => {
                console.error(`${chalk.red('✗')} Watcher error: ${error}`);
              });
          } catch (err) {
            console.error(`${chalk.red('✗')} Error setting up file watcher: ${err}`);
            // Don't re-throw here since watcher is non-critical for the build
          }
        }
      } catch (err) {
        // For critical errors, we want to halt the build process
        console.error(`${chalk.red('✗')} Static assets plugin error: ${err}`);
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
      let match;
      
      while ((match = staticAssetsRegex.exec(code)) !== null) {
        const assetPath = match[1];
        if (!currentFiles.has(assetPath)) {
          throw new Error(
            `\n\nStatic asset: ${chalk.yellowBright(assetPath)} \n (referenced in ${chalk.yellow(id)})\n does not exist in ${chalk.yellow(directory)} directory.\n\n` +
            `Make sure the asset exists and is referenced correctly in your code.\n\n` +
            ``
          );
        }
      }
      
      return null;
      } catch (err) {
        // Only re-throw errors we've created (with specific error messages)
        // This prevents unexpected errors from breaking the build completely
        if (err instanceof Error && err.message.includes('Static asset:')) {
          throw err;
        }
        
        // For unexpected errors, log and continue
        console.error(`${chalk.red('✗')} Error validating asset references in ${id}: ${err}`);
        return null;
      }
    },
    
    async buildEnd() {
      if (watcher) {
        try {
          await new Promise<void>((resolve) => {
            watcher?.close()
              .then(() => {
                console.log(`${chalk.yellow('⚠')} File watcher closed.`);
                resolve();
              })
              .catch((err) => {
                console.error(`${chalk.red('✗')} Error closing file watcher: ${err}`);
                resolve(); // Still resolve to continue shutdown
              });
          });
        } finally {
          watcher = null;
        }
      }
    },
  } as Plugin
}
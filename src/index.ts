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

function getAllFiles(dir: string, baseDir: string, ignorePatterns: string[] = []): string[] {
  const files: string[] = [];
  
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const relativePath = normalizePath(path.relative(baseDir, fullPath));
    
    // Check if the file/directory should be ignored
    const shouldIgnore = ignorePatterns.some(pattern => 
      minimatch(relativePath, pattern, { dot: true })
    );
    
    if (shouldIgnore) {
      continue;
    }
    
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      files.push(...getAllFiles(fullPath, baseDir, ignorePatterns));
    } else {
      files.push(relativePath);
    }
  }
  
  return files;
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

export default function staticAssetsPlugin(options: StaticAssetsPluginOptions = {}): Plugin {
  const directory = path.resolve(process.cwd(), options.directory || 'public');
  const outputFile = path.resolve(process.cwd(), options.outputFile || 'src/static-assets.ts');
  const ignorePatterns = options.ignore || ['.DS_Store'];
  
  // ensure output file exists 
  if (!fs.existsSync(outputFile)) {
    fs.writeFileSync(outputFile, '');
  }
  
  let watcher: chokidar.FSWatcher | null = null;
  let currentFiles: Set<string> = new Set();
  let basePath = '/'; // Default to root
  
  return {
    name: 'vite-plugin-static-assets',
    
    configResolved(resolvedConfig) {
      // Get the base path from Vite's config
      basePath = resolvedConfig.base || '/';
    },
    
    buildStart() {
      const fullDir = path.resolve(directory);
      
      // Ensure directory exists
      if (!fs.existsSync(fullDir)) {
        throw new Error(`Directory "${directory}" does not exist`);
      }
      
      // Generate initial file
      const files = getAllFiles(fullDir, fullDir, ignorePatterns);
      currentFiles = new Set(files);
      const code = generateTypeScriptCode(files, directory, basePath);
      
      // Ensure output directory exists
      const outputDir = path.dirname(outputFile);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      fs.writeFileSync(outputFile, code);
      
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

          const updateTypeScriptFile = (eventType : updateTypeScriptFileEvent) => {
            try {
              const updatedFiles = getAllFiles(fullDir, fullDir, ignorePatterns);
              currentFiles = new Set(updatedFiles);
              const updatedCode = generateTypeScriptCode(updatedFiles, directory, basePath);
              fs.writeFileSync(outputFile, updatedCode);
              console.log(`${chalk.green('✓')} Updated static assets type definitions.`);
            } catch (err) {
              console.error(`${chalk.red('✗')} Error updating static assets: ${err}`);
            }
          };

          // Set up event handlers for all relevant file system events
          watcher
            .on('add', () => {
              if (debounceTimer) clearTimeout(debounceTimer);
              debounceTimer = setTimeout(()=> updateTypeScriptFile("add"), options.debounce || 200);
            })
            .on('unlink', () => {
              if (debounceTimer) clearTimeout(debounceTimer);
              debounceTimer = setTimeout(()=> updateTypeScriptFile('unlink'), options.debounce || 200);
            })
            .on('change', () => {
              if (debounceTimer) clearTimeout(debounceTimer);
              debounceTimer = setTimeout(()=> updateTypeScriptFile('change'), options.debounce || 200);
            })
            .on('error', (error) => {
              console.error(`${chalk.red('✗')} Watcher error: ${error}`);
            });
        } catch (err) {
          console.error(`${chalk.red('✗')} Error setting up file watcher: ${err}`);
        }
      }
    },

    transform(code: string, id: string) {
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
    },
    
    buildEnd() {
      if (watcher) {
        try {
          watcher.close();
          console.log(`${chalk.yellow('⚠')} File watcher closed.`);
        } catch (err) {
          console.error(`${chalk.red('✗')} Error closing file watcher: ${err}`);
        } finally {
          watcher = null;
        }
      }
    },
  } as Plugin
}
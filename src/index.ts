import type { Plugin } from 'vite';
import * as fs from 'fs';
import * as path from 'path';
import { normalizePath } from 'vite';
import { minimatch } from 'minimatch';
import chalk from 'chalk';

interface StaticAssetsPluginOptions {
  directory?: string;
  outputFile?: string;
  ignore?: string[];  // Array of glob patterns to ignore
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
  const ignorePatterns = options.ignore || [];
  
  // ensure output file exists 
  if (!fs.existsSync(outputFile)) {
    fs.writeFileSync(outputFile, '');
  }
  
  let watcher: fs.FSWatcher | null = null;
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
        watcher = fs.watch(fullDir, { recursive: true }, () => {
          const updatedFiles = getAllFiles(fullDir, fullDir, ignorePatterns);
          currentFiles = new Set(updatedFiles);
          const updatedCode = generateTypeScriptCode(updatedFiles, directory, basePath);
          fs.writeFileSync(outputFile, updatedCode);
        });
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
        watcher.close();
        watcher = null;
      }
    },
  };
}
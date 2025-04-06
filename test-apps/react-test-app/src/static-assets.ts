// This file is auto-generated. Do not edit it manually.


export type StaticAssetPath = 
  'icons/line-md--alert-circle2.svg' |
  'icons/line-md--chevron-small-triple-down.svg' |
  'icons/line-md--compass-filled-loop.svg' |
  'icons/line-md--download-off-outline.svg' |
  'icons/sun/line-md--sun-rising-filled-loop.svg' |
  'icons/sun/line-md--sun-rising-loop.svg' |
  'icons/sun/line-md--sun-rising-twotone-loop.svg' |
  'icons/sun/line-md--sunny-filled-loop.svg' |
  'icons/sun/line-md--sunny-filled.svg' |
  'icons/sun/line-md--sunny.svg' |
  'logo.png' |
  'vite.svg';
export type StaticAssetDirectory = 
  'icons/' |
  'icons/sun/';

const assets = new Set<string>([
  'icons/line-md--alert-circle2.svg',
  'icons/line-md--chevron-small-triple-down.svg',
  'icons/line-md--compass-filled-loop.svg',
  'icons/line-md--download-off-outline.svg',
  'icons/sun/line-md--sun-rising-filled-loop.svg',
  'icons/sun/line-md--sun-rising-loop.svg',
  'icons/sun/line-md--sun-rising-twotone-loop.svg',
  'icons/sun/line-md--sunny-filled-loop.svg',
  'icons/sun/line-md--sunny-filled.svg',
  'icons/sun/line-md--sunny.svg',
  'logo.png',
  'vite.svg'
]);

const BASE_PATH = "/";

/**
 * Gets the URL for a specific static asset
 * @param path Path to the asset
 * @returns The URL for the asset
 */
export function staticAssets(path: StaticAssetPath): string {
  if (!assets.has(path)) {
    throw new Error(`Static asset "${path}" does not exist in /Users/martinblasko/Code/playground/vite-static-assets-plugin/test-apps/react-test-app/public directory`);
  }
  return `${BASE_PATH}${path}`;
}

      /**
       * Gets all asset paths from a specific directory
       * @param dirPath Directory path
       * @returns Array of all asset paths in the directory
       */
      function normalizePath(p: string): string {
        // Replace backslashes with slashes
        p = p.replace(/\\/g, '/');
        // Remove duplicate slashes
        p = p.replace(/\/+/g, '/');
        // Remove leading './'
        p = p.replace(/^\.\/+/g, '');
        // Resolve trailing slash
        return p.endsWith('/') ? p : p + '/';
      }
      
      export function staticAssetsFromDir(dirPath: StaticAssetDirectory): string[] {
        const normalizedDir = normalizePath(dirPath);
      
        return Array.from(assets)
          .filter(path => path.startsWith(normalizedDir))
          .map(path => '/' + path);
      }
      


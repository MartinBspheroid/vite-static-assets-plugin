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

/**
 * Represents the known directories containing static assets.
 * '.' represents the root directory.
 */
export type StaticAssetDirectory =
  '.' |
  'icons/' |
  'icons/sun/';

/**
 * Represents the relative paths of files located *directly* within a specific directory.
 * Use '.' for the root directory.
 * @template Dir - A directory path string literal type from StaticAssetDirectory (e.g., 'icons/', 'icons/sun/', '.').
 */
export type FilesInFolder<Dir extends '.' | StaticAssetDirectory> = 
  Dir extends '.'
    ? Exclude<StaticAssetPath, `${string}/${string}`>
    : Extract<StaticAssetPath, `${Dir}${string}`> extends infer Match
      ? Match extends `${Dir}${infer FileName}`
        ? FileName extends `${string}/${string}`
          ? never
          : Match
        : never
      : never;



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

// Store basePath resolved from Vite config
const BASE_PATH = "/";


/**
 * Gets the URL for a specific static asset
 * @param path Path to the asset
 * @returns The URL for the asset
 */
export function staticAssets(path: StaticAssetPath): string {
  if (!assets.has(path)) {
    throw new Error(
      "Static asset does not exist in static assets directory"
    );
  }
  return `${BASE_PATH}${path}`;
}


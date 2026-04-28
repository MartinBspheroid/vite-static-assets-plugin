// Fallback type definitions for virtual:static-assets.
// These provide baseline TypeScript resolution before the plugin generates
// project-specific types. Add this reference to your vite-env.d.ts:
//
//   /// <reference types="vite-static-assets-plugin/client" />

declare module 'virtual:static-assets' {
  export type StaticAssetPath = string;
  export type StaticAssetDirectory = string;
  export type FilesInFolder<Dir extends string> = string;
  export function staticAssets(path: string): string;
}

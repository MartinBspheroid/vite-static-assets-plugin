# Vite Static Assets Plugin

A Vite plugin that automatically scans a specified directory for static assets, generates a TypeScript module with a type-safe union of available asset paths, and provides a helper function to get the URL for an asset. It also validates asset references in your code during build time, ensuring that you never reference a non-existent asset.

## Features

- **Automatic Asset Scanning:** Recursively scans a directory (default: `public`) for static assets.
- **Type-Safe API:** Generates a TypeScript module with a union type (`StaticAssetPath`) representing all valid asset paths.
- **Helper Function:** Provides a `staticAssets()` function to retrieve the URL for a static asset.
- **Customizable:** Supports custom directories, output file paths, and glob-based ignore patterns.
- **Live Updates in Development:** Watches the asset directory and updates the generated file on changes.
- **Validation:** During code transformation, it checks calls to `staticAssets()` to ensure the referenced asset exists.

## Installation

Install the plugin using npm or yarn:

```bash
npm install vite-plugin-static-assets
# or
yarn add vite-plugin-static-assets
```

Generated Module
----------------

The plugin automatically generates a TypeScript file (by default at src/static-assets.ts) containing:

*   **StaticAssetPath:** A union type of all asset paths found in the specified directory.
    
*   **assets:** A Set of asset paths used internally for validation.
    
*   **staticAssets Function:** A helper function to retrieve the URL for a static asset.
    

### Example Usage in Your Code

add this to your `vite.config.ts/js`
```typescript
import { defineConfig } from 'vite';
import staticAssetsPlugin from 'vite-plugin-static-assets';

export default defineConfig({
  plugins: [
    staticAssetsPlugin({
      // Optional configuration:
      directory: 'public',          // Directory to scan for static assets (default: 'public')
      outputFile: 'src/static-assets.ts',  // File to generate (default: 'src/static-assets.ts')
      ignore: ['**/*.tmp', '**/ignore/**']  // Glob patterns to ignore
    })
  ]
});
```

use it in your code like this:
```typescript
import { staticAssets } from './static-assets';

const logoUrl = staticAssets('logo.svg');
// Example in a React component:
 <img src={staticAssets('logo.svg')} alt="Logo" />
```

This setup provides compile-time type safety—only valid asset paths (as scanned during build time) can be used—and runtime verification to ensure the asset exists.

How It Works
------------

1.  **Asset Scanning:** On build start, the plugin scans the specified directory recursively (ignoring files based on provided glob patterns) and collects all asset paths relative to the directory.
    
2.  **TypeScript Module Generation:** It generates a TypeScript file that:
    
    *   Exports a union type StaticAssetPath representing all asset paths.
        
    *   Exports a helper function staticAssets() that returns the URL for an asset, ensuring it exists.
        
3.  **Development Watcher:** In non-production environments, the plugin sets up a file system watcher on the asset directory. Any changes update the generated module automatically.
    
4.  **Asset Reference Validation:** During the transformation of your source files (JS/TS, JSX/TSX, Vue, Svelte, etc.), the plugin scans for calls to staticAssets(). If a referenced asset is missing, it throws an error with detailed feedback.
    

Plugin Options
--------------

You can customize the plugin behavior by passing an options object to the plugin:

*   **directory?: string**The directory to scan for static assets. Defaults to public.
    
*   **outputFile?: string**The file path where the generated TypeScript module will be written. Defaults to src/static-assets.ts.
    
*   **ignore?: string[]** An array of glob patterns specifying files or directories to ignore during the asset scan. For example: `['\*\*/\*.tmp', '\*\*/ignore/\*\*'\]`.
    

Error Handling
--------------

If your code references an asset using staticAssets('asset-path') that does not exist in the scanned directory, the plugin will throw an error during the build or serve phase. This error message will include the path of the missing asset, the file where it was referenced, and guidance to correct the issue.

License
-------

This project is licensed under the MIT License.

Contributing
------------

Contributions, issues, and feature requests are welcome! Feel free to check the issues page

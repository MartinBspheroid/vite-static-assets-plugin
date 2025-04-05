<p align="center">
  <img height="300" src="https://github.com/user-attachments/assets/a2078a6a-d79b-4e8f-88c9-c11a4675797b">
</p>

# Vite Static Assets Plugin
 <span style="text-align: center;">
    <a href="https://www.npmjs.com/package/vite-static-assets-plugin" target="_blank">
      <img src="https://img.shields.io/npm/v/vite-static-assets-plugin?color=blue&label=npm&style=flat-square" alt="npm version" />
    </a>
    <a href="https://www.npmjs.com/package/vite-static-assets-plugin" target="_blank">
      <img src="https://img.shields.io/npm/dm/vite-static-assets-plugin?color=blue&label=npm%20downloads&style=flat-square" alt="npm downloads" />
    </a>
    <a href="https://github.com/MartinBspheroid/vite-static-assets-plugin/blob/main/LICENSE" target="_blank">
      <img src="https://img.shields.io/github/license/MartinBspheroid/vite-static-assets-plugin?color=blue&label=license&style=flat-square" alt="license" />
    </a>
  </span>



A Vite plugin that automatically scans a specified directory for static assets, generates a TypeScript module with a type-safe union of available asset paths, and provides a helper function to get the URL for an asset. It also validates asset references in your code during build time, ensuring that you never reference a non-existent asset.



<img width="1048" alt="Screenshot 2025-02-25 at 12 56 29" src="https://github.com/user-attachments/assets/2750833a-d816-46c8-80c6-c636fdd3dd84" />


  
## Features

- **Automatic Asset Scanning:** Recursively scans a directory (default: `public`) for static assets.
- **Type-Safe API:** Generates a TypeScript module with a union type (`StaticAssetPath`) representing all valid asset paths.
- **Helper Function:** Provides a `staticAssets()` function to retrieve the URL for a static asset.
- **Customizable:** Supports custom directories, output file paths, and glob-based ignore patterns.
- **Live Updates in Development:** Watches the asset directory and updates the generated file on changes.
- **Validation:** During code transformation, it checks calls to `staticAssets()` to ensure the referenced asset exists.


----
  
   <p style="text-align: center; display: flex;  justify-content: center; align-items: center; gap: 10px;">
   Built with <a href="https://bun.sh"><img src="https://bun.sh/logo.svg" alt="Bun Logo" height="16" /> Bun</a> – the ultra-fast JavaScript runtime & toolkit</p>


## Installation

Install the plugin as a development dependency using npm, yarn, bun, or pnpm:

```bash
# npm
npm install --save-dev vite-static-assets-plugin

# yarn
yarn add -D vite-static-assets-plugin

# bun
bun add -d vite-static-assets-plugin

# pnpm
pnpm add -D vite-static-assets-plugin
```

## Setup and Configuration

Add the plugin to your Vite configuration file:

### vite.config.ts (TypeScript)

```typescript
import { defineConfig } from 'vite';
import staticAssetsPlugin from 'vite-static-assets-plugin';

export default defineConfig({
  plugins: [
    staticAssetsPlugin({
      // Optional configuration (defaults shown):
      directory: 'public',          // Directory to scan for static assets
      outputFile: 'src/static-assets.ts',  // Where to generate the TypeScript module
      ignore: ['.DS_Store'],  // Files/patterns to ignore
      debounce: 200,  // Debounce time for file watcher events (ms)
    })
  ]
});
```

### vite.config.js (JavaScript)

```javascript
import { defineConfig } from 'vite';
import staticAssetsPlugin from 'vite-static-assets-plugin';

export default defineConfig({
  plugins: [
    staticAssetsPlugin({
      // Same options as above
    })
  ]
});
```

## Generated TypeScript Module

Once configured, the plugin will automatically generate a TypeScript module at the specified location (default: `src/static-assets.ts`). This module includes:

* **StaticAssetPath**: A union type containing all your asset paths as string literals
* **staticAssets**: A function that returns the correct URL for the asset
* **Built-in validation**: Runtime checks to ensure the asset exists

Example of generated code:

```typescript
// This file is auto-generated. Do not edit it manually.

export type StaticAssetPath = 
  'images/logo.svg' |
  'images/banner.jpg' |
  'fonts/roboto.woff2';

const assets = new Set<string>([
  'images/logo.svg',
  'images/banner.jpg',
  'fonts/roboto.woff2'
]);
const BASE_PATH = "/";

export function staticAssets(path: StaticAssetPath): string {
  if (!assets.has(path)) {
    throw new Error(`Static asset "${path}" does not exist in public directory`);
  }
  return BASE_PATH + path;
}
```

## Usage

Import the `staticAssets` function from the generated file and use it to reference your static assets:

```typescript
import { staticAssets } from './static-assets';

// Use it directly inline wherever asset paths are needed
<img src={staticAssets('images/logo.svg')} alt="Logo" />
```

### Framework Agnostic

<p align="center">
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/react/react-original.svg" alt="React" title="React" height="32" />
  &nbsp;
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vuejs/vuejs-original.svg" alt="Vue" title="Vue" height="32" />
  &nbsp;
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/svelte/svelte-original.svg" alt="Svelte" title="Svelte" height="32" />
  &nbsp;
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/angularjs/angularjs-original.svg" alt="Angular" title="Angular" height="32" />
  &nbsp;
  <img src="https://www.solidjs.com/img/logo/without-wordmark/logo.svg" alt="Solid" title="Solid" height="32" />
  &nbsp;
  <img src="https://cdn.worldvectorlogo.com/logos/lit-1.svg" alt="Lit" title="Lit" height="32" />
  &nbsp;
  <img src="https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg" alt="TypeScript" title="TypeScript" height="32" />
</p>

This plugin works with any frontend framework that uses Vite. Here are some examples:

#### React / Preact

```tsx
// Component example
function Logo() {
  return <img src={staticAssets('images/logo.svg')} alt="Logo" />;
}

// JSX inline usage
<div style={{ backgroundImage: `url(${staticAssets('images/background.jpg')})` }}>
  <img src={staticAssets('images/icon.png')} />
</div>
```

#### Vue

```vue
<template>
  <!-- Direct usage in templates -->
  <img :src="staticAssets('images/logo.svg')" alt="Logo" />
  
  <!-- With styles -->
  <div :style="{ backgroundImage: `url(${staticAssets('images/background.jpg')})` }">
    Content
  </div>
</template>

<script setup lang="ts">
import { staticAssets } from './static-assets';
</script>
```

#### Svelte

```svelte
<script lang="ts">
  import { staticAssets } from './static-assets';
</script>

<!-- Direct inline usage -->
<img src={staticAssets('images/logo.svg')} alt="Logo" />

<!-- With style binding -->
<div style="background-image: url({staticAssets('images/background.jpg')});">
  Content
</div>
```

#### Plain TypeScript

```typescript
import { staticAssets } from './static-assets';

// Create elements with correct asset paths
const img = document.createElement('img');
img.src = staticAssets('images/logo.svg');

// Use with template literals for CSS
const div = document.createElement('div');
div.style.backgroundImage = `url(${staticAssets('images/background.jpg')})`;
```

### Benefits of Using This Plugin

1. **Framework Agnostic**: Works with any frontend framework that uses Vite (React, Vue, Svelte, Angular, Solid, Lit, etc.)
2. **Type Safety**: TypeScript will show errors if you reference a non-existent asset
3. **Auto-Completion**: Your editor will suggest available assets as you type
4. **Build-Time Validation**: The build will fail if you reference missing assets
5. **Base Path Handling**: Works correctly with Vite's `base` config for subdirectory deployments
6. **Live Updates**: The generated file updates automatically as you add or remove assets

## How It Works

1. **Asset Scanning:** On build start, the plugin scans the specified directory recursively (ignoring files based on provided glob patterns) and collects all asset paths relative to the directory.
    
2. **TypeScript Module Generation:** It generates a TypeScript file that:
    
    * Exports a union type StaticAssetPath representing all asset paths.
        
    * Exports a helper function staticAssets() that returns the URL for an asset, ensuring it exists.
        
3. **Development Watcher:** In non-production environments, the plugin sets up a file system watcher on the asset directory. Any changes update the generated module automatically.
    
4. **Asset Reference Validation:** During the transformation of your source files (JS/TS, JSX/TSX, Vue, Svelte, etc.), the plugin scans for calls to staticAssets(). If a referenced asset is missing, it throws an error with detailed feedback.
    

## Plugin Options

You can customize the plugin behavior by passing an options object to the plugin:

* **directory?: string** - The directory to scan for static assets. Defaults to `public`.
    
* **outputFile?: string** - The file path where the generated TypeScript module will be written. Defaults to `src/static-assets.ts`.
    
* **ignore?: string[]** - An array of glob patterns specifying files or directories to ignore during the asset scan. Default: `['.DS_Store']`.

* **debounce?: number** - Debounce time in milliseconds for file system events. Default: `200`.

## Error Handling

If your code references an asset using staticAssets('asset-path') that does not exist in the scanned directory, the plugin will throw an error during the build or serve phase. This error message will include the path of the missing asset, the file where it was referenced, and guidance to correct the issue.

<img width="1048" alt="Screenshot 2025-02-25 at 12 56 50" src="https://github.com/user-attachments/assets/aad8cd9e-b5db-46b8-9ef9-73b031795482" />

## TypeScript Integration

This plugin is designed to work seamlessly with TypeScript. Here are some tips to get the best experience:

### Configure tsconfig.json

Ensure the generated module is included in your TypeScript configuration:

```json
{
  "include": [
    "src/**/*.ts",
    "src/**/*.tsx",
    "src/static-assets.ts"  // Include the generated file
  ]
}
```

### Auto-Completion and Type Checking

The plugin generates a union type of all your asset paths, giving you these benefits:

- **Auto-completion**: Your editor will suggest available asset paths
- **Type checking**: TypeScript will show errors if you reference a non-existent asset
- **Refactoring support**: If you rename an asset, TypeScript will flag all references to the old name


### Troubleshooting

If you see TypeScript errors related to the plugin in your Vite config:

```typescript
// Type assertion is a quick fix
import staticAssetsPlugin from 'vite-static-assets-plugin';
export default defineConfig({
  plugins: [staticAssetsPlugin()]
});
```

Or for a better typed solution:

```typescript
import staticAssetsPlugin from 'vite-static-assets-plugin';
import type { PluginOption } from 'vite';

export default defineConfig({
  plugins: [staticAssetsPlugin() as PluginOption]
});
```

## Development

### Testing

This project uses Vitest for testing. The test suite includes unit tests, integration tests, and functional tests:

```bash
# Run all tests
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

Test files are located in the `tests/` directory:

- **Unit Tests**: Test individual functions (e.g., `getAllFiles`, `generateTypeScriptCode`)
- **Integration Tests**: Test interaction with Vite
- **Functional Tests**: Test real file system operations

When contributing, please ensure that your changes pass all existing tests and add new tests for any new functionality.

## License

This project is licensed under the MIT License.

## Contributing

Contributions, issues, and feature requests are welcome! Feel free to check the issues page.

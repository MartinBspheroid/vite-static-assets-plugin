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

A Vite plugin that **automatically scans your static assets directory**, generates a **type-safe TypeScript module** with all asset paths, **directory-aware types**, and a helper function to get asset URLs. It validates asset references during build and updates live during development.

<img width="1048" alt="Screenshot 2025-02-25 at 12 56 29" src="https://github.com/user-attachments/assets/2750833a-d816-46c8-80c6-c636fdd3dd84" />

---

## Features

- 🚀 **Automatic Recursive Scanning:** Scans a directory (default: `public`) for all static assets.
- 🛡 **Type-Safe API:** Generates a union type `StaticAssetPath` of all valid asset paths.
- 📁 **Directory-Aware Types:** Generates `StaticAssetDirectory` and a powerful `FilesInFolder<Dir>` generic for directory-specific asset typing.
- 🔗 **Helper Function:** Provides `staticAssets()` to get the URL for an asset, with runtime validation.
- 🛠 **Highly Configurable:** Customize directory, output file, ignore patterns, debounce, directory depth, empty directory handling, leading slash, and more.
- 🔄 **Live Updates:** Watches the directory in development mode and regenerates types on changes.
- 🧭 **Validation:** Validates asset references and directory references during build, with detailed error messages.
- ⚡ **Fast:** Minimal overhead, optimized for large projects.
<p style="text-align: center; display: flex;  justify-content: center; align-items: center; gap: 10px;">
Built with <a href="https://bun.sh"><img src="https://bun.sh/logo.svg" alt="Bun Logo" height="16" /> Bun</a> – the ultra-fast JavaScript runtime & toolkit
</p>

---


## Usage

Import the generated function and types:

```typescript
import { staticAssets, StaticAssetPath, StaticAssetDirectory, FilesInFolder } from './static-assets';

// Use the helper function
const logoUrl = staticAssets('images/logo.svg');

// Type-safe variables
const assetPath: StaticAssetPath = 'fonts/roboto.woff2';

const dir: StaticAssetDirectory = 'images/';


// Type-safe list of files directly inside 'icons/brands/'
type  Icons = FilesInFolder<'icons/brands/'>;
// use Icons type in your code
type Brands = {
  icon: Icons,
  name: string
}
// Create a list of brands with their icons and names
// get autocompletion and type checking!
const brands: Brands[] = [
  {
    icon: "icons/brands/coke.svg",
    name: "Coke"
  },
  {
    icon: "icons/brands/pepsi.svg",
    name: "Pepsi"
  },
  {
    icon: "icons/brands/rc-cola.svg",
    name: "RC Cola"
  },
  {
    icon: "icons/brands/dr-pepper.svg",
    name: "Dr Pepper"
  },
]

```


---

## Installation

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

---

## Setup and Configuration

Add the plugin to your Vite config:

### vite.config.ts

```typescript
import { defineConfig } from 'vite';
import staticAssetsPlugin from 'vite-static-assets-plugin';

export default defineConfig({
  plugins: [
    staticAssetsPlugin({
      // Optional configuration (defaults shown):
      directory: 'public',
      outputFile: 'src/static-assets.ts',
      ignore: ['.DS_Store'],
      debounce: 200,
      enableDirectoryTypes: true,
      maxDirectoryDepth: 5,
      allowEmptyDirectories: false,
      addLeadingSlash: true,
    })
  ]
});
```

---

## Generated TypeScript Module

The plugin generates a TypeScript file (default: `src/static-assets.ts`) containing:

### `StaticAssetPath`

A union of all asset paths:

```typescript
export type StaticAssetPath =
  'images/logo.svg' |
  'images/banner.jpg' |
  'fonts/roboto.woff2';
```

### `StaticAssetDirectory`

A union of all directories containing assets, including `'.'` for the root:

```typescript
export type StaticAssetDirectory =
  '.' |
  'fonts/' |
  'images/' ;
```

### `FilesInFolder<Dir>`

A generic type representing **only the files directly inside** a directory:

```typescript
// Example: all files directly inside 'images/' (not nested)
type ImageFiles = FilesInFolder<'images/'>;
// 'logo.svg' | 'banner.jpg'
```

### `staticAssets(path)`

A function that returns the URL for an asset, with validation:

```typescript
export function staticAssets(path: StaticAssetPath): string;
```

If you pass an invalid path, it throws an error at runtime and TypeScript will catch it at compile time.

---


Use it in your components:

```tsx
<img src={staticAssets('images/logo.svg')} alt="Logo" />
```

---

## Framework Agnostic

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

Works with **any** frontend framework that uses Vite: React, Vue, Svelte, Angular, Solid, Lit, and more.

---

## Plugin Options

| Option                   | Type            | Default                   | Description                                                                                      |
|--------------------------|-----------------|---------------------------|--------------------------------------------------------------------------------------------------|
| `directory`              | `string`        | `'public'`                | Directory to scan for static assets                                                              |
| `outputFile`             | `string`        | `'src/static-assets.ts'`  | Path to generate the TypeScript module                                                           |
| `ignore`                 | `string[]`      | `['.DS_Store']`           | Glob patterns to ignore                                                                          |
| `debounce`               | `number`        | `200`                     | Debounce time (ms) for file watcher events                                                       |
| `enableDirectoryTypes`   | `boolean`       | `true`                    | Generate directory-aware types (`StaticAssetDirectory`, `FilesInFolder`)                         |
| `maxDirectoryDepth`      | `number`        | `5`                       | Maximum directory nesting level for directory type generation                                    |
| `allowEmptyDirectories`  | `boolean`       | `false`                   | Allow referencing empty directories in validation                                                |
| `addLeadingSlash`        | `boolean`       | `true`                    | Add a leading slash to generated asset URLs                                                      |

---

## How It Works

1. **Scans** the specified directory recursively, ignoring patterns.
2. **Generates** a TypeScript file with:
   - `StaticAssetPath` union of all asset paths.
   - `StaticAssetDirectory` union of directories.
   - `FilesInFolder<Dir>` generic.
   - `staticAssets()` function.
3. **Watches** the directory in development mode, regenerating on changes.
4. **Validates** asset references and directory references during build.
5. **Throws errors** with detailed info if assets or directories are missing.

---

## Error Handling

- If you reference a missing asset in `staticAssets()`, the plugin throws a build-time error with details (even if you're skipping TS typechecking before build).
- If you reference a directory (via `FilesInFolder` or in code) that is empty or missing, it throws an error **unless** `allowEmptyDirectories: true`.
- Errors include the file path, missing asset/directory, and suggestions.

<img width="1048" alt="Screenshot 2025-02-25 at 12 56 50" src="https://github.com/user-attachments/assets/aad8cd9e-b5db-46b8-9ef9-73b031795482" />

- Please note that this message is shown in case you **actually skip TS typechecking before build**. In case you're not typechecking before build (which is recommended), the error will be thrown at build time and you'll see the full error message in the terminal.
---

## TypeScript Integration

- The generated file is **TypeScript-ready** (as long as you set `outputFile`  in your `vite.config.ts` to folder that is visible to your project).
- Enjoy **auto-completion**, **type checking**, and **refactoring support** for your static assets.

---

## Development

### Testing

This project uses **Vitest**:

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage
```

Tests are in `packages/plugin/tests/` and cover core functions and plugin behavior.

---

## License

MIT

---

## Contributing

Contributions, issues, and feature requests are welcome! Please open an issue or pull request.

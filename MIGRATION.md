# Migrating from v1 to v2

## Breaking Changes

### 1. Import path changed to virtual module

```diff
- import { staticAssets, type StaticAssetPath } from './static-assets';
+ import { staticAssets, type StaticAssetPath } from 'virtual:static-assets';
```

Find and replace `from "./static-assets"` (or `from './static-assets'`) with `from "virtual:static-assets"` across your codebase.

### 2. Add TypeScript reference

Add this line to your `src/vite-env.d.ts` (create the file if it doesn't exist):

```typescript
/// <reference types="vite/client" />
/// <reference types="vite-static-assets-plugin/client" />
```

This provides fallback types before the plugin generates project-specific types on first run.

### 3. Delete the old generated file

Remove `src/static-assets.ts` from your project. The plugin no longer generates `.ts` files — it serves runtime code via a virtual module and only writes a `.d.ts` file for type information.

Update your `.gitignore`:
```diff
- static-assets.ts
+ static-assets.d.ts
```

### 4. Config option changes

```diff
  staticAssetsPlugin({
    directory: 'public',
-   outputFile: 'src/static-assets.ts',  // deprecated
+   typesOutputFile: 'src/static-assets.d.ts',  // optional, this is the default
-   addLeadingSlash: true,  // removed, now handled by import.meta.env.BASE_URL
  })
```

- `outputFile` is deprecated. Use `typesOutputFile` to control where the `.d.ts` is generated (default: `src/static-assets.d.ts`).
- `addLeadingSlash` is removed. Base URL handling is now automatic via Vite's `import.meta.env.BASE_URL`.

## What's New

- **Virtual module**: Runtime code is served via `virtual:static-assets` — no more files written to your source tree.
- **Correct base URL handling**: Works with `base: '/my-app/'`, `base: './'`, CDN URLs, and SSR out of the box.
- **Zero heavy dependencies**: chalk, chokidar, and minimatch removed. The plugin now has a single lightweight dependency (picomatch).
- **Vite-native file watching**: Uses Vite's built-in watcher instead of a separate chokidar instance.
- **Node 20.12+ required**: The plugin now uses `util.styleText` from Node's standard library.

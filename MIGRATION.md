# Migration

## Migrating from v2 to v3

### Breaking changes

#### 1. Vite 6 dropped

The plugin now requires Vite **7 or 8**. Vite 6 is no longer supported.

```diff
  "devDependencies": {
-   "vite": "^6.2.0"
+   "vite": "^7.0.0 || ^8.0.0"
  }
```

#### 2. Node 20.19+ required

Vite 7 raised the minimum Node version. The plugin now declares:

```
"engines": { "node": "^20.19.0 || ^22.12.0 || >=24.0.0" }
```

Upgrade Node before upgrading the plugin.

#### 3. TypeScript ≥ 5

Unchanged from v2 in practice, but explicitly required.

### Framework-specific notes

#### SvelteKit

SvelteKit's runtime base path comes from `kit.paths.base` in `svelte.config.js`. The plugin emits URLs based on Vite's `base` (via `import.meta.env.BASE_URL`). Keep them in sync:

```js
// svelte.config.js
const base = process.env.PUBLIC_BASE?.replace(/\/$/, '') || ''
export default {
  kit: { paths: { base }, adapter: adapter() }
}
```

```ts
// vite.config.ts
const baseEnv = process.env.PUBLIC_BASE?.replace(/\/$/, '') || ''
export default defineConfig({
  base: baseEnv ? `${baseEnv}/` : '/',
  plugins: [sveltekit(), staticAssets({ directory: 'static' })]
})
```

If you only set `kit.paths.base`, `staticAssets()` URLs will still be `/asset.png` (no prefix). Either set both, or wrap the plugin's output yourself with `$app/paths.base`.

#### Nuxt

Nuxt's runtime base comes from `app.baseURL`. Set it alongside `vite.base` and force the env replacement so the plugin's `import.meta.env.BASE_URL` resolves on both client and server:

```ts
// nuxt.config.ts
const baseURL = process.env.NUXT_PUBLIC_APP_BASE_URL || '/'
export default defineNuxtConfig({
  app: { baseURL },
  vite: {
    base: baseURL,
    define: { 'import.meta.env.BASE_URL': JSON.stringify(baseURL) },
    plugins: [staticAssets({ directory: 'public', typesOutputFile: 'app/static-assets.d.ts' })]
  }
})
```

`typesOutputFile: 'app/static-assets.d.ts'` puts the generated types under Nuxt 4's default `srcDir` (`app/`), where the auto-generated `.nuxt/tsconfig.app.json` already includes them — no extra `tsConfig.include` plumbing needed.

#### TanStack Start, React SPA, Vue SPA

Standard Vite usage. Set `base` from an env var if you need configurable base paths:

```ts
const base = process.env.VITE_BASE ?? '/'
export default defineConfig({ base, plugins: [staticAssets({ directory: 'public' })] })
```

---

## Migrating from v1 to v2

### Breaking changes

#### 1. Import path changed to virtual module

```diff
- import { staticAssets, type StaticAssetPath } from './static-assets';
+ import { staticAssets, type StaticAssetPath } from 'virtual:static-assets';
```

Find and replace `from "./static-assets"` (or `from './static-assets'`) with `from "virtual:static-assets"` across your codebase.

#### 2. Add TypeScript reference

Add this line to your `src/vite-env.d.ts` (create the file if it doesn't exist):

```typescript
/// <reference types="vite/client" />
/// <reference types="vite-static-assets-plugin/client" />
```

This provides fallback types before the plugin generates project-specific types on first run.

#### 3. Delete the old generated file

Remove `src/static-assets.ts` from your project. The plugin no longer generates `.ts` files — it serves runtime code via a virtual module and only writes a `.d.ts` file for type information.

Update your `.gitignore`:
```diff
- static-assets.ts
+ static-assets.d.ts
```

#### 4. Config option changes

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

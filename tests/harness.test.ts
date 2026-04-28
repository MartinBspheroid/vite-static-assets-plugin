import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { execa } from 'execa'
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import stripAnsi from 'strip-ansi'
import { spawnServer, type ServerHandle } from './spawn-server'
import { extractHarnessUrls } from './cheerio-assertions'

const REPO_ROOT = path.resolve(__dirname, '..')
const HARNESS_MARKER = 'harness-asset-url'
const CHECK_FILE_BAD_CONTENT = `import { staticAssets } from 'virtual:static-assets'\nstaticAssets('does-not-exist.png')\nexport {}\n`
const CHECK_FILE_EMPTY_CONTENT = `// Harness check slot. Default: empty. Cross-framework harness rewrites this to test missing-asset detection.\nexport {}\n`

interface AppFixture {
  name: string
  dir: string
  kind: 'spa' | 'ssr'
  buildCommand: { cmd: string; args: string[] }
  /** Only required for SSR apps. */
  serverCommand?: (port: number) => { cmd: string; args: string[] }
  /** Glob-friendly: dir relative to app.dir where built JS lives (for SPA bundle inspection). */
  spaBundleDir?: string
  staticDir: string
  dtsPath: string
  checkFile: string
  serverEntry?: string
}

const APPS: AppFixture[] = [
  {
    name: 'react-test-app',
    dir: path.join(REPO_ROOT, 'test-apps/react-test-app'),
    kind: 'spa',
    buildCommand: { cmd: 'bunx', args: ['vite', 'build'] },
    spaBundleDir: 'dist/assets',
    staticDir: 'public',
    dtsPath: 'src/static-assets.d.ts',
    checkFile: 'src/check.ts',
  },
  {
    name: 'vue-test-app',
    dir: path.join(REPO_ROOT, 'test-apps/vue-test-app'),
    kind: 'spa',
    buildCommand: { cmd: 'bunx', args: ['vite', 'build'] },
    spaBundleDir: 'dist/assets',
    staticDir: 'public',
    dtsPath: 'src/static-assets.d.ts',
    checkFile: 'src/check.ts',
  },
  {
    name: 'sveltekit-app',
    dir: path.join(REPO_ROOT, 'test-apps/sveltekit-app'),
    kind: 'ssr',
    buildCommand: { cmd: 'bun', args: ['run', 'build'] },
    serverCommand: () => ({ cmd: 'node', args: ['build'] }),
    staticDir: 'static',
    dtsPath: 'src/static-assets.d.ts',
    checkFile: 'src/check.ts',
    serverEntry: 'build/index.js',
  },
  {
    name: 'nuxt-app',
    dir: path.join(REPO_ROOT, 'test-apps/nuxt-app'),
    kind: 'ssr',
    buildCommand: { cmd: 'bun', args: ['run', 'build'] },
    serverCommand: () => ({ cmd: 'node', args: ['.output/server/index.mjs'] }),
    staticDir: 'public',
    dtsPath: 'app/static-assets.d.ts',
    checkFile: 'app/check.ts',
    serverEntry: '.output/server/index.mjs',
  },
  {
    name: 'tanstack-start',
    dir: path.join(REPO_ROOT, 'test-apps/tanstack-start'),
    kind: 'ssr',
    buildCommand: { cmd: 'bun', args: ['run', 'build'] },
    serverCommand: () => ({ cmd: 'node', args: ['.output/server/index.mjs'] }),
    staticDir: 'public',
    dtsPath: 'src/static-assets.d.ts',
    checkFile: 'src/check.ts',
    serverEntry: '.output/server/index.mjs',
  },
]

async function build(app: AppFixture, env: Record<string, string> = {}, expectFailure = false) {
  const { cmd, args } = app.buildCommand
  const result = await execa(cmd, args, {
    cwd: app.dir,
    env: { ...process.env, NODE_ENV: 'production', ...env },
    reject: false,
    all: true,
  })
  if (!expectFailure && result.exitCode !== 0) {
    throw new Error(
      `Build failed for ${app.name} (exit ${result.exitCode}).\n` +
        `Command: ${cmd} ${args.join(' ')}\n` +
        `Env: ${JSON.stringify(env)}\n` +
        `Output:\n${stripAnsi(result.all ?? '')}`,
    )
  }
  return result
}

async function fetchHomeHtml(app: AppFixture, env: Record<string, string> = {}): Promise<{ html: string; cleanup: () => Promise<void> }> {
  if (!app.serverCommand) throw new Error(`${app.name} is not an SSR app`)
  const baseUrl = env.VITE_BASE && env.VITE_BASE !== '/' ? env.VITE_BASE : '/'
  const handle: ServerHandle = await spawnServer({
    cwd: app.dir,
    command: app.serverCommand,
    env,
    readinessPath: baseUrl,
    readinessMarker: HARNESS_MARKER,
    readyTimeoutMs: 60_000,
  })
  const url = `${handle.url}${baseUrl}`
  const res = await fetch(url)
  const html = await res.text()
  return { html, cleanup: handle.stop }
}

async function readSpaBundle(app: AppFixture): Promise<string> {
  if (!app.spaBundleDir) throw new Error(`${app.name} has no spaBundleDir`)
  const dir = path.join(app.dir, app.spaBundleDir)
  const files = (await readdir(dir)).filter((f) => f.endsWith('.js'))
  const contents = await Promise.all(files.map((f) => readFile(path.join(dir, f), 'utf8')))
  return contents.join('\n')
}

describe.each(APPS)('$name', (app) => {
  let defaultBuildOk = false

  beforeAll(async () => {
    await writeFile(path.join(app.dir, app.checkFile), CHECK_FILE_EMPTY_CONTENT)
    await build(app)
    defaultBuildOk = true
  }, 300_000)

  afterAll(async () => {
    await writeFile(path.join(app.dir, app.checkFile), CHECK_FILE_EMPTY_CONTENT)
  })

  it('emits .d.ts with expected union members', async () => {
    expect(defaultBuildOk).toBe(true)
    const dts = await readFile(path.join(app.dir, app.dtsPath), 'utf8')
    expect(dts).toContain("declare module 'virtual:static-assets'")
    expect(dts).toContain("'icons/arrow.svg'")
    expect(dts).toContain("'icons/sun/sun.svg'")
    expect(dts).toContain("'logo.png'")
  })

  if (app.kind === 'ssr') {
    it('renders correct asset URL with default base (SSR)', async () => {
      const { html, cleanup } = await fetchHomeHtml(app)
      try {
        const { logoSrc, assetUrl, iconUrl } = extractHarnessUrls(html)
        expect(logoSrc).toBe('/logo.png')
        expect(assetUrl).toBe('/logo.png')
        expect(iconUrl).toBe('/icons/sun/sun.svg')
      } finally {
        await cleanup()
      }
    }, 120_000)

    it('renders correct asset URL with /sub/ base (SSR)', async () => {
      await build(app, { VITE_BASE: '/sub/' })
      const { html, cleanup } = await fetchHomeHtml(app, { VITE_BASE: '/sub/' })
      try {
        const { logoSrc, assetUrl, iconUrl } = extractHarnessUrls(html)
        expect(logoSrc).toBe('/sub/logo.png')
        expect(assetUrl).toBe('/sub/logo.png')
        expect(iconUrl).toBe('/sub/icons/sun/sun.svg')
      } finally {
        await cleanup()
        await build(app)
      }
    }, 240_000)

    it('SSR server bundle has BASE_URL replaced (no literal import.meta.env.BASE_URL)', async () => {
      const entryPath = path.join(app.dir, app.serverEntry!)
      const code = await readFile(entryPath, 'utf8')
      expect(code).not.toContain('import.meta.env.BASE_URL')
    })
  } else {
    it('SPA bundle contains BASE_URL value', async () => {
      const bundle = await readSpaBundle(app)
      // Default base = "/", which appears everywhere; assert the asset path string is present.
      expect(bundle).toContain('logo.png')
    })

    it('SPA bundle uses /sub/ base when VITE_BASE=/sub/', async () => {
      await build(app, { VITE_BASE: '/sub/' })
      try {
        const bundle = await readSpaBundle(app)
        expect(bundle).toContain('/sub/')
        expect(bundle).toContain('logo.png')
      } finally {
        await build(app)
      }
    }, 180_000)
  }

  it('build fails when an asset reference is missing', async () => {
    const checkPath = path.join(app.dir, app.checkFile)
    try {
      await writeFile(checkPath, CHECK_FILE_BAD_CONTENT)
      const result = await build(app, {}, true)
      expect(result.exitCode).not.toBe(0)
      const output = stripAnsi(result.all ?? '')
      expect(output).toContain('does-not-exist.png')
      expect(output).toContain('Asset not found in scanned directory')
    } finally {
      await writeFile(checkPath, CHECK_FILE_EMPTY_CONTENT)
    }
  }, 240_000)
})

/**
 * Wave 1A: Options matrix.
 * Exercises every plugin option for default vs explicit, boundary, and
 * deprecation paths. Pure unit-style — no Vite app build.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import staticAssetsPlugin from '../src/index'

let tmpRoot: string
let prevCwd: string

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vsap-opts-'))
  prevCwd = process.cwd()
  process.chdir(tmpRoot)
})

afterEach(() => {
  process.chdir(prevCwd)
  fs.rmSync(tmpRoot, { recursive: true, force: true })
})

async function runBuildStart(plugin: ReturnType<typeof staticAssetsPlugin>) {
  const buildStart = (plugin as any).buildStart as () => Promise<void>
  await buildStart.call({})
}

describe('options.directory', () => {
  it('A1. relative path scans the configured directory, not public/', async () => {
    fs.mkdirSync('static', { recursive: true })
    fs.writeFileSync('static/logo.png', 'x')
    fs.mkdirSync('public')
    fs.writeFileSync('public/should-not-appear.png', 'x')

    const dts = path.join(tmpRoot, 'out.d.ts')
    const plugin = staticAssetsPlugin({ directory: 'static', typesOutputFile: dts })
    await runBuildStart(plugin)

    const content = fs.readFileSync(dts, 'utf8')
    expect(content).toContain('"logo.png"')
    expect(content).not.toContain('should-not-appear.png')
  })

  it('A2. nested directory path produces relative literals (no parent prefix)', async () => {
    fs.mkdirSync('assets/public', { recursive: true })
    fs.writeFileSync('assets/public/x.png', 'x')

    const dts = path.join(tmpRoot, 'out.d.ts')
    const plugin = staticAssetsPlugin({ directory: 'assets/public', typesOutputFile: dts })
    await runBuildStart(plugin)

    const content = fs.readFileSync(dts, 'utf8')
    expect(content).toContain('"x.png"')
    expect(content).not.toContain('assets/public/x.png')
  })

  it('A3. directory outside cwd works and produces normalized POSIX paths', async () => {
    const sibling = fs.mkdtempSync(path.join(os.tmpdir(), 'vsap-sibling-'))
    fs.writeFileSync(path.join(sibling, 'a.png'), 'x')
    try {
      const dts = path.join(tmpRoot, 'out.d.ts')
      const plugin = staticAssetsPlugin({ directory: sibling, typesOutputFile: dts })
      await runBuildStart(plugin)
      const content = fs.readFileSync(dts, 'utf8')
      expect(content).toContain('"a.png"')
      expect(content).not.toContain('\\') // POSIX separators only
    } finally {
      fs.rmSync(sibling, { recursive: true, force: true })
    }
  })

  it('A4. absolute path scans correctly', async () => {
    const absDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsap-abs-'))
    fs.writeFileSync(path.join(absDir, 'absolute.png'), 'x')
    try {
      const dts = path.join(tmpRoot, 'out.d.ts')
      const plugin = staticAssetsPlugin({ directory: absDir, typesOutputFile: dts })
      await runBuildStart(plugin)
      expect(fs.readFileSync(dts, 'utf8')).toContain('"absolute.png"')
    } finally {
      fs.rmSync(absDir, { recursive: true, force: true })
    }
  })

  it('A5. missing directory warns and emits never-typed dts', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const dts = path.join(tmpRoot, 'out.d.ts')
    const plugin = staticAssetsPlugin({ directory: 'does-not-exist', typesOutputFile: dts })
    await runBuildStart(plugin)

    expect(warn).toHaveBeenCalled()
    const warnMsg = warn.mock.calls.map((c) => c.join(' ')).join('\n')
    expect(warnMsg).toMatch(/Source directory.*not found/)
    const content = fs.readFileSync(dts, 'utf8')
    expect(content).toContain('never')
    warn.mockRestore()
  })

  it('A6. directory pointing at a file scans empty without crash', async () => {
    fs.writeFileSync('not-a-dir.txt', 'x')
    const dts = path.join(tmpRoot, 'out.d.ts')
    const plugin = staticAssetsPlugin({ directory: 'not-a-dir.txt', typesOutputFile: dts })
    await runBuildStart(plugin)
    const content = fs.readFileSync(dts, 'utf8')
    expect(content).toContain('never')
  })
})

describe('options.typesOutputFile', () => {
  it('A7. custom path used; default path NOT created', async () => {
    fs.mkdirSync('public')
    fs.writeFileSync('public/logo.png', 'x')
    const customPath = path.join(tmpRoot, 'types/assets.d.ts')
    const plugin = staticAssetsPlugin({ typesOutputFile: customPath })
    await runBuildStart(plugin)

    expect(fs.existsSync(customPath)).toBe(true)
    expect(fs.existsSync(path.join(tmpRoot, 'src/static-assets.d.ts'))).toBe(false)
  })

  it('A8. nested non-existent dir is created recursively', async () => {
    fs.mkdirSync('public')
    fs.writeFileSync('public/logo.png', 'x')
    const deep = path.join(tmpRoot, 'a/b/c/d/e.d.ts')
    const plugin = staticAssetsPlugin({ typesOutputFile: deep })
    await runBuildStart(plugin)

    expect(fs.existsSync(deep)).toBe(true)
  })
})

describe('options.ignore', () => {
  it('A9. single literal pattern excludes a file', async () => {
    fs.mkdirSync('public')
    fs.writeFileSync('public/secret.txt', 'x')
    fs.writeFileSync('public/logo.png', 'x')

    const dts = path.join(tmpRoot, 'out.d.ts')
    const plugin = staticAssetsPlugin({ typesOutputFile: dts, ignore: ['secret.txt'] })
    await runBuildStart(plugin)
    const content = fs.readFileSync(dts, 'utf8')
    expect(content).toContain('"logo.png"')
    expect(content).not.toContain('secret.txt')
  })

  it('A10. recursive **/*.tmp glob matches at every depth', async () => {
    fs.mkdirSync('public/nested', { recursive: true })
    fs.writeFileSync('public/a.tmp', 'x')
    fs.writeFileSync('public/nested/b.tmp', 'x')
    fs.writeFileSync('public/keep.png', 'x')

    const dts = path.join(tmpRoot, 'out.d.ts')
    const plugin = staticAssetsPlugin({ typesOutputFile: dts, ignore: ['**/*.tmp'] })
    await runBuildStart(plugin)
    const content = fs.readFileSync(dts, 'utf8')
    expect(content).toContain('"keep.png"')
    expect(content).not.toContain('.tmp')
  })

  it('A11. negation in array is OR-combined (NOT minimatch-style override)', async () => {
    // Picomatch differs from minimatch: in a pattern array, `!keep.png` does
    // NOT override a previous positive match. The matcher is OR(every pattern),
    // and `!x` is a standalone "match anything except x". With `['*', '!keep.png']`
    // every file matches at least one pattern, so all files are ignored.
    // This is a silent breaking change from v1 (minimatch). Documented in MIGRATION.md.
    fs.mkdirSync('public')
    fs.writeFileSync('public/keep.png', 'x')
    fs.writeFileSync('public/drop1.png', 'x')

    const dts = path.join(tmpRoot, 'out.d.ts')
    const plugin = staticAssetsPlugin({ typesOutputFile: dts, ignore: ['*', '!keep.png'] })
    await runBuildStart(plugin)
    const content = fs.readFileSync(dts, 'utf8')
    expect(content).toMatch(/StaticAssetPath\s*=\s*\n\s*never/)
  })

  it('A12. empty ignore array overrides default — .DS_Store now included', async () => {
    fs.mkdirSync('public')
    fs.writeFileSync('public/.DS_Store', 'junk')
    fs.writeFileSync('public/logo.png', 'x')

    const dts = path.join(tmpRoot, 'out.d.ts')
    const plugin = staticAssetsPlugin({ typesOutputFile: dts, ignore: [] })
    await runBuildStart(plugin)
    const content = fs.readFileSync(dts, 'utf8')
    expect(content).toContain('.DS_Store')
  })

  it('A13. dotfile pattern matches via picomatch dot:true', async () => {
    fs.mkdirSync('public')
    fs.writeFileSync('public/.htaccess', 'x')
    fs.writeFileSync('public/logo.png', 'x')

    const dts = path.join(tmpRoot, 'out.d.ts')
    const plugin = staticAssetsPlugin({ typesOutputFile: dts, ignore: ['.htaccess'] })
    await runBuildStart(plugin)
    const content = fs.readFileSync(dts, 'utf8')
    expect(content).not.toContain('.htaccess')
    expect(content).toContain('"logo.png"')
  })
})

describe('deprecated options', () => {
  it('A24. outputFile alone fires deprecation warning and rewrites .ts to .d.ts', async () => {
    fs.mkdirSync('public')
    fs.writeFileSync('public/logo.png', 'x')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const oldPath = path.join(tmpRoot, 'src/old-name.ts')
    staticAssetsPlugin({ outputFile: oldPath })
    expect(warn.mock.calls.flat().join(' ')).toMatch(/'outputFile' is deprecated/)
    warn.mockRestore()
  })

  it('A25. typesOutputFile wins when both are set; no deprecation warning', async () => {
    fs.mkdirSync('public')
    fs.writeFileSync('public/logo.png', 'x')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const newPath = path.join(tmpRoot, 'wins.d.ts')
    const oldPath = path.join(tmpRoot, 'loses.ts')
    const plugin = staticAssetsPlugin({ outputFile: oldPath, typesOutputFile: newPath })
    await runBuildStart(plugin)

    expect(fs.existsSync(newPath)).toBe(true)
    expect(fs.existsSync(oldPath.replace(/\.ts$/, '.d.ts'))).toBe(false)
    expect(warn.mock.calls.flat().join(' ')).not.toMatch(/'outputFile' is deprecated/)
    warn.mockRestore()
  })
})

/**
 * Wave 1A: Root resolution.
 *
 * Verifies B3 fix: directory + typesOutputFile resolve against
 * resolvedConfig.root passed to configResolved, NOT process.cwd() at
 * factory time.
 *
 * Drives plugin hooks directly. configResolved is called with a fake
 * resolvedConfig that only has `root` and `logger` populated — the
 * plugin doesn't read anything else from it.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import staticAssetsPlugin from '../src/index'

const fakeLogger = {
  info: () => {},
  warn: () => {},
  warnOnce: () => {},
  error: () => {},
  clearScreen: () => {},
  hasErrorLogged: () => false,
  hasWarned: false,
}

let tmpRoot: string
let prevCwd: string
let unrelatedCwd: string

beforeEach(() => {
  // Make process.cwd() point at an *unrelated* dir so we can prove the
  // plugin uses resolvedConfig.root and NOT cwd. If the bug were still
  // present, scans would target unrelatedCwd/public, which is empty.
  unrelatedCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'vsap-cwd-'))
  // Create an empty public/ inside cwd so an accidental cwd-resolved scan
  // would produce a never-typed dts (clear failure mode).
  fs.mkdirSync(path.join(unrelatedCwd, 'public'))
  prevCwd = process.cwd()
  process.chdir(unrelatedCwd)

  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'vsap-root-'))
})

afterEach(() => {
  process.chdir(prevCwd)
  fs.rmSync(tmpRoot, { recursive: true, force: true })
  fs.rmSync(unrelatedCwd, { recursive: true, force: true })
})

async function runHooks(
  plugin: ReturnType<typeof staticAssetsPlugin>,
  resolvedConfig: { root: string; logger?: typeof fakeLogger },
) {
  const configResolved = (plugin as any).configResolved as (cfg: unknown) => void
  configResolved.call({}, { logger: fakeLogger, ...resolvedConfig })
  const buildStart = (plugin as any).buildStart as () => Promise<void>
  await buildStart.call({})
}

describe('configResolved root resolution', () => {
  it('A-root1. relative directory resolves against resolvedConfig.root, not process.cwd()', async () => {
    // Set up fixture under tmpRoot/public — NOT under cwd.
    fs.mkdirSync(path.join(tmpRoot, 'public'))
    fs.writeFileSync(path.join(tmpRoot, 'public', 'logo.png'), 'x')
    // Decoy file in cwd/public that MUST NOT appear in the dts. If the bug
    // is still present, the plugin would scan unrelatedCwd/public and pick
    // up this file instead.
    fs.writeFileSync(path.join(unrelatedCwd, 'public', 'wrong.png'), 'x')

    const dts = path.join(tmpRoot, 'out.d.ts')
    const plugin = staticAssetsPlugin({ directory: 'public', typesOutputFile: dts })

    await runHooks(plugin, { root: tmpRoot })

    expect(fs.existsSync(dts)).toBe(true)
    const content = fs.readFileSync(dts, 'utf8')
    expect(content).toContain('"logo.png"')
    expect(content).not.toContain('wrong.png')
  })

  it('A-root2. absolute directory ignores resolvedConfig.root', async () => {
    // Absolute paths win — path.resolve(root, absolute) returns absolute.
    const absDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsap-abs-dir-'))
    fs.writeFileSync(path.join(absDir, 'absolute.png'), 'x')

    try {
      const dts = path.join(tmpRoot, 'out.d.ts')
      const plugin = staticAssetsPlugin({ directory: absDir, typesOutputFile: dts })

      // Pass a root that does NOT contain absDir — proves absolute path wins.
      await runHooks(plugin, { root: tmpRoot })

      const content = fs.readFileSync(dts, 'utf8')
      expect(content).toContain('"absolute.png"')
    } finally {
      fs.rmSync(absDir, { recursive: true, force: true })
    }
  })

  it('A-root3. relative typesOutputFile resolves against resolvedConfig.root', async () => {
    fs.mkdirSync(path.join(tmpRoot, 'public'))
    fs.writeFileSync(path.join(tmpRoot, 'public', 'logo.png'), 'x')

    const plugin = staticAssetsPlugin({
      directory: 'public',
      typesOutputFile: 'types/x.d.ts',
    })

    await runHooks(plugin, { root: tmpRoot })

    const expected = path.join(tmpRoot, 'types', 'x.d.ts')
    expect(fs.existsSync(expected)).toBe(true)
    // And NOT at unrelatedCwd/types/x.d.ts (which would be the buggy fallback).
    expect(fs.existsSync(path.join(unrelatedCwd, 'types', 'x.d.ts'))).toBe(false)
    const content = fs.readFileSync(expected, 'utf8')
    expect(content).toContain('"logo.png"')
  })
})

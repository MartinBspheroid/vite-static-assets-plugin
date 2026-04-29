/**
 * Wave 1D: validateAssetReferences regex behavior.
 * Pins every match path: legitimate calls, false positives we accept, false
 * negatives we accept. Each assertion captures the current behavior; future
 * regex tightening should land alongside test updates here.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import staticAssetsPlugin, { validateAssetReferences } from '../src/index'

const FILES = new Set(['logo.png', 'icons/arrow.svg'])
const DIR = '/proj/public'

function check(code: string, id = '/proj/src/App.tsx') {
  return validateAssetReferences(code, id, FILES, DIR)
}

describe('happy path', () => {
  it('D-base. valid call passes', () => {
    expect(check(`staticAssets('logo.png')`)).toBeNull()
  })

  it('D11. multi-line whitespace allowed', () => {
    expect(check(`staticAssets(\n  'logo.png'\n)`)).toBeNull()
  })

  it('D12. mixed quotes allowed (single + double)', () => {
    expect(check(`staticAssets("logo.png")`)).toBeNull()
    expect(check(`staticAssets('logo.png')`)).toBeNull()
  })

  it('D5. multi-call, all valid', () => {
    expect(check(`staticAssets('logo.png'); staticAssets('icons/arrow.svg')`)).toBeNull()
  })
})

describe('failures', () => {
  it('D-fail. missing asset is reported', () => {
    const err = check(`staticAssets('does-not-exist.png')`)
    expect(err).not.toBeNull()
    expect(err).toContain('does-not-exist.png')
    expect(err).toContain('Asset not found')
  })

  it('D5b. multi-call, second one bad — reports the bad one', () => {
    const err = check(`staticAssets('logo.png'); staticAssets('missing.png')`)
    expect(err).not.toBeNull()
    expect(err).toContain('missing.png')
  })
})

describe('false positives (known limitations — pin behavior)', () => {
  it('D1. obj.staticAssets() is NOT distinguished from the import', () => {
    // The regex matches any `staticAssets(...)` token regardless of context.
    // Document the limitation; if a fix tightens the regex, update this test.
    const err = check(`const obj = { staticAssets(p) { return p } }; obj.staticAssets('not-a-real.png')`)
    expect(err).not.toBeNull()
    expect(err).toContain('not-a-real.png')
  })

  it('D9. call inside a comment is flagged (false positive)', () => {
    const err = check(`// staticAssets('phantom.png')`)
    expect(err).not.toBeNull()
    expect(err).toContain('phantom.png')
  })

  it('D10. call inside a string literal is flagged (false positive)', () => {
    const err = check(`const s = "staticAssets('phantom.png')"`)
    expect(err).not.toBeNull()
    expect(err).toContain('phantom.png')
  })
})

describe('false negatives (known limitations — pin behavior)', () => {
  it('D2. alias bypass: const fn = staticAssets; fn(...)', () => {
    expect(check(`const fn = staticAssets; fn('not-a-real.png')`)).toBeNull()
  })

  it('D3. non-literal arg (string concatenation) is not validated', () => {
    expect(check(`staticAssets('icons/' + 'arrow.svg')`)).toBeNull()
  })

  it('D4. template literal arg is not matched (regex only allows quoted strings)', () => {
    expect(check('staticAssets(`logo.png`)')).toBeNull()
    expect(check('staticAssets(`missing.png`)')).toBeNull()
  })
})

/**
 * Bug B2: transform-hook extension regex required `$` end-of-string, so Vite's
 * SFC sub-block ids with query strings (App.vue?vue&type=template,
 * +page.svelte?svelte&type=script&lang.ts, foo.tsx?virtual) silently bypassed
 * validation. Fix strips the query before extension matching.
 *
 * These tests instantiate the plugin and call transform directly so we
 * exercise the id-filter logic, not just validateAssetReferences.
 */
describe('B2: transform hook handles ids with query strings', () => {
  let testDir: string
  let prevCwd: string
  let plugin: ReturnType<typeof staticAssetsPlugin>

  beforeEach(async () => {
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsap-b2-'))
    prevCwd = process.cwd()
    process.chdir(testDir)
    const publicDir = path.join(testDir, 'public')
    fs.mkdirSync(publicDir, { recursive: true })
    fs.writeFileSync(path.join(publicDir, 'logo.png'), 'x')

    plugin = staticAssetsPlugin({
      directory: publicDir,
      typesOutputFile: path.join(testDir, 'static-assets.d.ts'),
    })
    const buildStart = (plugin as any).buildStart as () => Promise<void>
    await buildStart.call({})
  })

  afterEach(() => {
    process.chdir(prevCwd)
    fs.rmSync(testDir, { recursive: true, force: true })
  })

  it('B2.1. flags missing asset inside Vue <template> sub-block (id ends in ?vue&type=template)', () => {
    const transform = (plugin as any).transform as Function
    expect(() =>
      transform.call(
        {},
        `staticAssets('missing.png')`,
        '/proj/App.vue?vue&type=template',
      ),
    ).toThrow(/missing\.png/)
  })

  it('B2.2. flags missing asset inside Svelte script sub-block (id ends in &lang.ts)', () => {
    const transform = (plugin as any).transform as Function
    expect(() =>
      transform.call(
        {},
        `staticAssets('missing.png')`,
        '/proj/+page.svelte?svelte&type=script&lang.ts',
      ),
    ).toThrow(/missing\.png/)
  })

  it('B2.3. flags missing asset in plain .tsx with virtual query (id ends in ?virtual)', () => {
    const transform = (plugin as any).transform as Function
    expect(() =>
      transform.call(
        {},
        `staticAssets('missing.png')`,
        '/proj/foo.tsx?virtual',
      ),
    ).toThrow(/missing\.png/)
  })

  it("B2.4. plugin's own resolved virtual id (\\0virtual:static-assets) is still skipped", () => {
    const transform = (plugin as any).transform as Function
    // Even with a missing-asset reference, the virtual id short-circuits.
    const result = transform.call(
      {},
      `staticAssets('missing.png')`,
      '\0virtual:static-assets',
    )
    expect(result).toBeNull()
  })

  it("B2.5. other plugins' virtual ids (\\0-prefixed) are also skipped", () => {
    const transform = (plugin as any).transform as Function
    const result = transform.call(
      {},
      `staticAssets('missing.png')`,
      '\0some-other-plugin:virtual.tsx',
    )
    expect(result).toBeNull()
  })
})

/**
 * Bug B11: validator regex /['"]([^'"]+)['"]/  didn't track which quote
 * opened the literal. staticAssets('it\\'s.png') captured 'it' (regex stopped
 * at the escaped quote), then reported 'it' as the missing asset.
 * Fix uses two alternations (one per quote style) with proper escape
 * handling, and unescapes the captured value before lookup.
 */
describe('B11: validator handles escaped quotes inside the asset literal', () => {
  it("B11.1. single-quoted with escaped \\' resolves to a present asset (no error)", () => {
    const files = new Set(["it's.png"])
    expect(
      validateAssetReferences(
        `staticAssets('it\\'s.png')`,
        '/proj/src/App.tsx',
        files,
        DIR,
      ),
    ).toBeNull()
  })

  it("B11.2. single-quoted with escaped \\' reports the unescaped name when missing", () => {
    const files = new Set(['logo.png'])
    const err = validateAssetReferences(
      `staticAssets('it\\'s.png')`,
      '/proj/src/App.tsx',
      files,
      DIR,
    )
    expect(err).not.toBeNull()
    // The unescaped name should appear in the error, not the truncated 'it'.
    expect(err).toContain("it's.png")
    // Sanity: we should NOT have stopped at the escape and reported 'it'.
    expect(err).not.toMatch(/Static asset:[^\n]*\bit\b(?!')/)
  })

  it('B11.3. double-quoted with escaped \\" handles the inner double quotes', () => {
    const files = new Set(['she said "hi"'])
    expect(
      validateAssetReferences(
        `staticAssets("she said \\"hi\\"")`,
        '/proj/src/App.tsx',
        files,
        DIR,
      ),
    ).toBeNull()

    const missing = new Set(['logo.png'])
    const err = validateAssetReferences(
      `staticAssets("she said \\"hi\\"")`,
      '/proj/src/App.tsx',
      missing,
      DIR,
    )
    expect(err).not.toBeNull()
    expect(err).toContain('she said "hi"')
  })
})

/**
 * Wave 1B: Type generation correctness.
 * For each fixture: dts must contain expected literal AND tsc --noEmit must
 * accept the dts plus a representative consumer snippet.
 */
import { describe, it, expect } from 'vitest'
import { generateDtsCode, generateVirtualModuleCode, extractDirectories } from '../src/index'
import { assertDtsTypechecks, assertVirtualModuleParses } from './helpers'

const VIRTUAL_REF = `/// <reference path="./virtual-static-assets.d.ts" />\n`

describe('special-character filenames', () => {
  it('B1. spaces in filename produce valid TS literal', () => {
    const dts = generateDtsCode(['my file.png'])
    expect(dts).toContain('"my file.png"')
    const tc = assertDtsTypechecks(
      dts,
      `${VIRTUAL_REF}import { staticAssets } from 'virtual:static-assets'\nstaticAssets('my file.png')`,
    )
    expect(tc.ok, tc.output).toBe(true)
  })

  it('B2. unicode (kanji) filename round-trips', () => {
    const dts = generateDtsCode(['日本.png'])
    expect(dts).toContain('"日本.png"')
    const tc = assertDtsTypechecks(
      dts,
      `${VIRTUAL_REF}import { staticAssets } from 'virtual:static-assets'\nstaticAssets('日本.png')`,
    )
    expect(tc.ok, tc.output).toBe(true)
  })

  it('B7. capital extensions preserved verbatim', () => {
    const dts = generateDtsCode(['LOGO.PNG', 'icon.SVG'])
    expect(dts).toContain('"LOGO.PNG"')
    expect(dts).toContain('"icon.SVG"')
    const tc = assertDtsTypechecks(
      dts,
      `${VIRTUAL_REF}import { staticAssets } from 'virtual:static-assets'\nstaticAssets('LOGO.PNG'); staticAssets('icon.SVG')`,
    )
    expect(tc.ok, tc.output).toBe(true)
  })

  it('B8. multi-dot filenames preserved', () => {
    const dts = generateDtsCode(['archive.tar.gz', 'vue.shim.d.ts'])
    expect(dts).toContain('"archive.tar.gz"')
    expect(dts).toContain('"vue.shim.d.ts"')
  })
})

describe('union shape', () => {
  it('B9. zero-asset union resolves to never; staticAssets call rejects', () => {
    const dts = generateDtsCode([])
    expect(dts).toMatch(/StaticAssetPath\s*=\s*\n\s*never/)
    // A consumer trying to call staticAssets('anything') must fail typecheck.
    const tc = assertDtsTypechecks(
      dts,
      `${VIRTUAL_REF}import { staticAssets } from 'virtual:static-assets'\nstaticAssets('logo.png')`,
    )
    expect(tc.ok).toBe(false)
    expect(tc.output).toMatch(/Argument of type/)
  })

  it('B10. single-asset union has no leading pipe', () => {
    const dts = generateDtsCode(['only.png'])
    // Match the exact union: "    \"only.png\";" with no '|' before it.
    expect(dts).toMatch(/StaticAssetPath\s*=\s*\n\s*"only\.png";/)
  })

  it('B11. depth beyond maxDirectoryDepth: full file path kept, dirs truncated', () => {
    const files = ['a/b/c/d/e/f/g/h/file.png']
    const dts = generateDtsCode(files, { enableDirectoryTypes: true, maxDirectoryDepth: 5 })
    // File path is kept in StaticAssetPath at full depth.
    expect(dts).toContain('"a/b/c/d/e/f/g/h/file.png"')
    // Directory union truncates to 5 levels.
    expect(dts).toContain('"a/b/c/d/e/"')
    expect(dts).not.toContain('"a/b/c/d/e/f/"')
  })

  it('B14. directory containing only ignored files does not surface in StaticAssetDirectory', () => {
    // Ignored files never reach generateDtsCode in real plugin flow; simulate
    // by simply not including them. Verify that an empty subtree leaves no dir.
    const files = ['logo.png']
    const dts = generateDtsCode(files, { enableDirectoryTypes: true })
    // Only '.' should be in the directory union (root).
    expect(dts).toMatch(/StaticAssetDirectory\s*=\s*\n\s*"\.";/)
  })

  it('B15. hidden file (.well-known/keys.json) appears in union when not ignored', () => {
    const dts = generateDtsCode(['.well-known/keys.json'])
    expect(dts).toContain('".well-known/keys.json"')
  })

  it('B19. sort order is lexicographic by default Array.sort', () => {
    // Pin exact ordering: capital before lowercase before non-ASCII.
    const dts = generateDtsCode(['B.png', 'a.png', 'À.png'])
    const idxB = dts.indexOf('"B.png"')
    const idxA = dts.indexOf('"a.png"')
    const idxAccented = dts.indexOf('"À.png"')
    expect(idxB).toBeGreaterThan(-1)
    expect(idxA).toBeGreaterThan(-1)
    expect(idxAccented).toBeGreaterThan(-1)
    // ASCII 'B' (66) < 'a' (97) < 'À' (192)
    expect(idxB).toBeLessThan(idxA)
    expect(idxA).toBeLessThan(idxAccented)
  })
})

describe('virtual module parse-correctness', () => {
  it('virtual module always parses as ESM (acorn ecmaVersion 2022)', () => {
    const samples = [
      [],
      ['a.png'],
      ["it's.png", 'weird\\path.png', '日本.png', '$tab\t.png'],
      ['logo.png', 'icons/sun/sunny.svg', 'images/banner.jpg'],
    ]
    for (const fixture of samples) {
      const code = generateVirtualModuleCode(fixture)
      const result = assertVirtualModuleParses(code)
      expect(result.ok, `parse failed for ${JSON.stringify(fixture)}: ${result.error}`).toBe(true)
    }
  })
})

describe('extractDirectories invariants (regression)', () => {
  it('produces empty set for files-only-at-root input', () => {
    const dirs = extractDirectories(['logo.png', 'banner.jpg'])
    expect(dirs.size).toBe(1)
    expect(dirs.has('.')).toBe(true)
  })
})

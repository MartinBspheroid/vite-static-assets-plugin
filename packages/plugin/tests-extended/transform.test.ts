/**
 * Wave 1D: validateAssetReferences regex behavior.
 * Pins every match path: legitimate calls, false positives we accept, false
 * negatives we accept. Each assertion captures the current behavior; future
 * regex tightening should land alongside test updates here.
 */
import { describe, it, expect } from 'vitest'
import { validateAssetReferences } from '../src/index'

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

describe('directory validation', () => {
  it('D14. staticAssetsFromDir errors on empty dir when allowEmptyDirectories=false', () => {
    const err = validateAssetReferences(
      `staticAssetsFromDir('phantom-dir/')`,
      '/proj/src/App.tsx',
      FILES,
      DIR,
    )
    expect(err).not.toBeNull()
    expect(err).toContain('phantom-dir')
    expect(err).toContain('empty or does not exist')
  })

  it('D14b. allowEmptyDirectories: true silences the check', () => {
    expect(
      validateAssetReferences(
        `staticAssetsFromDir('phantom-dir/')`,
        '/proj/src/App.tsx',
        FILES,
        DIR,
        { allowEmptyDirectories: true },
      ),
    ).toBeNull()
  })

  it('D14c. enableDirectoryTypes: false skips dir validation entirely', () => {
    expect(
      validateAssetReferences(
        `staticAssetsFromDir('phantom-dir/')`,
        '/proj/src/App.tsx',
        FILES,
        DIR,
        { enableDirectoryTypes: false },
      ),
    ).toBeNull()
  })

  it('D14d. dir with assets passes validation', () => {
    expect(
      validateAssetReferences(
        `staticAssetsFromDir('icons/')`,
        '/proj/src/App.tsx',
        FILES,
        DIR,
      ),
    ).toBeNull()
  })
})

/**
 * Wave 1E: error message format.
 * Pin the exact text users see (after ANSI stripping) so changes don't
 * silently regress error UX.
 */
import { describe, it, expect, vi } from 'vitest'
import stripAnsi from 'strip-ansi'
import staticAssetsPlugin, { validateAssetReferences } from '../src/index'

const FILES = new Set(['logo.png', 'icons/arrow.svg'])

describe('error formats', () => {
  it('H1. missing-asset error has asset name, file ref, dir ref, and suggestion', () => {
    const err = validateAssetReferences(
      `staticAssets('does-not-exist.png')`,
      '/proj/src/App.tsx',
      FILES,
      '/proj/public',
    )
    expect(err).not.toBeNull()
    const stripped = stripAnsi(err as string)
    expect(stripped).toContain('Static asset:')
    expect(stripped).toContain('does-not-exist.png')
    expect(stripped).toContain('Referenced in:')
    expect(stripped).toContain('Asset not found in scanned directory:')
    expect(stripped).toContain('Please ensure the asset exists and the path is correct.')
  })

  it('H3. empty-directory error mentions allowEmptyDirectories suggestion', () => {
    const err = validateAssetReferences(
      `staticAssetsFromDir('phantom/')`,
      '/proj/src/App.tsx',
      FILES,
      '/proj/public',
    )
    expect(err).not.toBeNull()
    const stripped = stripAnsi(err as string)
    expect(stripped).toContain('Static asset directory:')
    expect(stripped).toContain('phantom')
    expect(stripped).toContain('empty or does not exist')
    expect(stripped).toContain("'allowEmptyDirectories: true'")
  })

  it('H5. only the FIRST missing asset is reported (current limitation)', () => {
    // The function returns on first miss. Document that subsequent missing
    // refs in the same file aren't all surfaced in one pass.
    const err = validateAssetReferences(
      `staticAssets('first-missing.png'); staticAssets('second-missing.png')`,
      '/proj/src/App.tsx',
      FILES,
      '/proj/public',
    )
    const stripped = stripAnsi(err as string)
    expect(stripped).toContain('first-missing.png')
    expect(stripped).not.toContain('second-missing.png')
  })

  it('H-deprecation. addLeadingSlash deprecation warning text', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    staticAssetsPlugin({ addLeadingSlash: true })
    const captured = warn.mock.calls.flat().join(' ')
    expect(stripAnsi(captured)).toContain("'addLeadingSlash' is deprecated")
    expect(stripAnsi(captured)).toContain('import.meta.env.BASE_URL')
    warn.mockRestore()
  })
})

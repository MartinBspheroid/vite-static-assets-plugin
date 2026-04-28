/**
 * Wave 1C: staticAssets() runtime behavior.
 * Evaluates the generated virtual module via the Function ctor and exercises
 * its exported function across happy and error paths.
 */
import { describe, it, expect } from 'vitest'
import { generateVirtualModuleCode } from '../src/index'
import { evalVirtualModule } from './helpers'

const FILES = ['logo.png', 'icons/arrow.svg', 'icons/sun/sun.svg', 'Logo.png']

describe('staticAssets runtime', () => {
  it('C1. valid path returns BASE_URL + path', () => {
    const { staticAssets } = evalVirtualModule(generateVirtualModuleCode(FILES), '/')
    expect(staticAssets('logo.png')).toBe('/logo.png')
  })

  it('C1b. honors the configured base URL', () => {
    const { staticAssets } = evalVirtualModule(generateVirtualModuleCode(FILES), '/sub/')
    expect(staticAssets('icons/arrow.svg')).toBe('/sub/icons/arrow.svg')
  })

  it('C2. missing path throws with informative message', () => {
    const { staticAssets } = evalVirtualModule(generateVirtualModuleCode(FILES), '/')
    expect(() => staticAssets('does-not-exist.png')).toThrow(/does not exist/)
  })

  it('C3. empty string throws', () => {
    const { staticAssets } = evalVirtualModule(generateVirtualModuleCode(FILES), '/')
    expect(() => staticAssets('')).toThrow()
  })

  it('C4. leading slash throws (paths are relative)', () => {
    const { staticAssets } = evalVirtualModule(generateVirtualModuleCode(FILES), '/')
    expect(() => staticAssets('/logo.png')).toThrow()
  })

  it('C5. path traversal does not resolve to a real asset', () => {
    const { staticAssets } = evalVirtualModule(generateVirtualModuleCode(FILES), '/')
    expect(() => staticAssets('../etc/passwd')).toThrow()
  })

  it('C6. directory name (with or without trailing slash) is not a file', () => {
    const { staticAssets } = evalVirtualModule(generateVirtualModuleCode(FILES), '/')
    expect(() => staticAssets('icons')).toThrow()
    expect(() => staticAssets('icons/')).toThrow()
  })

  it('C7. trailing slash on a real file is rejected', () => {
    const { staticAssets } = evalVirtualModule(generateVirtualModuleCode(FILES), '/')
    expect(() => staticAssets('logo.png/')).toThrow()
  })

  it('C8. assets are case-sensitive', () => {
    const { staticAssets } = evalVirtualModule(generateVirtualModuleCode(FILES), '/')
    // Both Logo.png and logo.png exist; both resolve to themselves.
    expect(staticAssets('Logo.png')).toBe('/Logo.png')
    expect(staticAssets('logo.png')).toBe('/logo.png')
    // A case-only typo against an absent variant throws.
    expect(() => staticAssets('LOGO.PNG')).toThrow()
  })
})

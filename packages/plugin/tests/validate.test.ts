import { describe, it, expect } from 'vitest';
import { validateAssetReferences } from '../src/index';

describe('validateAssetReferences', () => {
  const directory = '/project/public';
  const knownFiles = new Set(['logo.png', 'icons/arrow.svg', 'fonts/roboto.woff2']);

  it('should return null for valid asset references', () => {
    const code = `
      import { staticAssets } from 'virtual:static-assets';
      const url = staticAssets('logo.png');
    `;
    const result = validateAssetReferences(code, '/project/src/App.tsx', knownFiles, directory);
    expect(result).toBeNull();
  });

  it('should return error for missing asset reference', () => {
    const code = `const url = staticAssets('missing.png');`;
    const result = validateAssetReferences(code, '/project/src/App.tsx', knownFiles, directory);
    expect(result).not.toBeNull();
    expect(result).toContain('missing.png');
  });

  it('should handle multiple references with one missing', () => {
    const code = `
      const a = staticAssets('logo.png');
      const b = staticAssets('nonexistent.jpg');
    `;
    const result = validateAssetReferences(code, '/project/src/App.tsx', knownFiles, directory);
    expect(result).not.toBeNull();
    expect(result).toContain('nonexistent.jpg');
  });

  it('should handle double-quoted strings', () => {
    const code = `const url = staticAssets("logo.png");`;
    const result = validateAssetReferences(code, '/project/src/App.tsx', knownFiles, directory);
    expect(result).toBeNull();
  });

  it('should handle whitespace variations', () => {
    const code = `const url = staticAssets(  'logo.png'  );`;
    const result = validateAssetReferences(code, '/project/src/App.tsx', knownFiles, directory);
    expect(result).toBeNull();
  });

  it('should return null when no staticAssets calls exist', () => {
    const code = `const x = 42; console.log('hello');`;
    const result = validateAssetReferences(code, '/project/src/App.tsx', knownFiles, directory);
    expect(result).toBeNull();
  });
});

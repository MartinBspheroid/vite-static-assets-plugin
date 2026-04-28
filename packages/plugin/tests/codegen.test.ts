import { describe, it, expect } from 'vitest';
import { generateVirtualModuleCode, generateDtsCode } from '../src/index';

describe('generateVirtualModuleCode', () => {
  it('should generate code with import.meta.env.BASE_URL', () => {
    const code = generateVirtualModuleCode(['image.png', 'icons/logo.svg']);

    expect(code).toContain('import.meta.env.BASE_URL');
    expect(code).not.toContain('BASE_PATH');
    expect(code).toContain('"image.png"');
    expect(code).toContain('"icons/logo.svg"');
    expect(code).toContain('new Set(');
    expect(code).toContain('export function staticAssets');
  });

  it('should sort files alphabetically', () => {
    const code = generateVirtualModuleCode(['z.txt', 'a.txt', 'm.txt']);
    const aIndex = code.indexOf('"a.txt"');
    const mIndex = code.indexOf('"m.txt"');
    const zIndex = code.indexOf('"z.txt"');

    expect(aIndex).toBeLessThan(mIndex);
    expect(mIndex).toBeLessThan(zIndex);
  });

  it('should handle empty file list', () => {
    const code = generateVirtualModuleCode([]);

    expect(code).toContain('new Set([');
    expect(code).toContain('export function staticAssets');
  });
});

describe('generateDtsCode', () => {
  it('should wrap types in declare module', () => {
    const code = generateDtsCode(['image.png']);

    expect(code).toContain("declare module 'virtual:static-assets'");
    expect(code).toContain('export type StaticAssetPath');
    expect(code).toContain('export function staticAssets');
  });

  it('should generate StaticAssetPath union type', () => {
    const files = ['image.png', 'doc.pdf', 'sub/file.txt'];
    const code = generateDtsCode(files, { enableDirectoryTypes: true });

    expect(code).toContain('"doc.pdf"');
    expect(code).toContain('"image.png"');
    expect(code).toContain('"sub/file.txt"');
  });

  it('should generate directory types when enabled', () => {
    const files = ['image.png', 'sub/file.txt', 'sub/nested/deep.txt'];
    const code = generateDtsCode(files, { enableDirectoryTypes: true });

    expect(code).toContain('export type StaticAssetDirectory');
    expect(code).toContain('"sub/"');
    expect(code).toContain('"sub/nested/"');
    expect(code).toContain('"."'); // root has image.png
    expect(code).toContain('export type FilesInFolder');
  });

  it('should omit directory types when disabled', () => {
    const files = ['image.png', 'sub/file.txt'];
    const code = generateDtsCode(files, { enableDirectoryTypes: false });

    expect(code).not.toContain('StaticAssetDirectory');
    expect(code).not.toContain('FilesInFolder');
  });

  it('should use never for empty file list', () => {
    const code = generateDtsCode([]);
    expect(code).toContain('never');
  });

  it('should respect maxDirectoryDepth', () => {
    const files = ['a/b/c/d/e/deep.txt'];
    const code = generateDtsCode(files, { enableDirectoryTypes: true, maxDirectoryDepth: 2 });

    expect(code).toContain('"a/"');
    expect(code).toContain('"a/b/"');
    expect(code).not.toContain('"a/b/c/"');
  });

  it('should escape special characters in filenames (apostrophe)', () => {
    const code = generateDtsCode(["it's.png"]);
    // Bug fix: previously emitted invalid TS literal `'it's.png'`. Now uses
    // JSON.stringify which produces `"it's.png"` (TS allows double-quoted
    // string literal types).
    expect(code).toContain('"it\'s.png"');
  });

  it('should escape backslashes in filenames', () => {
    const code = generateDtsCode(['weird\\path.png']);
    // JSON.stringify escapes the backslash so the emitted token is `"weird\\path.png"`.
    expect(code).toContain('"weird\\\\path.png"');
  });

  it('should escape special characters in virtual module code (apostrophe)', () => {
    const code = generateVirtualModuleCode(["it's.png"]);
    expect(code).toContain('"it\'s.png"');
  });

  it('should escape special characters in directory literals', () => {
    const code = generateDtsCode(["it's/file.png"]);
    // Directory literal must also be properly escaped.
    expect(code).toContain('"it\'s/"');
  });
});

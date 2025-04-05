import { describe, it, expect } from 'vitest';
import { generateTypeScriptCode } from '../src/index';

describe('generateTypeScriptCode', () => {
  it('should generate correct type definitions with files and directory types', () => {
    const files = ['image.png', 'document.pdf', 'subdir/file.txt', 'subdir/nested/file2.txt'];
    const directory = 'public';
    const basePath = '/';
    const options = {
      enableDirectoryTypes: true,
      maxDirectoryDepth: 5,
    };

    const result = generateTypeScriptCode(files, directory, basePath, options);

    expect(result).toContain('export type StaticAssetPath =');
    expect(result).toContain("'image.png'");
    expect(result).toContain("'document.pdf'");
    expect(result).toContain("'subdir/file.txt'");
    expect(result).toContain("'subdir/nested/file2.txt'");
    expect(result).toContain('const assets = new Set<string>([');
    expect(result).toContain('export function staticAssets');
    expect(result).toContain('const BASE_PATH = "/";');

    // Directory types and helpers
    expect(result).toContain('export type StaticAssetDirectory');
    expect(result).toContain('export function directoryExists');
    expect(result).toContain('export function staticAssetsFromDir');

    // Directory type should include subdirectories up to max depth
    expect(result).toContain("'subdir/'");
    expect(result).toContain("'subdir/nested/'");
  });

  it('should generate correct type definitions with no files', () => {
    const files: string[] = [];
    const directory = 'public';
    const basePath = '/';
    const options = {};

    const result = generateTypeScriptCode(files, directory, basePath, options);

    expect(result).toContain('export type StaticAssetPath =');
    expect(result).toContain('never');
    expect(result).toContain('const assets = new Set<string>([');
    expect(result).toContain('export function staticAssets');

    const setDeclaration = result.match(/const assets = new Set<string>\(\[\s*([\s\S]*?)\s*\]\);/)?.[1] || '';
    expect(setDeclaration.trim()).toBe('');
  });

  it('should use custom base path', () => {
    const files = ['image.png'];
    const directory = 'public';
    const basePath = '/my-app/';
    const options = {};

    const result = generateTypeScriptCode(files, directory, basePath, options);

    expect(result).toContain('const BASE_PATH = "/my-app/";');
  });

  it('should include the directory in error message', () => {
    const files = ['image.png'];
    const directory = 'custom-assets';
    const basePath = '/';
    const options = {};

    const result = generateTypeScriptCode(files, directory, basePath, options);

    expect(result).toContain(`does not exist in ${directory} directory`);
  });

  it('should omit directory types and helpers if disabled', () => {
    const files = ['a.png', 'dir/file.png'];
    const directory = 'public';
    const basePath = '/';
    const options = {
      enableDirectoryTypes: false,
    };

    const result = generateTypeScriptCode(files, directory, basePath, options);

    expect(result).not.toContain('export type StaticAssetDirectory');
    expect(result).not.toContain('export function directoryExists');
    expect(result).not.toContain('export function staticAssetsFromDir');
  });
});

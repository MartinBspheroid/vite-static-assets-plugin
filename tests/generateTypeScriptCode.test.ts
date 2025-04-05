import { describe, it, expect } from 'vitest';
import { generateTypeScriptCode } from '../src/index';

describe('generateTypeScriptCode', () => {
  it('should generate correct type definitions with files', () => {
    const files = ['image.png', 'document.pdf', 'subdirectory/file.txt'];
    const directory = 'public';
    const basePath = '/';
    
    const result = generateTypeScriptCode(files, directory, basePath);
    
    // Check that the result contains expected parts
    expect(result).toContain('export type StaticAssetPath =');
    expect(result).toContain("'image.png'");
    expect(result).toContain("'document.pdf'");
    expect(result).toContain("'subdirectory/file.txt'");
    expect(result).toContain('const assets = new Set<string>([');
    expect(result).toContain('export function staticAssets');
    expect(result).toContain('const BASE_PATH = "/";');
    
    // Verify that the StaticAssetPath type has all file paths
    const typeDeclaration = result.match(/export type StaticAssetPath =\s*([\s\S]*?);/)?.[1] || '';
    files.forEach(file => {
      expect(typeDeclaration).toContain(`'${file}'`);
    });
    
    // Verify that the Set has all file paths
    const setDeclaration = result.match(/const assets = new Set<string>\(\[\s*([\s\S]*?)\s*\]\);/)?.[1] || '';
    files.forEach(file => {
      expect(setDeclaration).toContain(`'${file}'`);
    });
  });
  
  it('should generate correct type definitions with no files', () => {
    const files: string[] = [];
    const directory = 'public';
    const basePath = '/';
    
    const result = generateTypeScriptCode(files, directory, basePath);
    
    // Check that result contains the expected parts for empty files array
    expect(result).toContain('export type StaticAssetPath =');
    expect(result).toContain('never');
    expect(result).toContain('const assets = new Set<string>([');
    expect(result).toContain('export function staticAssets');
    
    // No files in the Set declaration
    const setDeclaration = result.match(/const assets = new Set<string>\(\[\s*([\s\S]*?)\s*\]\);/)?.[1] || '';
    expect(setDeclaration.trim()).toBe('');
  });
  
  it('should use custom base path', () => {
    const files = ['image.png'];
    const directory = 'public';
    const basePath = '/my-app/';
    
    const result = generateTypeScriptCode(files, directory, basePath);
    
    expect(result).toContain('const BASE_PATH = "/my-app/";');
  });
  
  it('should include the directory in error message', () => {
    const files = ['image.png'];
    const directory = 'custom-assets';
    const basePath = '/';
    
    const result = generateTypeScriptCode(files, directory, basePath);
    
    expect(result).toContain(`does not exist in ${directory} directory`);
  });
});

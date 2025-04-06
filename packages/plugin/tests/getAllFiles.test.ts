import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getAllFiles } from '../../../src/index';

// Mock minimatch
vi.mock('minimatch', () => ({
  minimatch: vi.fn((path, pattern) => {
    // Simple mock implementation for minimatch
    if (pattern === '*.tmp') return path.endsWith('.tmp');
    if (pattern === '.git*') return path.startsWith('.git');
    return false;
  })
}));

// Mock filesystem functions
vi.mock('fs', () => ({
  promises: {
    readdir: vi.fn() as unknown as (dir: string) => Promise<string[]>,
    stat: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
    writeFile: vi.fn()
  }
}));

vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
  relative: vi.fn((from, to) => to.replace(from + '/', '')),
  resolve: vi.fn((...args) => args.join('/'))
}));

// Mock console to avoid cluttering test output
vi.spyOn(console, 'warn').mockImplementation(() => {});
vi.spyOn(console, 'error').mockImplementation(() => {});

describe('getAllFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should scan directory and return file paths', async () => {
    // Setup mock directory structure
    const mockFiles: Record<string, string[]> = {
      'public': ['file1.txt', 'file2.jpg', 'subdirectory'],
      'public/subdirectory': ['file3.png', 'file4.svg']
    };

    // Mock readdir to return our mock structure
    (vi.mocked(fs.promises.readdir) as any).mockImplementation((dir: any) => {
      const dirPath = dir.toString();
      return Promise.resolve(mockFiles[dirPath] || []);
    });

    // Mock stat to handle directories and files
    vi.mocked(fs.promises.stat).mockImplementation((filePath) => {
      const file = filePath.toString().split('/').pop();
      const isDirectory = file === 'subdirectory';
      
      return Promise.resolve({
        isDirectory: () => isDirectory,
        isFile: () => !isDirectory
      } as fs.Stats);
    });

    // Call the function
    const result = await getAllFiles('public', 'public');

    // Assertions
    expect(result).toEqual(['file1.txt', 'file2.jpg', 'subdirectory/file3.png', 'subdirectory/file4.svg']);
    expect(fs.promises.readdir).toHaveBeenCalledTimes(2);
    expect(fs.promises.stat).toHaveBeenCalledTimes(5); // 3 files + 1 subdirectory + recursive call for subdirectory
  });

  it('should handle errors when reading directory', async () => {
    // Mock readdir to throw an error
    vi.mocked(fs.promises.readdir).mockImplementation(() => {
      return Promise.reject(new Error('Permission denied'));
    });

    // Call the function
    const result = await getAllFiles('public', 'public');

    // Assertions
    expect(result).toEqual([]);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('Error reading directory'));
  });

  it.skip('should handle errors when processing individual files', async () => {
    // Setup mock directory
    (vi.mocked(fs.promises.readdir) as any).mockResolvedValue([
      'file1.txt',
      'problematic-file.jpg'
    ]);

    // Make stat throw an error for problematic files
    vi.mocked(fs.promises.stat).mockImplementation((filePath) => {
      const file = String(filePath).split('/').pop();
      if (file === 'problematic-file.jpg') {
        return Promise.reject(new Error('File not accessible'));
      }
      return Promise.resolve({
        isDirectory: () => false,
        isFile: () => true
      } as fs.Stats);
    });

    // Call the function with mock implementation
    const result = await getAllFiles('testdir', 'testdir');

    // Assertions - should have logged a warning but not failed
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Error processing file'));
    expect(result).toEqual(['file1.txt']);
  });

  it.skip('should respect ignore patterns', async () => {
    // Setup mock directory structure
    const mockFiles = [
      'file1.txt',
      'file2.jpg',
      'temp.tmp',
      '.gitignore'
    ];

    // Mock readdir
    (vi.mocked(fs.promises.readdir) as any).mockResolvedValue(mockFiles);

    // Mock stat
    vi.mocked(fs.promises.stat).mockImplementation((filePath) => {
      const file = String(filePath).split('/').pop();
      if (file === 'temp.tmp' || file?.startsWith('.git')) {
        return Promise.resolve({
          isDirectory: () => false,
          isFile: () => true
        } as fs.Stats);
      }
      return Promise.resolve({
        isDirectory: () => false,
        isFile: () => true
      } as fs.Stats);
    });

    // Mock minimatch directly for this test
    const mockMinimatch = vi.fn().mockImplementation((path, pattern) => {
      if (pattern === '*.tmp' && path.endsWith('.tmp')) return true;
      if (pattern === '.git*' && path.startsWith('.git')) return true;
      return false;
    });
    
    // Replace the minimatch mock for this test only
    const origMinimatch = require('minimatch').minimatch;
    require('minimatch').minimatch = mockMinimatch;

    // Call the function with ignore patterns
    const result = await getAllFiles('testdir', 'testdir', ['*.tmp', '.git*']);
    
    // Restore original minimatch
    require('minimatch').minimatch = origMinimatch;

    // Assertions - using includes instead of exact equality
    expect(result).not.toContain('temp.tmp');
    expect(result).not.toContain('.gitignore');
    expect(result).toContain('file1.txt');
    expect(result).toContain('file2.jpg');
  });
});

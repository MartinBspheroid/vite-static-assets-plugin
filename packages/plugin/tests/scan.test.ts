import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import picomatch from 'picomatch';
import { getAllFiles, extractDirectories } from '../src/index';

describe('getAllFiles', () => {
  const testDir = path.resolve(process.cwd(), 'temp-test-dir');
  const subDir = path.join(testDir, 'subdirectory');
  const nestedDir = path.join(subDir, 'nested');

  beforeEach(() => {
    fs.mkdirSync(nestedDir, { recursive: true });
    fs.writeFileSync(path.join(testDir, 'file1.txt'), 'content');
    fs.writeFileSync(path.join(testDir, 'file2.jpg'), 'content');
    fs.writeFileSync(path.join(subDir, 'file3.png'), 'content');
    fs.writeFileSync(path.join(nestedDir, 'deep.svg'), 'content');
    fs.writeFileSync(path.join(testDir, '.DS_Store'), 'junk');
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should scan directory and return all files', async () => {
    const isIgnored = picomatch(['.DS_Store'], { dot: true });
    const files = await getAllFiles(testDir, testDir, isIgnored);

    expect(files).toContain('file1.txt');
    expect(files).toContain('file2.jpg');
    expect(files).toContain('subdirectory/file3.png');
    expect(files).toContain('subdirectory/nested/deep.svg');
    expect(files).not.toContain('.DS_Store');
  });

  it('should return normalized forward-slash paths', async () => {
    const noop = () => false;
    const files = await getAllFiles(testDir, testDir, noop);

    for (const file of files) {
      expect(file).not.toContain('\\');
    }
  });

  it('should respect custom ignore patterns', async () => {
    fs.writeFileSync(path.join(testDir, 'ignore-me.tmp'), 'temp');
    fs.writeFileSync(path.join(subDir, 'another.tmp'), 'temp');

    const isIgnored = picomatch(['.DS_Store', '**/*.tmp'], { dot: true });
    const files = await getAllFiles(testDir, testDir, isIgnored);

    expect(files).toContain('file1.txt');
    expect(files).toContain('file2.jpg');
    expect(files).not.toContain('ignore-me.tmp');
    expect(files).not.toContain('subdirectory/another.tmp');
  });

  it('should return empty array for non-existent directory', async () => {
    const noop = () => false;
    const files = await getAllFiles('/does-not-exist', '/does-not-exist', noop);
    expect(files).toEqual([]);
  });

  it('should return empty array for empty directory', async () => {
    const emptyDir = path.join(testDir, 'empty');
    fs.mkdirSync(emptyDir);

    const noop = () => false;
    const files = await getAllFiles(emptyDir, emptyDir, noop);
    expect(files).toEqual([]);
  });
});

describe('extractDirectories', () => {
  it('should extract directories from file paths', () => {
    const files = ['icons/logo.svg', 'icons/sun/bright.svg', 'readme.txt'];
    const dirs = extractDirectories(files);

    expect(dirs.has('icons/')).toBe(true);
    expect(dirs.has('icons/sun/')).toBe(true);
    expect(dirs.has('.')).toBe(true); // readme.txt is at root
  });

  it('should not include root dot when no root files exist', () => {
    const files = ['icons/logo.svg', 'images/banner.jpg'];
    const dirs = extractDirectories(files);

    expect(dirs.has('icons/')).toBe(true);
    expect(dirs.has('images/')).toBe(true);
    expect(dirs.has('.')).toBe(false);
  });

  it('should respect maxDepth', () => {
    const files = ['a/b/c/d/e/f/deep.txt'];
    const dirs = extractDirectories(files, 3);

    expect(dirs.has('a/')).toBe(true);
    expect(dirs.has('a/b/')).toBe(true);
    expect(dirs.has('a/b/c/')).toBe(true);
    expect(dirs.has('a/b/c/d/')).toBe(false);
  });

  it('should return empty set for empty file list', () => {
    const dirs = extractDirectories([]);
    expect(dirs.size).toBe(0);
  });
});

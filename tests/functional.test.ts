import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { getAllFiles, generateTypeScriptCode } from '../src/index';

describe('Functional Tests', () => {
  // Create a temporary test directory
  const testDir = path.resolve(process.cwd(), 'temp-test-dir');
  const subDir = path.join(testDir, 'subdirectory');
  
  // Setup test files
  beforeEach(() => {
    // Create test directory and subdirectory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
    if (!fs.existsSync(subDir)) {
      fs.mkdirSync(subDir, { recursive: true });
    }
    
    // Create some test files
    fs.writeFileSync(path.join(testDir, 'file1.txt'), 'Test content 1');
    fs.writeFileSync(path.join(testDir, 'file2.jpg'), 'Test content 2');
    fs.writeFileSync(path.join(subDir, 'file3.png'), 'Test content 3');
    fs.writeFileSync(path.join(testDir, '.DS_Store'), 'Mock DS_Store file');
  });
  
  // Cleanup after tests
  afterEach(() => {
    // Remove test directory and all files
    if (fs.existsSync(testDir)) {
      const deleteDir = (dirPath: string) => {
        if (fs.existsSync(dirPath)) {
          fs.readdirSync(dirPath).forEach((file) => {
            const curPath = path.join(dirPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
              // Recursive call for directories
              deleteDir(curPath);
            } else {
              // Delete file
              fs.unlinkSync(curPath);
            }
          });
          fs.rmdirSync(dirPath);
        }
      };
      
      deleteDir(testDir);
    }
  });
  
  it('should scan directory and return file list', async () => {
    const files = await getAllFiles(testDir, testDir, ['.DS_Store']);
    
    // Should include all files except .DS_Store
    expect(files).toContain('file1.txt');
    expect(files).toContain('file2.jpg');
    expect(files).toContain('subdirectory/file3.png');
    expect(files).not.toContain('.DS_Store'); // Explicitly ignored
  });
  
  it('should generate valid TypeScript code', async () => {
    const files = await getAllFiles(testDir, testDir);
    const code = generateTypeScriptCode(files, 'test-dir', '/app/');
    
    // Check presence of file paths in the type definition
    expect(code).toContain("'file1.txt'");
    expect(code).toContain("'file2.jpg'");
    expect(code).toContain("'subdirectory/file3.png'");
    
    // Check for base path
    expect(code).toContain('const BASE_PATH = "/app/"');
    
    // Verify the static assets function is defined correctly
    expect(code).toContain('export function staticAssets(path: StaticAssetPath): string {');
    expect(code).toContain('return `${BASE_PATH}${path.startsWith(\'/\') ? \'\' : \'/\'}${path}`');
  });
  
  it('should respect custom ignore patterns', async () => {
    // Add additional file types to test ignore patterns
    fs.writeFileSync(path.join(testDir, 'ignore-me.tmp'), 'Temporary file');
    fs.writeFileSync(path.join(subDir, 'another.tmp'), 'Another temp file');
    
    const files = await getAllFiles(testDir, testDir, ['.DS_Store', '**/*.tmp']);
    
    // Should include normal files
    expect(files).toContain('file1.txt');
    expect(files).toContain('file2.jpg');
    expect(files).toContain('subdirectory/file3.png');
    
    // Should exclude files matching ignore patterns
    expect(files).not.toContain('ignore-me.tmp');
    expect(files).not.toContain('subdirectory/another.tmp');
  });
});

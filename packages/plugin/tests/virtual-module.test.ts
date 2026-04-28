import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Plugin } from 'vite';
import staticAssetsPlugin from '../src/index';

describe('virtual module', () => {
  const testDir = path.resolve(process.cwd(), 'temp-vm-test');
  const typesOutput = path.join(testDir, 'static-assets.d.ts');
  let plugin: Plugin;

  beforeEach(() => {
    // Create a test public directory with sample files
    const publicDir = path.join(testDir, 'public');
    fs.mkdirSync(path.join(publicDir, 'icons'), { recursive: true });
    fs.writeFileSync(path.join(publicDir, 'logo.png'), 'fake-png');
    fs.writeFileSync(path.join(publicDir, 'icons/arrow.svg'), '<svg/>');

    plugin = staticAssetsPlugin({
      directory: publicDir,
      typesOutputFile: typesOutput,
    });
  });

  afterEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
  });

  it('should resolve virtual:static-assets', () => {
    const resolveId = (plugin as any).resolveId as Function;
    expect(resolveId('virtual:static-assets')).toBe('\0virtual:static-assets');
  });

  it('should not resolve other modules', () => {
    const resolveId = (plugin as any).resolveId as Function;
    expect(resolveId('some-other-module')).toBeUndefined();
  });

  it('should load virtual module with asset set and import.meta.env.BASE_URL', async () => {
    // Simulate Vite lifecycle
    const buildStart = (plugin as any).buildStart as Function;
    await buildStart();

    const load = (plugin as any).load as Function;
    const code = load('\0virtual:static-assets');

    expect(code).toContain('import.meta.env.BASE_URL');
    expect(code).toContain("'logo.png'");
    expect(code).toContain("'icons/arrow.svg'");
    expect(code).toContain('new Set(');
    expect(code).toContain('export function staticAssets');
    expect(code).not.toContain('BASE_PATH');
  });

  it('should not load non-virtual modules', async () => {
    const load = (plugin as any).load as Function;
    expect(load('some-file.ts')).toBeUndefined();
  });

  it('should generate .d.ts file on buildStart', async () => {
    const buildStart = (plugin as any).buildStart as Function;
    await buildStart();

    expect(fs.existsSync(typesOutput)).toBe(true);
    const content = fs.readFileSync(typesOutput, 'utf-8');
    expect(content).toContain("declare module 'virtual:static-assets'");
    expect(content).toContain("'logo.png'");
    expect(content).toContain("'icons/arrow.svg'");
    expect(content).toContain('StaticAssetPath');
    expect(content).toContain('StaticAssetDirectory');
    expect(content).toContain('FilesInFolder');
  });

  it('should have correct plugin name', () => {
    expect(plugin.name).toBe('vite-plugin-static-assets');
  });

  it('should handle empty public directory', async () => {
    const emptyDir = path.join(testDir, 'empty-public');
    fs.mkdirSync(emptyDir, { recursive: true });

    const emptyPlugin = staticAssetsPlugin({
      directory: emptyDir,
      typesOutputFile: typesOutput,
    });

    const buildStart = (emptyPlugin as any).buildStart as Function;
    await buildStart();

    const load = (emptyPlugin as any).load as Function;
    const code = load('\0virtual:static-assets');
    expect(code).toContain('new Set([');

    const dts = fs.readFileSync(typesOutput, 'utf-8');
    expect(dts).toContain('never');
  });
});

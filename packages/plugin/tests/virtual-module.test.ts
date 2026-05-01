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
    expect(code).toContain('"logo.png"');
    expect(code).toContain('"icons/arrow.svg"');
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
    expect(content).toContain('"logo.png"');
    expect(content).toContain('"icons/arrow.svg"');
    expect(content).toContain('StaticAssetPath');
    expect(content).toContain('StaticAssetDirectory');
    expect(content).toContain('FilesInFolder');
  });

  it('should have correct plugin name', () => {
    expect(plugin.name).toBe('vite-plugin-static-assets');
  });

  it('should route info logs through Vite logger when configResolved fires', async () => {
    const captured: string[] = [];
    const fakeLogger = {
      info: (msg: string) => captured.push(`info:${msg}`),
      warn: (msg: string) => captured.push(`warn:${msg}`),
      warnOnce: (msg: string) => captured.push(`warnOnce:${msg}`),
      error: (msg: string) => captured.push(`error:${msg}`),
      clearScreen: () => {},
      hasErrorLogged: () => false,
      hasWarned: false,
    };

    const configResolved = (plugin as any).configResolved as Function;
    // root is required since resolvePaths runs in configResolved post-B3.
    configResolved({ logger: fakeLogger, root: process.cwd() });

    // Stub console.log so the default fallback (when logger is null) doesn't muddy assertions.
    const origLog = console.log;
    console.log = () => {};
    try {
      const buildStart = (plugin as any).buildStart as Function;
      await buildStart();
    } finally {
      console.log = origLog;
    }

    // Bug fix: the "Generated static assets types at..." line now goes through
    // logger.info, which Vite's --silent flag suppresses. We assert it landed
    // on the logger, not directly on console.
    expect(captured.some((line) => line.startsWith('info:') && line.includes('Generated static assets types'))).toBe(true);
  });

  it('should validate asset references in .mts/.cts files', async () => {
    const buildStart = (plugin as any).buildStart as Function;
    await buildStart();

    const transform = (plugin as any).transform as Function;

    // Bug fix: extension regex now matches .mts/.cts/.mjs/.cjs/.astro/.mdx.
    const goodMts = transform.call({}, "import { staticAssets } from 'virtual:static-assets'\nstaticAssets('logo.png')", '/proj/src/foo.mts');
    expect(goodMts).toBeNull();

    expect(() =>
      transform.call({}, "staticAssets('does-not-exist.png')", '/proj/src/foo.mts')
    ).toThrow(/Asset not found/);
    expect(() =>
      transform.call({}, "staticAssets('does-not-exist.png')", '/proj/src/foo.cts')
    ).toThrow(/Asset not found/);
    expect(() =>
      transform.call({}, "staticAssets('does-not-exist.png')", '/proj/src/foo.astro')
    ).toThrow(/Asset not found/);
  });

  it('should skip non-source files (.css, .json, .md)', async () => {
    const buildStart = (plugin as any).buildStart as Function;
    await buildStart();

    const transform = (plugin as any).transform as Function;
    // Even with a missing-asset reference, these extensions short-circuit.
    expect(transform.call({}, "staticAssets('does-not-exist.png')", '/proj/src/style.css')).toBeNull();
    expect(transform.call({}, "staticAssets('does-not-exist.png')", '/proj/data.json')).toBeNull();
    expect(transform.call({}, "staticAssets('does-not-exist.png')", '/proj/README.md')).toBeNull();
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

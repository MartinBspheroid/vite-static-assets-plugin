import { describe, it, expect } from 'vitest';
import { execa } from 'execa';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseArgs, resolveGenerateOptions } from '../src/cli';

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vsap-cli-'));
}

async function withCwd<T>(cwd: string, fn: () => Promise<T>): Promise<T> {
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    return await fn();
  } finally {
    process.chdir(previous);
  }
}

describe('vsap cli', () => {
  it('parses the generate command with explicit overrides', () => {
    const parsed = parseArgs([
      'generate',
      '-d',
      'public-assets',
      '-o',
      'types/static-assets.d.ts',
      '-i',
      '*.tmp',
      '--mode',
      'staging',
    ]);

    expect(parsed.command).toBe('generate');
    expect(parsed.options).toMatchObject({
      loadConfig: true,
      directory: 'public-assets',
      typesOutputFile: 'types/static-assets.d.ts',
      ignore: ['*.tmp'],
      mode: 'staging',
    });
  });

  it('loads static-assets options from vite config and lets CLI flags override them', async () => {
    const root = makeTempRoot();
    const pluginEntry = pathToFileURL(path.resolve(__dirname, '../src/index.ts')).href;
    const configPath = path.join(root, 'vite.config.ts');
    fs.writeFileSync(
      configPath,
      `import staticAssets from ${JSON.stringify(pluginEntry)}

export default {
  root: '.',
  plugins: [
    staticAssets({
      directory: 'configured-public',
      typesOutputFile: 'configured/static-assets.d.ts',
      ignore: ['*.configured']
    })
  ]
}
`,
    );

    const parsed = parseArgs([
      'generate',
      '--root',
      root,
      '--config',
      configPath,
      '--types-output-file',
      'overridden/static-assets.d.ts',
    ]);

    const options = await resolveGenerateOptions(parsed.options);

    expect(options).toMatchObject({
      root,
      directory: 'configured-public',
      typesOutputFile: 'overridden/static-assets.d.ts',
      ignore: ['*.configured'],
    });
  });

  it('uses Vite resolved root from config when no CLI root override is provided', async () => {
    const root = makeTempRoot();
    const appRoot = path.join(root, 'app');
    fs.mkdirSync(appRoot, { recursive: true });
    const pluginEntry = pathToFileURL(path.resolve(__dirname, '../src/index.ts')).href;
    const configPath = path.join(root, 'vite.config.ts');
    fs.writeFileSync(
      configPath,
      `import staticAssets from ${JSON.stringify(pluginEntry)}

export default {
  root: 'app',
  plugins: [staticAssets({ directory: 'assets', typesOutputFile: 'types/static-assets.d.ts' })]
}
`,
    );

    const options = await withCwd(root, async () => {
      const parsed = parseArgs(['generate', '-c', 'vite.config.ts']);
      return resolveGenerateOptions(parsed.options);
    });

    expect(options).toMatchObject({
      root: appRoot,
      directory: 'assets',
      typesOutputFile: 'types/static-assets.d.ts',
    });
  });

  it('passes --mode into Vite config resolution', async () => {
    const root = makeTempRoot();
    const pluginEntry = pathToFileURL(path.resolve(__dirname, '../src/index.ts')).href;
    const configPath = path.join(root, 'vite.config.ts');
    fs.writeFileSync(
      configPath,
      `import staticAssets from ${JSON.stringify(pluginEntry)}

export default ({ mode }) => ({
  plugins: [
    staticAssets({
      directory: mode === 'staging' ? 'staging-public' : 'public',
      typesOutputFile: 'src/static-assets.d.ts'
    })
  ]
})
`,
    );

    const parsed = parseArgs(['generate', '--root', root, '--config', configPath, '--mode', 'staging']);
    const options = await resolveGenerateOptions(parsed.options);

    expect(options).toMatchObject({
      root,
      directory: 'staging-public',
      typesOutputFile: 'src/static-assets.d.ts',
    });
  });

  it('skips Vite config loading when --no-config is passed', async () => {
    const parsed = parseArgs([
      'generate',
      '--no-config',
      '--root',
      '/tmp/project',
      '--directory',
      'public',
    ]);

    const options = await resolveGenerateOptions(parsed.options);

    expect(options).toMatchObject({
      root: '/tmp/project',
      directory: 'public',
    });
    expect(options.typesOutputFile).toBeUndefined();
  });

  it('runs when invoked through a symlinked package bin', async () => {
    const root = makeTempRoot();
    const binDir = path.join(root, 'node_modules/.bin');
    fs.mkdirSync(binDir, { recursive: true });
    const cliPath = path.resolve(__dirname, '../dist/cli.js');
    const symlinkPath = path.join(binDir, 'vsap');
    fs.symlinkSync(cliPath, symlinkPath);

    const result = await execa(process.execPath, [symlinkPath, '--help'], {
      cwd: root,
      reject: false,
      all: true,
    });

    expect(result.exitCode).toBe(0);
    expect(result.all).toContain('Usage:');
    expect(result.all).toContain('vsap generate');
  });
});

import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { generateStaticAssetsTypes } from '../src/index';

function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'vsap-generate-'));
}

describe('generateStaticAssetsTypes', () => {
  it('writes precise virtual module declarations without running Vite', async () => {
    const root = makeTempRoot();
    fs.mkdirSync(path.join(root, 'public/icons'), { recursive: true });
    fs.writeFileSync(path.join(root, 'public/logo.png'), '');
    fs.writeFileSync(path.join(root, 'public/icons/arrow.svg'), '');

    const result = await generateStaticAssetsTypes({
      root,
      directory: 'public',
      typesOutputFile: 'src/static-assets.d.ts',
    });

    expect(result.changed).toBe(true);
    expect(result.files).toEqual(['icons/arrow.svg', 'logo.png']);
    const dts = fs.readFileSync(path.join(root, 'src/static-assets.d.ts'), 'utf8');
    expect(dts).toContain("declare module 'virtual:static-assets'");
    expect(dts).toContain('"icons/arrow.svg"');
    expect(dts).toContain('"logo.png"');
    expect(dts).toContain('export type StaticAssetDirectory');
  });

  it('does not rewrite unchanged output', async () => {
    const root = makeTempRoot();
    fs.mkdirSync(path.join(root, 'public'), { recursive: true });
    fs.writeFileSync(path.join(root, 'public/logo.png'), '');

    await generateStaticAssetsTypes({ root });
    const result = await generateStaticAssetsTypes({ root });

    expect(result.changed).toBe(false);
    expect(result.files).toEqual(['logo.png']);
  });
});

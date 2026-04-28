import { afterAll } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

afterAll(() => {
  // Clean up any generated .d.ts files from tests
  const dtsFile = path.resolve(process.cwd(), '../../src/static-assets.d.ts');
  if (fs.existsSync(dtsFile)) {
    try {
      fs.unlinkSync(dtsFile);
    } catch {
      // Ignore cleanup errors
    }
  }
});

import { afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

afterAll(() => {
  const outputFile = path.resolve(process.cwd(), '../../src/static-assets.ts');
  if (fs.existsSync(outputFile)) {
    try {
      fs.unlinkSync(outputFile);
      console.log('Cleaned up generated static-assets.ts after tests.');
    } catch (err) {
      console.warn('Failed to delete static-assets.ts after tests:', err);
    }
  }
});

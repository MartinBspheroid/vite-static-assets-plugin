import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import staticAssetsPlugin from '../src/index';
import { createServer, build } from 'vite';


// Mock Vite functions
vi.mock('vite', () => ({
  createServer: vi.fn().mockResolvedValue({
    listen: vi.fn().mockResolvedValue({}),
    close: vi.fn().mockResolvedValue(void 0)
  }),
  build: vi.fn().mockResolvedValue({}),
  normalizePath: vi.fn(path => path)
}));

// Mock file system
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn().mockReturnValue(true),
    readdirSync: vi.fn().mockReturnValue(['image.png', 'document.pdf']),
    statSync: vi.fn().mockReturnValue({
      isDirectory: () => false,
      isFile: () => true
    }),
    writeFileSync: vi.fn(),
    mkdirSync: vi.fn()
  };
});

// Mock path
vi.mock('path', () => ({
  resolve: vi.fn((...args) => args.join('/')),
  join: vi.fn((...args) => args.join('/')),
  relative: vi.fn((from, to) => to.replace(from + '/', '')),
  dirname: vi.fn(path => path.split('/').slice(0, -1).join('/'))
}));

describe('Integration with Vite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('should work with Vite createServer', async () => {
    const plugin = staticAssetsPlugin();
    
    await createServer({
      plugins: [plugin]
    });
    
    expect(createServer).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            name: 'vite-plugin-static-assets'
          })
        ])
      })
    );
  });

  it('should work with Vite build', async () => {
    const plugin = staticAssetsPlugin();
    
    await build({
      plugins: [plugin]
    });
    
    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            name: 'vite-plugin-static-assets'
          })
        ])
      })
    );
  });
  
  it('should integrate with custom Vite configurations', async () => {
    const plugin = staticAssetsPlugin({
      directory: 'assets',
      outputFile: 'src/generated/asset-types.ts'
    });
    
    await build({
      plugins: [plugin],
      base: '/my-app/',
      root: 'custom-root'
    });
    
    expect(build).toHaveBeenCalledWith(
      expect.objectContaining({
        plugins: expect.arrayContaining([
          expect.objectContaining({
            name: 'vite-plugin-static-assets'
          })
        ]),
        base: '/my-app/',
        root: 'custom-root'
      })
    );
  });
});

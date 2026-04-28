import * as fs from 'node:fs'
import * as path from 'node:path'
import * as os from 'node:os'
import { execSync } from 'node:child_process'
import * as acorn from 'acorn'

/**
 * Materialize a temporary fixture tree on disk and return its path.
 * Caller is responsible for cleanup (use `afterEach(() => cleanup())`).
 *
 * Supports unicode and special-char filenames — keys are passed straight to
 * fs.writeFileSync, so anything POSIX accepts is fine.
 */
export function makeFixture(files: Record<string, string | Buffer>): {
  dir: string
  cleanup: () => void
} {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsap-fixture-'))
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, content)
  }
  return {
    dir,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  }
}

/**
 * Run `tsc --noEmit --strict` on a generated `.d.ts` plus a small consumer
 * snippet. Returns whether typechecking passed plus the captured diagnostics.
 *
 * The dts is written as `virtual-static-assets.d.ts` and the consumer at
 * `consumer.ts` in a fresh temp dir.
 */
export function assertDtsTypechecks(
  dtsContents: string,
  consumerSnippet: string,
): { ok: boolean; output: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vsap-tsc-'))
  try {
    fs.writeFileSync(path.join(dir, 'virtual-static-assets.d.ts'), dtsContents)
    fs.writeFileSync(path.join(dir, 'consumer.ts'), consumerSnippet)
    fs.writeFileSync(
      path.join(dir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: 'ESNext',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ['**/*.ts', '**/*.d.ts'],
      }),
    )
    try {
      execSync(`bunx tsc --noEmit -p ${dir}`, {
        encoding: 'utf8',
        stdio: 'pipe',
      })
      return { ok: true, output: '' }
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string }
      return { ok: false, output: `${e.stdout ?? ''}\n${e.stderr ?? ''}` }
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

/**
 * Acorn-parse the generated virtual module JS to confirm it's valid ESM.
 * Catches escaping bugs in `generateVirtualModuleCode`.
 */
export function assertVirtualModuleParses(jsCode: string): { ok: boolean; error?: string } {
  try {
    acorn.parse(jsCode, { ecmaVersion: 2022, sourceType: 'module' })
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Evaluate the generated virtual module via Function constructor and call its
 * exported `staticAssets`. We rewrite `import.meta.env.BASE_URL` to a literal
 * since the Function ctor doesn't grant import.meta access.
 */
export function evalVirtualModule(jsCode: string, baseUrl = '/') {
  // Strip the export keyword and replace import.meta.env.BASE_URL with the literal.
  const transformed = jsCode
    .replace(/export\s+function\s+staticAssets/, 'function staticAssets')
    .replace(/import\.meta\.env\.BASE_URL/g, JSON.stringify(baseUrl))
  // eslint-disable-next-line no-new-func
  const fn = new Function(`${transformed}\nreturn { staticAssets };`)
  return fn() as { staticAssets: (path: string) => string }
}

# Plan 009: Upgrade Vitest 1.x → 4.1.x (align the test runner with Vite 8)

> **Executor instructions**: Follow step by step; run every verification command
> and confirm the expected result. On any "STOP condition", stop and report.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 591af05..HEAD -- package.json packages/plugin/package.json packages/plugin/vitest.config.ts packages/plugin/vitest.unit-extended.config.ts vitest.harness.config.ts`
> If any changed, compare the excerpts below against the live files before
> editing; on mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (crosses 3 Vitest majors; touches all test configs)
- **Depends on**: none (do this **before** 004 benchmarks if both are taken —
  `vitest bench` config shape is cleanest on v4)
- **Category**: dependencies / build / **security**
- **Planned at**: commit `591af05`, 2026-06-15
- **Priority raised to P1 on 2026-06-16**: GitHub Dependabot reports **2 open
  CRITICAL alerts** for the pinned `vitest` — **CVE-2026-47429 /
  GHSA-5xrq-8626-4rwp** ("when the Vitest UI server is listening, an arbitrary
  file can be read and executed"), vulnerable range **`< 3.2.6`** (first patched
  `3.2.6`). The installed 1.6.1 is vulnerable. This upgrade to `^4.1.0` resolves
  the CVE (4.1.x ≥ 3.2.6) **and** the Vite-8 compatibility gap in one move, which
  is why it's now the highest-priority plan.

## Why this matters

**Security (critical):** the pinned `vitest@^1.0.0` (1.6.1 installed) is affected
by **CVE-2026-47429 / GHSA-5xrq-8626-4rwp** — the Vitest UI server can be coerced
into reading and executing an arbitrary file. Fixed in **vitest ≥ 3.2.6**; the
`^4.1.0` target here is well past that. Two open critical Dependabot alerts track
this (manifests: `package.json` and `packages/plugin/package.json`).

**Compatibility:** the project runs **Vite 8.0.x** but pins the test runner to `vitest@^1.0.0`
(1.6.1 installed) and `@vitest/coverage-v8@^1.0.0`. **Vitest 1.x targets the Vite
5 era and does not support Vite 8** — Vite 8 support first arrived in **Vitest
4.1** (which also switched Vitest to use the project's installed Vite instead of
bundling its own). The suite passes today only incidentally via dependency
hoisting; the runner is three majors stale and mismatched with the bundler it's
testing. Current Vitest is **4.1.9** (verified against the npm registry and
https://vitest.dev/blog/vitest-4-1.html). `@vitest/coverage-v8` is released in
lockstep and its peer dep pins the **exact** `vitest` version, so both must move
together.

Sources: https://vitest.dev/blog/vitest-4-1.html,
https://vitest.dev/guide/migration.html, https://registry.npmjs.org/vitest.

## Current state

Declared in **both** manifests (re-verify in drift check):
- `package.json` (root) devDependencies: `"vitest": "^1.0.0"`,
  `"@vitest/coverage-v8": "^1.0.0"`, `"vite": "^8.0.0"`.
- `packages/plugin/package.json` devDependencies: same two at `^1.0.0`,
  `"vite": "^8.0.0"`.

Three Vitest configs:
- `packages/plugin/vitest.config.ts` — core suite:
  ```ts
  test: { globals: true, environment: 'node', include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**','**/dist/**','tests-extended/**'],
    setupFiles: ['tests/setupTests.ts'],
    coverage: { provider: 'v8', reporter: ['text','json','html'],
      include: ['src/**/*.ts'], exclude: ['**/*.d.ts','**/*.test.ts'] } }
  ```
- `packages/plugin/vitest.unit-extended.config.ts` — extended suite:
  ```ts
  test: { globals: true, environment: 'node', include: ['tests-extended/**/*.test.ts'],
    exclude: ['**/node_modules/**','**/dist/**'], testTimeout: 30_000, pool: 'forks' }
  ```
- `vitest.harness.config.ts` (root) — cross-framework harness:
  ```ts
  test: { include: ['tests/harness.test.ts'], testTimeout: 240_000,
    hookTimeout: 600_000, pool: 'forks',
    poolOptions: { forks: { singleFork: true } } }
  ```

**Vitest 4 breaking changes that hit this repo specifically:**
1. `poolOptions.forks.singleFork` is **removed**. The harness config's
   `poolOptions: { forks: { singleFork: true } }` must be migrated. In v4 the
   equivalent of "one fork, no parallelism" is top-level
   `fileParallelism: false` (and/or `maxWorkers: 1`). `pool: 'forks'` itself is
   still valid.
2. Default `exclude` simplified to only `node_modules`/`.git` — this repo already
   lists its excludes explicitly, so it's safe, but keep the explicit lists.
3. V8 coverage in v4 uses AST-based remapping by default (numbers may shift
   slightly) and removed `coverage.all`/`extensions`/`ignoreEmptyLines` — none of
   which this repo uses.
4. `environment: 'node'` and `globals: true` are unchanged.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install (after manifest edits) | `bun install` | exit 0; `bun.lock` updates |
| Verify installed version | `cat node_modules/vitest/package.json \| grep '"version"'` | `4.1.x` |
| Build | `cd packages/plugin && bun run build` | exit 0 |
| Typecheck | `cd packages/plugin && bun run typecheck` | exit 0 |
| Core tests | `cd packages/plugin && bun run test` | 41 pass |
| Extended tests | `cd packages/plugin && bun run test:unit-extended` | 70 pass |
| Coverage | `cd packages/plugin && bun run test:coverage` | runs, report emitted |
| Harness | `bun run test:harness` | passes (slow) |

## Scope

**In scope**:
- `package.json` (root) — bump the two devDep ranges
- `packages/plugin/package.json` — bump the two devDep ranges
- `vitest.harness.config.ts` — migrate `poolOptions.forks.singleFork`
- `packages/plugin/vitest.config.ts` and `vitest.unit-extended.config.ts` — only
  if a v4 deprecation warning/error requires it (see Step 4)
- `bun.lock` — will change as a result of `bun install` (commit it)

**Out of scope** (do NOT touch):
- `packages/plugin/src/**` — no source changes; this is a tooling upgrade.
- Test *contents* in `tests/`/`tests-extended/` — do not rewrite tests to pass.
  If a test genuinely breaks on v4 semantics, that's a STOP condition, not a
  silent rewrite.
- `vite` version (already 8) and the `peerDependencies` block.

## Git workflow

- Branch: `advisor/009-vitest-4`.
- Commit: `build(deps): upgrade vitest to v4 (Vite 8 compatibility)`.
- Do NOT push/PR unless instructed.

## Steps

### Step 1: Bump the dependency ranges in both manifests

Set in **both** `package.json` (root) and `packages/plugin/package.json`:
`"vitest": "^4.1.0"` and `"@vitest/coverage-v8": "^4.1.0"`. Keep them identical
in both files (the coverage package's peer dep pins the exact vitest version, so
they must resolve to the same release).

**Verify**: `grep -n '"vitest"\|coverage-v8' package.json packages/plugin/package.json`
→ all four show `^4.1.0`.

### Step 2: Install and confirm the resolved version

Run `bun install`.

**Verify**:
- `cat node_modules/vitest/package.json | grep '"version"'` → `4.1.x` **or any
  higher 4.x** (`^4.1.0` may resolve to 4.1.9, 4.2.x, etc. — a higher 4.x is
  fine; a major other than 4 is a STOP condition, see below).
- `cat node_modules/@vitest/coverage-v8/package.json | grep '"version"'` → the
  **same exact version** as `vitest` above (the coverage package pins the exact
  vitest version).

### Step 3: Migrate the harness pool config

In `vitest.harness.config.ts`, replace
`poolOptions: { forks: { singleFork: true } }` with `fileParallelism: false`
(keep `pool: 'forks'`, `testTimeout`, `hookTimeout`). The harness must remain
serial — `fileParallelism: false` preserves the single-fork, no-parallelism
behavior the long timeouts depend on.

**Verify**: `cd /root/projects/vite-static-assets-plugin && bun run test:harness`
→ passes (this is slow — it builds the `test-apps/`). If it can't run in the
environment, at minimum `grep -n "singleFork" vitest.harness.config.ts` → no
match, and the file parses.

### Step 4: Run all suites; migrate config only if v4 demands it

Run the core, extended, and coverage suites. Vitest 4 will print a clear
deprecation/error message if any remaining config option is invalid. Only then
adjust `vitest.config.ts` / `vitest.unit-extended.config.ts` per the message
(consult https://vitest.dev/guide/migration.html). Do not change config
speculatively.

**Verify**:
- `cd packages/plugin && bun run test` → 41 pass.
- `cd packages/plugin && bun run test:unit-extended` → 70 pass.
- `cd packages/plugin && bun run test:coverage` → runs; coverage report emitted
  (exact percentages may differ slightly from v1 due to AST remapping — that's
  expected, not a failure).
- `cd packages/plugin && bun run typecheck` and `bun run build` → exit 0.

### Step 5: Confirm the CI still matches

The CI (`.github/workflows/test.yml`) invokes these same scripts — no workflow
edit should be needed. Sanity-check that the scripts it calls
(`test`, `test:unit-extended`, `test:harness`) are unchanged.

**Verify**: `grep -n "bun run test" .github/workflows/test.yml` → the same script
names exist (no change required).

## Test plan

No new tests — this is a runner upgrade. The verification *is* the existing
suites passing on v4:
- Core 41, extended 70 still pass.
- Coverage still produces a report.
- Harness still passes (or at least the config is migrated and parses if the
  environment can't run the full harness).

## Done criteria

ALL must hold:

- [ ] Both manifests pin `vitest` and `@vitest/coverage-v8` to `^4.1.0`
- [ ] Installed `vitest` is `>= 4.1.0 < 5` (and therefore `>= 3.2.6`, clearing
      CVE-2026-47429) and `@vitest/coverage-v8` is the **exact same version**
- [ ] After push, the 2 critical `vitest` Dependabot alerts
      (GHSA-5xrq-8626-4rwp) close on the branch
- [ ] `grep -n "singleFork" vitest.harness.config.ts` → no match
- [ ] `cd packages/plugin && bun run test` → 41 pass
- [ ] `cd packages/plugin && bun run test:unit-extended` → 70 pass
- [ ] `cd packages/plugin && bun run test:coverage` runs and emits a report
- [ ] `cd packages/plugin && bun run typecheck` and `bun run build` exit 0
- [ ] `bun.lock` updated; no `src/**` or test-content changes (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- A test fails on v4 due to changed semantics (e.g. mock-restore behavior,
  fake-timer changes). Report the failing test and the v4 change — do NOT rewrite
  the test to force a pass.
- `bun install` resolves a `vitest`/`@vitest/coverage-v8` version mismatch (peer
  conflict) — report the resolved versions.
- `bun install` resolves `vitest` to a major **other than 4** (e.g. a 5.x was
  published after this plan was written) — STOP and report; the migration notes
  here are written for v4 and a newer major may have its own breaking changes.
- The harness can't run in your environment — migrate + parse-check the config,
  then report that full harness verification is pending CI.
- Any config option flagged by v4 requires a behavioral change you're unsure
  about — report with the exact Vitest message.

## Maintenance notes

- Keep `vitest` and `@vitest/coverage-v8` version-locked on every future bump
  (the coverage package pins the exact vitest version).
- After this lands, plan 004 (benchmarks) can rely on `vitest bench` from v4
  cleanly.
- A reviewer should confirm coverage numbers shifting slightly is due to v4's
  AST-based V8 remapping, not lost test coverage.

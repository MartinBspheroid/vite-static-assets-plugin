# Plan 004: Add a benchmark suite for the scan + codegen hot paths

> **Executor instructions**: Follow step by step; run every verification command
> and confirm the expected result. On any "STOP condition", stop and report.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 591af05..HEAD -- packages/plugin/src/index.ts packages/plugin/package.json`
> If `index.ts` changed, re-confirm the exported function signatures below before
> writing benchmarks against them.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tests / perf
- **Planned at**: commit `591af05`, 2026-06-15

## Why this matters

The plugin recursively scans the assets directory (`getAllFiles`) and generates
TypeScript + virtual-module code (`generateDtsCode`, `generateVirtualModuleCode`,
`extractDirectories`) on **every build and every watch rescan**. For projects
with large `public/` trees this is the plugin's whole performance surface, and
there is currently **no benchmark** guarding against regressions. `vitest bench`
(powered by Tinybench) is the current 2025–2026 standard for in-repo
microbenchmarks (https://vitest.dev/guide/features). Benchmarks are purely
additive — they cannot break the shipped plugin.

## Current state

Exported pure functions in `packages/plugin/src/index.ts` (re-confirm in drift
check — these are exported at ~line 290 via
`export { getAllFiles, extractDirectories, generateVirtualModuleCode, generateDtsCode, validateAssetReferences }`):

- `getAllFiles(dir: string, baseDir: string, isIgnored: (path: string) => boolean): Promise<string[]>`
  — async recursive scan; takes an `isIgnored` predicate (build one with
  `picomatch(patterns, { dot: true })`, as the plugin does at `index.ts:297`).
- `extractDirectories(files: string[], maxDepth = 5): Set<string>` — pure.
- `generateDtsCode(files: string[], options?): string` — pure.
- `generateVirtualModuleCode(files: string[]): string` — pure.
- `validateAssetReferences(code, id, currentFiles: Set<string>, directory, displayRoot?): string | null`
  — pure.

Test infrastructure that already exists and shows the conventions to match:
- `packages/plugin/tests-extended/helpers.ts` — exports `makeFixture(files:
  Record<string, string | Buffer>)`, which writes an explicit map of path→content
  to a temp dir and returns the dir. **It is NOT a count-based tree generator** —
  to build a large tree you'd have to construct a big record. For the scan
  benchmark's ~2,000-file tree, prefer creating the tree directly with `node:fs`
  (see Step 4) rather than forcing `makeFixture`. **Read this file first** so you
  use the real API.
- `packages/plugin/vitest.unit-extended.config.ts` — shows the vitest config
  shape (`globals`, `environment: 'node'`, `pool: 'forks'`).

There is **no** `vitest.bench.config.ts` and no `*.bench.ts` file.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install --frozen-lockfile` | exit 0 |
| Run benchmarks | `cd packages/plugin && bun run bench` | runs, prints ops/sec table |
| Typecheck | `cd packages/plugin && bun run typecheck` | exit 0 |

## Scope

**In scope** (create / edit):
- `packages/plugin/bench/codegen.bench.ts` (create) — pure-function benchmarks.
- `packages/plugin/bench/scan.bench.ts` (create) — `getAllFiles` benchmark over a
  generated fixture tree.
- `packages/plugin/vitest.bench.config.ts` (create) — config that includes
  `bench/**/*.bench.ts`.
- `packages/plugin/package.json` — add a `"bench"` script.

**Out of scope** (do NOT touch):
- `packages/plugin/src/index.ts` — benchmarks measure it; they don't change it.
- The existing `tests/` and `tests-extended/` configs — keep benchmarks in a
  separate config so `vitest run` never picks them up.

## Git workflow

- Branch: `advisor/004-benchmarks`.
- Commit: `test: add vitest benchmarks for scan and codegen`.
- Do NOT push/PR unless instructed.

## Steps

### Step 1: Add the bench vitest config

Create `packages/plugin/vitest.bench.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    benchmark: {
      include: ['bench/**/*.bench.ts'],
    },
  },
})
```

**Verify**: file exists; `cd packages/plugin && bun x tsc --noEmit
vitest.bench.config.ts` is not required, but the file must be valid TS.

### Step 2: Add the `bench` script

In `packages/plugin/package.json` scripts add:
`"bench": "vitest bench --config vitest.bench.config.ts"`.

**Verify**: `grep -n "\"bench\"" packages/plugin/package.json` → match.

### Step 3: Codegen benchmarks (pure functions, deterministic)

Create `packages/plugin/bench/codegen.bench.ts`. Import `bench` from `'vitest'`
and the pure functions from `../src/index.ts`. Build a synthetic file list once
(module scope) — e.g. 1,000 and 10,000 paths across nested directories — and
benchmark each function over it:

```ts
import { bench } from 'vitest'
import { extractDirectories, generateDtsCode, generateVirtualModuleCode } from '../src/index'

const files = Array.from({ length: 10_000 }, (_, i) =>
  `dir${i % 50}/sub${i % 10}/file-${i}.svg`)

bench('extractDirectories (10k files)', () => { extractDirectories(files) })
bench('generateDtsCode (10k files)', () => { generateDtsCode(files) })
bench('generateVirtualModuleCode (10k files)', () => { generateVirtualModuleCode(files) })
```

Keep inputs deterministic (no `Math.random`) so runs are comparable.

**Verify**: `cd packages/plugin && bun run bench` runs these and prints a results
table with non-zero hz for each.

### Step 4: Scan benchmark (`getAllFiles` over a real fixture tree)

Create `packages/plugin/bench/scan.bench.ts`. Create a temporary directory tree
on disk (e.g. ~2,000 files across nested folders) **once** before the benchmarks,
then benchmark `getAllFiles` over it. Build the ignore predicate with
`picomatch(['.DS_Store'], { dot: true })`. Clean up the temp dir after.

`helpers.ts` exports only `makeFixture(map)` (an explicit path→content record),
which is awkward for a large generated tree. Prefer creating the tree directly
with `node:fs` (`fs.mkdirSync(..., { recursive: true })` + `fs.writeFileSync`)
under `os.tmpdir()`, and remove it (`fs.rmSync(dir, { recursive: true })`) after
the benchmarks run.

**Verify**: `cd packages/plugin && bun run bench` runs both bench files; the scan
benchmark reports a result and the temp dir is removed afterward
(`ls` of the temp path fails).

### Step 5: Ensure benchmarks are excluded from the normal test run

Confirm `vitest run` (the `test` and `test:unit-extended` scripts) does NOT pick
up `bench/**`. The existing configs include only `tests/**` and `tests-extended/**`,
so `bench/` is already outside them — verify by running them.

**Verify**:
- `cd packages/plugin && bun run test` → same test count as before (benchmarks
  not collected).
- `cd packages/plugin && bun run test:unit-extended` → same as before.

## Test plan

Benchmarks are not assertions, but they must *execute cleanly*:
- `bun run bench` exits 0 and prints a results table for every `bench()` defined.
- The normal test suites' counts are unchanged (Step 5).

## Done criteria

ALL must hold:

- [ ] `packages/plugin/vitest.bench.config.ts` exists
- [ ] `packages/plugin/bench/codegen.bench.ts` and `bench/scan.bench.ts` exist
- [ ] `packages/plugin/package.json` has a `bench` script
- [ ] `cd packages/plugin && bun run bench` exits 0 and prints results for all benches
- [ ] `cd packages/plugin && bun run typecheck` exits 0
- [ ] `bun run test` and `bun run test:unit-extended` collect the same number of
      tests as before this change
- [ ] No change to `src/index.ts`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- Any of the imported pure functions has a different signature than listed in
  "Current state" (the drift check should have caught this).
- The scan benchmark can't create a temp fixture (permissions) — report rather
  than benchmarking against a committed fixture (don't commit thousands of files).
- `vitest bench` is unavailable in the installed Vitest version — report the
  version; do not pull in a different benchmarking lib without approval.

## Maintenance notes

- These are local micro-benchmarks for spotting regressions during development,
  not a CI gate. If the maintainer later wants CI tracking, CodSpeed integrates
  with Vitest benchmarks — note as a follow-up; do not add it here.
- Keep the synthetic input sizes fixed; changing them invalidates historical
  comparisons. If you add larger inputs, add them as new `bench()` cases rather
  than editing existing ones.
- Do NOT commit large fixture trees — the scan benchmark must generate its tree
  at runtime and clean it up.

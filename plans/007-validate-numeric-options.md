# Plan 007: Validate `maxDirectoryDepth` and `debounce` options (bugs #7 & #8)

> **Executor instructions**: Follow step by step; run every verification command
> and confirm the expected result before moving on. On any "STOP condition",
> stop and report. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 591af05..HEAD -- packages/plugin/src/index.ts packages/plugin/tests-extended/options.test.ts`
> If either changed, compare the line excerpts below against the live files
> before editing; on mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug (correctness / input validation)
- **Planned at**: commit `591af05`, 2026-06-15

## Why this matters

Two numeric plugin options are consumed without validation:

- `maxDirectoryDepth` — passed straight into `extractDirectories(files, maxDepth)`.
  A value `< 1`, `0`, negative, non-integer, `NaN`, or `Infinity` silently
  produces wrong/empty directory type output instead of erroring or falling back.
- `debounce` — passed straight into `setTimeout(..., options.debounce ?? 200)`.
  `NaN`/`Infinity` make the watcher's debounce behave unintuitively.

These are bugs #7 and #8 in the repo's own `test.plan.md`. The fix is pure
factory-time validation: detect a bad value, warn once (matching the existing
deprecation-warning style), and fall back to the documented default. No watcher,
transform, or lifecycle code changes. This is the work the current branch
(`feat/input-validation`) is named for.

## Current state

`packages/plugin/src/index.ts` (re-verify line numbers in the drift check):

- Option declarations:
  - `index.ts:35` — `debounce?: number;` (`@default 200`)
  - `index.ts:45` — `maxDirectoryDepth?: number;` (`@default 5`)
- The factory function `staticAssetsPlugin(options = {})` begins at `index.ts:294`.
- Existing deprecation warnings to match in style (`index.ts:299-308`):
  ```ts
  if (options.addLeadingSlash !== undefined) {
    console.warn(`${styleText('yellow', '⚠')} [vite-plugin-static-assets] 'addLeadingSlash' is deprecated and ignored. ...`);
  }
  if (options.outputFile && !options.typesOutputFile) {
    console.warn(`${styleText('yellow', '⚠')} [vite-plugin-static-assets] 'outputFile' is deprecated. ...`);
  }
  ```
  (`styleText` is imported from `node:util` at `index.ts:4`.)
- Consumption sites that must use the validated values:
  - `maxDirectoryDepth`: reaches `generateDtsCode` via the options spread in
    `writeDtsFile` — `index.ts:369`:
    `const dtsCode = generateDtsCode(files, { ...options, enableDirectoryTypes });`
    and inside `generateDtsCode` it defaults at `index.ts:188` (`maxDirectoryDepth = 5`)
    then feeds `extractDirectories` at `index.ts:202`.
  - `debounce`: `index.ts:544` — `}, options.debounce ?? 200);`
- **No validation exists today**, and there is **no options-validation test** in
  `packages/plugin/tests-extended/options.test.ts` (confirmed: grep for
  "validation"/"isFinite" returns nothing).
- The existing deprecation-warning tests in `options.test.ts` spy on
  `console.warn` (e.g. the `outputFile`/`addLeadingSlash` cases) — mirror that
  pattern for the new tests.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install --frozen-lockfile` | exit 0 |
| Typecheck | `cd packages/plugin && bun run typecheck` | exit 0 |
| Build | `cd packages/plugin && bun run build` | exit 0 |
| Core tests | `cd packages/plugin && bun run test` | all pass (baseline count unchanged) |
| Extended tests | `cd packages/plugin && bun run test:unit-extended` | all pass (baseline + your new cases) |

> **Capture the baseline first.** Before editing anything, run both suites and
> record the passing counts (at `591af05` these were 41 core / 70 extended, but
> verify — do not trust the numbers if they differ). "No regression" below means
> the core count is unchanged and the extended count grows only by the cases you
> add.

## Scope

**In scope** (the only files you should modify):
- `packages/plugin/src/index.ts` — add a validation block at the top of the
  factory and route the validated values to the two consumption sites.
- `packages/plugin/tests-extended/options.test.ts` — add a new
  `describe('options validation', ...)` block.

**Out of scope** (do NOT touch):
- `packages/plugin/tests/`, `tests/harness.test.ts`, any vitest config,
  `package.json`, `tsconfig.json`.
- The watcher block, the `transform` hook, the `getAllFiles`/`extractDirectories`/
  codegen function bodies — do not change their logic or signatures.
- Do NOT add a new public option or change any default value.

## Git workflow

- Branch: you are likely already on `feat/input-validation`; if not, create
  `advisor/007-validate-options`.
- Commit: `fix: validate maxDirectoryDepth and debounce options`. Conventional Commits.
- Do NOT push/PR unless instructed.

## Steps

### Step 1: Add the validation block at factory time

Immediately **after** the deprecation warnings (after `index.ts:308`) and
**before** `let directory: string | null = null;` (`index.ts:319`), add two
inline validators (not exported, no new public API) that compute sanitized
locals:

```ts
// Validate numeric options; warn once and fall back to the documented default
// on an invalid value. Matches the deprecation-warning style above.
const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_DEBOUNCE = 200;

let resolvedMaxDepth = DEFAULT_MAX_DEPTH;
if (options.maxDirectoryDepth !== undefined) {
  const v = options.maxDirectoryDepth;
  if (typeof v === 'number' && Number.isInteger(v) && v >= 1) {
    resolvedMaxDepth = v;
  } else {
    console.warn(`${styleText('yellow', '⚠')} [vite-plugin-static-assets] 'maxDirectoryDepth' must be an integer >= 1; received ${String(v)}. Falling back to ${DEFAULT_MAX_DEPTH}.`);
  }
}

let resolvedDebounce = DEFAULT_DEBOUNCE;
if (options.debounce !== undefined) {
  const v = options.debounce;
  if (typeof v === 'number' && Number.isFinite(v) && v >= 0) {
    resolvedDebounce = v;
  } else {
    console.warn(`${styleText('yellow', '⚠')} [vite-plugin-static-assets] 'debounce' must be a finite number >= 0; received ${String(v)}. Falling back to ${DEFAULT_DEBOUNCE}.`);
  }
}
```

Note: `debounce: 0` is valid (no warning). `maxDirectoryDepth` must be a positive
integer (so `2.5`, `0`, `-1`, `NaN`, `Infinity` all warn + fall back).

**Verify**: `cd packages/plugin && bun run typecheck` → exit 0.

### Step 2: Route the validated values to their consumption sites

- `writeDtsFile` (`index.ts:369`): change
  `generateDtsCode(files, { ...options, enableDirectoryTypes })`
  to pass the sanitized depth explicitly:
  `generateDtsCode(files, { ...options, enableDirectoryTypes, maxDirectoryDepth: resolvedMaxDepth })`.
  (The spread still carries `enableDirectoryTypes`/etc.; the explicit key after
  the spread wins.)
- Watcher debounce (`index.ts:544`): change `}, options.debounce ?? 200);` to
  `}, resolvedDebounce);`.

Do not change `generateDtsCode`'s own internal default — leave `index.ts:188` as
is; it remains the fallback for direct test callers of the exported function.

**Verify**:
- `cd packages/plugin && bun run build` → exit 0.
- `cd packages/plugin && bun run test` → core count unchanged from baseline.
- `cd packages/plugin && bun run test:unit-extended` → baseline count unchanged (no regression yet;
  new tests added in Step 3).

### Step 3: Add the validation tests

In `packages/plugin/tests-extended/options.test.ts`, add a new
`describe('options validation', ...)` block. Use `vi.spyOn(console, 'warn')`
(restore it after each case) mirroring the existing deprecation-warning tests in
the same file. Cover:

- `maxDirectoryDepth: 0` → `console.warn` called once with a message mentioning
  the value and the fallback; the generated `.d.ts` is still produced (depth
  behaves as the default 5 — assert directory unions are present for a nested
  fixture).
- `maxDirectoryDepth: -1` → warns, falls back.
- `maxDirectoryDepth: 2.5` → warns, falls back.
- `maxDirectoryDepth: NaN` → warns, falls back.
- `maxDirectoryDepth: 5` (valid) → **no** warning.
- `debounce: Infinity` → warns once (assert the warning fires; do NOT try to
  assert timer behavior — keep it a factory-level test).
- `debounce: NaN` → warns once.
- `debounce: 0` → **no** warning.
- `debounce: 200` (valid) → no warning.

To trigger factory-time validation you only need to instantiate the plugin:
`staticAssetsPlugin({ maxDirectoryDepth: 0 })`. For the "dts still generated"
assertion, follow how existing tests in this file build a fixture and call the
plugin's `buildStart`/read the generated dts (reuse helpers from
`tests-extended/helpers.ts` — read it first).

**Verify**: `cd packages/plugin && bun run test:unit-extended` → all pass; total
increased by the number of new test cases.

## Test plan

- New `describe('options validation')` block in
  `packages/plugin/tests-extended/options.test.ts`, cases as listed in Step 3
  (invalid → warn + fallback; valid/`0` → no warn).
- Pattern to follow: the existing `outputFile`/`addLeadingSlash` deprecation
  tests in the same file (they already use `vi.spyOn(console, 'warn')`).
- Verification: both unit suites green; `41` core unchanged, extended grows by N.

## Done criteria

ALL must hold:

- [ ] `cd packages/plugin && bun run typecheck` exits 0
- [ ] `cd packages/plugin && bun run build` exits 0
- [ ] `cd packages/plugin && bun run test` → core count unchanged from baseline
- [ ] `cd packages/plugin && bun run test:unit-extended` → baseline count + new cases pass
- [ ] Invalid `maxDirectoryDepth` (`0`,`-1`,`2.5`,`NaN`,`Infinity`) each warn once
      and fall back to 5; valid values pass through
- [ ] Invalid `debounce` (`NaN`,`Infinity`,negative) warn + fall back to 200;
      `0` and valid numbers do NOT warn
- [ ] No new public option; no default value changed; no out-of-scope file modified
      (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- The factory function or option declarations don't match the excerpts above
  (drift since `591af05`).
- An existing test breaks in a way that isn't a count change — it may assert on
  `options.debounce`/depth behavior you changed; report which test.
- You find the project prefers throwing over warn-and-fallback for bad config
  (check for any existing precedent) — report before changing the contract.

## Maintenance notes

- If more numeric options are added later, extend the same validate-warn-fallback
  pattern rather than scattering checks at consumption sites.
- A reviewer should confirm the warning messages include the offending value and
  the fallback, and that `debounce: 0` stays warning-free (it's a valid "next
  tick" setting).
- This supersedes the ad-hoc spec in
  `.aris/sleep-runs/20260506_071047/NEXT_AUTONOMOUS_TASK.md`; that file can be
  retired once this lands.

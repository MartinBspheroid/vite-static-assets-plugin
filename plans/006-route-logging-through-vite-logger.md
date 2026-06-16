# Plan 006: Route all plugin logging through Vite's Logger (stop using console.* directly)

> **Executor instructions**: Follow step by step; run every verification command
> and confirm the expected result. On any "STOP condition", stop and report.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 591af05..HEAD -- packages/plugin/src/index.ts`
> If `index.ts` changed, compare the line excerpts below against the live file
> before editing; on mismatch, STOP.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED (touches the core plugin + its pure exported functions)
- **Depends on**: none (but easier to review after 003 lint exists)
- **Category**: tech-debt
- **Planned at**: commit `591af05`, 2026-06-15

## Why this matters

The plugin already has `info()`/`warn()` helpers that prefer Vite's injected
`Logger` and fall back to `console` (`index.ts:358-365`), but several code paths
still call `console.warn`/`console.error`/`console.log` **directly**. Logging via
raw `console.*` bypasses Vite's `logLevel` config, the `--silent` CLI flag, and
any user `customLogger` — the official Vite guidance is to log through the
injected `Logger` (https://vite.dev/config/shared-options.html,
https://vite.dev/guide/api-javascript). This also corresponds to "Bug #5
(`--silent` ignored)" in the repo's own `test.plan.md`.

The nuance that makes this MED-risk: the offending calls live partly in **pure
exported functions** (`getAllFiles`, `validateAssetReferences`) that have no
access to the plugin's logger instance and are imported directly by tests. The
fix must thread logging out of them without changing their tested return values.

## Current state

Direct `console.*` calls in `packages/plugin/src/index.ts` (re-verify line
numbers in the drift check):

- `getAllFiles` (a pure exported fn):
  - `index.ts:76` — `console.warn(... Symlink loop detected ...)`
  - `index.ts:104` — `console.warn(... Error processing item ...)`
  - `index.ts:114` — `console.error(... Error reading directory ...)`
- `transform` hook:
  - `index.ts:462` — `console.error(error)` (line 463 is the following
    `throw new Error(error)` — edit 462, not 463)
- `buildStart` catch:
  - `index.ts:437` — `console.error(... Error during buildStart ...)` then
    rethrow.
- `runRescan` catch (`configureServer`):
  - `index.ts:519` — `console.error(... Error updating static assets ...)`
- Deprecation warnings at factory time (no logger yet — these are arguably fine):
  - `index.ts:300`, `index.ts:307` — `console.warn(...)`.

The existing logger helpers to reuse (`index.ts:358-365`):
```ts
const info = (msg: string) => { if (logger) logger.info(msg); else console.log(msg); };
const warn = (msg: string) => { if (logger) logger.warn(msg); else console.warn(msg); };
```
`logger` is captured in `configResolved` from `resolvedConfig.logger`
(`index.ts:386`). A `Logger` also exposes `.error(msg)`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install --frozen-lockfile` | exit 0 |
| Typecheck | `cd packages/plugin && bun run typecheck` | exit 0 |
| Build | `cd packages/plugin && bun run build` | exit 0 |
| Core tests | `cd packages/plugin && bun run test` | all pass |
| Extended tests | `cd packages/plugin && bun run test:unit-extended` | all pass |

## Scope

**In scope**:
- `packages/plugin/src/index.ts` (logging only — no behavior/return-value change)
- `packages/plugin/tests-extended/logging.test.ts` (new) — add a
  `--silent`/logger-routing test (see Test plan)

**Out of scope** (do NOT touch):
- The plugin's behavior, return values, thrown errors, or the **signatures** of
  the exported pure functions in a way that breaks existing tests — see STOP
  conditions. (You MAY add an *optional* trailing parameter; you may NOT change
  existing positional params or return types.)
- `test-apps/`, harness, other configs.

## Git workflow

- Branch: `advisor/006-logger`.
- Commit: `refactor: route plugin logging through Vite logger`.
- Do NOT push/PR unless instructed.

## Steps

### Step 1: Add an `error()` helper alongside `info`/`warn`

After the `warn` helper (`index.ts:365`), add:
```ts
const error = (msg: string) => { if (logger) logger.error(msg); else console.error(msg); };
```
Use this for the plugin-hook error paths.

**Verify**: `cd packages/plugin && bun run typecheck` → exit 0.

### Step 2: Convert the plugin-hook console calls (these have logger access)

Replace, preserving the exact message strings and the throw/rethrow behavior:
- `index.ts:437` `console.error(...)` → `error(...)` (keep the following
  `throw err`).
- `index.ts:462` `console.error(error)` → `error(error)` (keep the following
  `throw new Error(error)` — the thrown error is what fails the build; the log is
  separate). Note: the local variable is named `error` here (the message string);
  rename the helper call carefully or rename the local to avoid shadowing —
  prefer renaming the local message variable to `assetError` to avoid colliding
  with the new `error()` helper.
- `index.ts:519` `console.error(...)` → `error(...)`.

**Verify**: `cd packages/plugin && bun run build && bun run test` → all pass.

### Step 3: Thread logging out of the pure functions (`getAllFiles`)

`getAllFiles` is exported and tested directly, so it has no `logger`. Add an
**optional** logging callback parameter with a console-based default so existing
callers and tests are unaffected:
```ts
async function getAllFiles(
  dir: string,
  baseDir: string,
  isIgnored: (path: string) => boolean,
  onWarn: (msg: string) => void = (m) => console.warn(m),
  _ancestors?: ReadonlySet<string>
): Promise<string[]>
```
Replace the three `console.warn`/`console.error` calls inside with `onWarn(...)`.
Then, at the plugin's two call sites (`index.ts:429` in `buildStart` and
`index.ts:494` in `runRescan`), pass the plugin's `warn` helper as `onWarn` so
production logging routes through Vite's logger.

**Important**: `_ancestors` is the internal recursion param. Recursive calls
inside `getAllFiles` (`index.ts:100`) must forward `onWarn` too. Keep
`_ancestors` last so the public "callers should not pass it" contract holds.

**Verify**:
- `cd packages/plugin && bun run typecheck` → exit 0.
- `cd packages/plugin && bun run test` and `bun run test:unit-extended` → all
  pass (the default keeps existing `getAllFiles` tests green).

### Step 4: Leave factory-time deprecation warnings as-is (or document why)

`index.ts:300` and `:307` fire before `configResolved`, so no `logger` exists
yet. Leave them as `console.warn` (the existing tests at `tests-extended/
options.test.ts` spy on `console.warn` for these — changing them would break
those tests). Add a one-line comment noting they intentionally use `console`
because they run before the logger is available.

**Verify**: `cd packages/plugin && bun run test:unit-extended` → the
deprecation-warning tests still pass.

### Step 5: Add a regression test for logger routing

In a new `packages/plugin/tests-extended/logging.test.ts` (or appended to an
existing extended test file), add a test that drives a path which logs a warning
(e.g. a missing source directory in `buildStart`, which calls `warn(...)` at
`index.ts:421`) with a **custom logger** injected via `configResolved`, and
assert the custom logger's `warn` was called and `console.warn` was not.

**Important — use the right exemplar:** the logger-injection pattern lives in
`packages/plugin/tests-extended/root.test.ts`, NOT `errors.test.ts`
(`errors.test.ts` only calls `validateAssetReferences` directly / spies on
`console.warn`). Read `root.test.ts` first: it builds a `fakeLogger`
(`{ info, warn, warnOnce, error, ... }`) and calls
`plugin.configResolved.call({}, { logger: fakeLogger, root })` **before**
`plugin.buildStart.call({})`. You MUST call `configResolved` with the fake logger
first — otherwise `logger` is null and the code uses the `console` fallback,
defeating the test. Reuse `makeFixture` from `tests-extended/helpers.ts` for the
fixture.

**Verify**: `cd packages/plugin && bun run test:unit-extended` → the new test
passes; total count increased by the number you added.

## Test plan

- New test: a custom `Logger` injected via the `configResolved` hook receives the
  warning (proves routing); `console.warn` is not used on that path. Model after
  the `fakeLogger` + `configResolved.call(...)` pattern in
  `tests-extended/root.test.ts`.
- Keep the existing `getAllFiles` symlink/error tests green via the
  default-parameter approach (no signature break).
- Run both unit suites and the build.

## Done criteria

ALL must hold:

- [ ] `grep -n "console\.\(warn\|error\|log\)" packages/plugin/src/index.ts`
      returns only: the two factory-time deprecation warnings (`:300`,`:307`),
      the `console`-fallback inside the `info`/`warn`/`error` helpers, and the
      default param in `getAllFiles`. No bare `console.*` remains in hook bodies.
- [ ] `cd packages/plugin && bun run typecheck` exits 0
- [ ] `cd packages/plugin && bun run build` exits 0
- [ ] `cd packages/plugin && bun run test` and `bun run test:unit-extended` pass
- [ ] A new test asserts logging routes through an injected custom logger
- [ ] Exported function return types/throws unchanged; only an optional trailing
      param added to `getAllFiles`
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- Changing `getAllFiles` requires altering an existing positional parameter or
  its return type to make tests pass — the optional-param approach should avoid
  this; if it doesn't, the test expectations have drifted — report.
- Any existing test that spies on `console.warn`/`console.error` starts failing —
  it means a path you converted is one the tests assert on `console`; report
  which test so the conversion vs. test-update tradeoff can be decided.
- You find a `console.*` call whose message or control flow you can't preserve
  exactly through the logger — report it.

## Maintenance notes

- After this, a reviewer should reject any new bare `console.*` in `src/` — the
  Biome config from plan 003 can enforce this via the `noConsole`/`no-console`
  rule (consider enabling it as a follow-up).
- The factory-time deprecation warnings remain on `console` by necessity; if Vite
  ever exposes a logger at plugin-factory time, revisit them.

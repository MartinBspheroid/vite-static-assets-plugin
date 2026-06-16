# Plan 008: Fix the husky pre-commit hook (remove per-commit version bump; run a fast check)

> **Executor instructions**: Follow step by step; run every verification command
> and confirm the expected result. On any "STOP condition", stop and report.
> When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 591af05..HEAD -- .husky/pre-commit package.json`
> If either changed, compare the excerpts below against the live files before
> editing; on mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none (pairs well with 003 if a `lint` script exists)
- **Category**: dx / build
- **Planned at**: commit `591af05`, 2026-06-15

## Why this matters

The current pre-commit hook does two harmful things on **every commit**:

1. `bun bumpp patch` — bumps the package version on every commit. Versions should
   change at **release** time (the repo already has a proper `release` script:
   `bumpp package.json packages/*/package.json --commit --push --tag`). Bumping
   per-commit causes meaningless version churn, near-guaranteed `package.json`
   merge conflicts on any branch, and a dirty working tree after each commit (the
   bump isn't staged into the commit). `bumpp` is also interactive by default, so
   in a non-interactive commit context it can prompt/hang.
2. `bun test:coverage` — runs the **full coverage** suite on every commit. Slow
   pre-commit feedback trains contributors to use `--no-verify`. A pre-commit
   should run a *fast* gate; coverage belongs in CI.

Both lines also use `bun <name>` rather than `bun run <name>` — fragile, and
`bun test:coverage` can collide with Bun's built-in `bun test` runner instead of
running the package script.

## Current state

`.husky/pre-commit` (entire file — 3 lines, no trailing newline):
```
bun test:coverage
bun bumpp patch
echo "🚀 Committing changes..."
```

Relevant `package.json` (root) scripts:
```
"test": "cd packages/plugin && vitest run",
"test:coverage": "cd packages/plugin && vitest run --coverage",
"prepare": "husky",
"release": "bumpp package.json packages/*/package.json --commit --push --tag",
```
- The proper version-bump path is `release` (run manually by a maintainer). The
  pre-commit bump is redundant with and contradictory to it.
- Husky is set up via `"prepare": "husky"`; hooks live in `.husky/`.
- Fast checks available: `cd packages/plugin && bun run typecheck` (`tsc
  --noEmit`) and `cd packages/plugin && bun run test` (the 41-test core suite,
  ~2s). If plan 003 has landed, `cd packages/plugin && bun run check` (Biome)
  also exists — prefer including it; otherwise omit it.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Typecheck | `cd packages/plugin && bun run typecheck` | exit 0 |
| Core tests | `cd packages/plugin && bun run test` | 41 pass, ~seconds |
| (if 003 landed) Lint | `cd packages/plugin && bun run check` | exit 0 |
| Confirm bumpp NOT in hook | `grep -c bumpp .husky/pre-commit` | `0` |

## Scope

**In scope** (the only file you should modify):
- `.husky/pre-commit`

**Out of scope** (do NOT touch):
- `package.json` scripts — the `release` script is the correct version-bump path;
  leave it. Do not add or remove npm scripts here.
- CI workflows — coverage/lint gating in CI is a separate concern (plan 003 adds
  the lint job).
- Do NOT change husky's setup (`prepare`/`.husky/_`).

## Git workflow

- Branch: `advisor/008-precommit`.
- Commit: `fix: make pre-commit hook fast and stop bumping version per commit`.
- Do NOT push/PR unless instructed.
- Note: because you're editing the very hook that runs on commit, the executor
  may need `git commit --no-verify` for *its own* commit if the intermediate
  state is awkward — but the END state must be a working, fast hook.

## Steps

### Step 1: Replace the hook body

Rewrite `.husky/pre-commit` to run a fast verification gate and **remove the
version bump entirely**. Target content (drop the Biome line if plan 003 has not
landed — verify the `check` script exists first with
`grep -n '"check"' packages/plugin/package.json`):

```sh
cd packages/plugin && bun run typecheck && bun run test
```

If plan 003's `check` script exists, prefer:
```sh
cd packages/plugin && bun run check && bun run typecheck && bun run test
```

Keep it minimal. Do not run `test:coverage`, `test:unit-extended` (slower), the
harness (very slow), or anything that mutates files. Modern husky (v9, which this
repo uses) does not need the old shebang/`. "$(dirname …)/_/husky.sh"` preamble —
a plain command file is fine.

**Verify**:
- `grep -c bumpp .husky/pre-commit` → `0`
- `grep -c "test:coverage" .husky/pre-commit` → `0`
- The hook file contains the fast commands above.

### Step 2: Dry-run the hook commands

Run the exact command(s) you put in the hook, from the repo root, to confirm they
pass and are fast:

**Verify**:
- `cd packages/plugin && bun run typecheck` → exit 0
- `cd packages/plugin && bun run test` → 41 pass
- (if included) `cd packages/plugin && bun run check` → exit 0
- The working tree is unchanged afterward (no version bumped):
  `git status -s package.json packages/plugin/package.json` → no output.

### Step 3: Confirm no version churn

Confirm the hook no longer mutates any `package.json`. After running Step 2's
commands, `git diff --stat` should show no change to any version field.

**Verify**: `git diff -- package.json packages/plugin/package.json` → empty.

## Test plan

No unit tests (a git hook isn't unit-testable here). Verification is:
- The hook file no longer references `bumpp` or `test:coverage`.
- The hook's commands run green and fast and leave the tree clean.

## Done criteria

ALL must hold:

- [ ] `.husky/pre-commit` runs only a fast check (typecheck + core tests, plus
      lint if available); no `bumpp`, no `test:coverage`
- [ ] `grep -c bumpp .husky/pre-commit` → `0`
- [ ] Each command in the hook exits 0 when run manually
- [ ] Running the hook's commands does NOT modify any `package.json` version
- [ ] No file outside `.husky/pre-commit` is modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- The hook content doesn't match the excerpt above (drift since `591af05`).
- A command you intend to put in the hook fails when run manually (e.g.
  `typecheck` already failing) — report it; don't ship a hook that's red on a
  clean tree.
- You discover the per-commit `bumpp` is load-bearing for some documented release
  workflow (search `README.md`, `CONTRIBUTING.md`, `cliff.toml`) — if so, report
  before removing it.

## Maintenance notes

- Version bumping should stay in the `release` script only. A reviewer should
  reject any reintroduction of version mutation into commit hooks.
- If the team wants pre-push (rather than pre-commit) to run the heavier suites,
  that's a reasonable follow-up — add a `.husky/pre-push` running
  `test:unit-extended`; keep pre-commit fast.
- Consider `lint-staged` in a follow-up so the hook only checks changed files.

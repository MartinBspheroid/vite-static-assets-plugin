# Plan 002: Add CLAUDE.md and CONTRIBUTING.md so contributors/agents have a single source of truth

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving on. If a
> "STOP condition" occurs, stop and report. When done, update this plan's row
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 591af05..HEAD -- package.json packages/plugin/package.json .github/workflows/test.yml`
> If any changed, re-verify the commands in "Current state" against the live
> files before writing them into the docs.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `591af05`, 2026-06-15

## Why this matters

This repo is clearly developed with AI agents (`.aris/`, `.agents/`,
`test.plan.md` describing agent-authored test waves), yet there is no
`CLAUDE.md`/`AGENTS.md` capturing how to build/test/lint or the repo's
conventions. Every agent run and every new contributor re-derives the monorepo
layout and the three separate test suites from scratch. A short, accurate
`CLAUDE.md` (plus a `CONTRIBUTING.md` for humans) is high-leverage and low-risk:
it's pure documentation that makes every future change cheaper.

## Current state

Facts to encode (verified at `591af05` — re-verify in the drift check):

- **Monorepo** (bun workspaces). Root `package.json` `workspaces`:
  `["test-apps/*", "packages/*"]`. The published package is
  `packages/plugin/` (`vite-static-assets-plugin`); the single source file is
  `packages/plugin/src/index.ts`.
- **Package manager**: Bun (CI uses `oven-sh/setup-bun`, `bun install
  --frozen-lockfile`; `bun.lock` is committed).
- **Build**: `cd packages/plugin && bun run build` (`tsc`, emits `dist/`).
- **Typecheck**: `cd packages/plugin && bun run typecheck` (`tsc --noEmit`).
- **Three test suites** (all in CI — `.github/workflows/test.yml`):
  - Core unit: `cd packages/plugin && bun run test` → `packages/plugin/tests/`.
  - Extended unit: `cd packages/plugin && bun run test:unit-extended` →
    `packages/plugin/tests-extended/`.
  - Cross-framework harness: `bun run test:harness` (repo root) →
    `tests/harness.test.ts`, builds `test-apps/*`.
- **Node engines**: `^20.19.0 || ^22.12.0 || >=24.0.0`. Peer deps: `vite
  ^7||^8`, `typescript ^5`.
- **Pure functions are exported for testing** from `index.ts`: `getAllFiles`,
  `extractDirectories`, `generateVirtualModuleCode`, `generateDtsCode`,
  `validateAssetReferences` (line ~290). Tests import these directly — they must
  stay exported.
- **Commit style**: Conventional Commits (see `git log --oneline`); husky
  pre-commit hook configured (`.husky/`).
- **Release**: `release` script uses `bumpp` to bump + tag; publish is via the
  `v*.*.*` tag trigger in `.github/workflows/npm-publish.yml`.
- Ongoing work tracker: `test.plan.md` (expanding the harness from ~23 to ~150
  scenarios across 5 waves; lists known bugs #1–#10).

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Install | `bun install --frozen-lockfile` | exit 0 |
| Sanity-check a documented command | run each command you put in the docs | exit 0 |

## Scope

**In scope** (create these files):
- `CLAUDE.md` (repo root) — agent-facing.
- `CONTRIBUTING.md` (repo root) — human-facing (may be shorter and link to
  `CLAUDE.md` for the command reference to avoid duplication).

**Out of scope** (do NOT touch):
- Any source file, config, or workflow. This plan only adds documentation.
- `AGENTS.md` — create only `CLAUDE.md`; if the maintainer later wants an
  `AGENTS.md` alias, that's a separate change.

## Git workflow

- Branch: `advisor/002-claude-md`.
- Commit: `docs: add CLAUDE.md and CONTRIBUTING.md`.
- Do NOT push or open a PR unless instructed.

## Steps

### Step 1: Write `CLAUDE.md`

Create `CLAUDE.md` at the repo root with these sections (keep it tight — a
reference card, not an essay):

1. **What this is** — one paragraph: a Vite plugin generating typesafe static
   asset types via a `virtual:static-assets` module; published from
   `packages/plugin/`.
2. **Repo layout** — bullet the monorepo: `packages/plugin/` (source + unit
   tests), `tests/` (cross-framework harness), `test-apps/*` (per-framework
   fixtures the harness builds).
3. **Commands** — a table of the exact commands from "Current state" (build,
   typecheck, the three test suites). Note that the harness is run from the
   **repo root**, the others from `packages/plugin/`.
4. **Conventions** — Conventional Commits; the pure functions in `index.ts` are
   exported for tests and must stay exported; ESM-only; logging should go
   through Vite's logger (see `info`/`warn` helpers in `index.ts`) — do not add
   raw `console.*`.
5. **Before you commit** — typecheck + all three suites must pass; husky runs a
   pre-commit hook.
6. **Active work** — point at `test.plan.md`.

**Verify**: every command you wrote in the table actually runs.
`grep -n "test:harness" CLAUDE.md` → match.

### Step 2: Write `CONTRIBUTING.md`

Create `CONTRIBUTING.md` for human contributors: how to install (Bun), where the
source lives, how to run tests (link to or restate the `CLAUDE.md` command
table — don't duplicate it verbatim if you can link), commit-message
expectations (Conventional Commits), and how to propose a change (issue/PR, per
the README's existing "Contributing" blurb at `README.md:308-310`).

**Verify**: `test -f CONTRIBUTING.md && test -f CLAUDE.md` → both exist.

### Step 3: Confirm every documented command is real

For each command you put in `CLAUDE.md`'s table, run it once and confirm exit 0
(or, for the harness which is slow, at least confirm the script exists in the
relevant `package.json`).

**Verify**:
- `cd packages/plugin && bun run typecheck` → exit 0.
- `cd packages/plugin && bun run test` → all pass.
- `grep -n "\"test:harness\"" package.json` → match (script exists).

## Test plan

No code; no automated tests. Verification = the commands above all succeed and
both files exist with the required sections.

## Done criteria

ALL must hold:

- [ ] `CLAUDE.md` exists at repo root with the 6 sections above
- [ ] `CONTRIBUTING.md` exists at repo root
- [ ] Every command in `CLAUDE.md` was executed (or its script confirmed present)
      and matches reality
- [ ] No file outside `CLAUDE.md`/`CONTRIBUTING.md` is modified (`git status`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report if:

- Any command you intended to document fails (e.g. a script was renamed) — report
  the discrepancy rather than documenting a broken command.
- A `CLAUDE.md` or `AGENTS.md` already exists — reconcile with it instead of
  overwriting.

## Maintenance notes

- Keep `CLAUDE.md`'s command table in sync whenever `package.json` scripts
  change; a reviewer should reject script renames that don't update it.
- If an `AGENTS.md` convention is later adopted, make it a thin pointer to
  `CLAUDE.md` rather than a second copy.

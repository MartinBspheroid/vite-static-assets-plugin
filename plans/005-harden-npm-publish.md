# Plan 005: Harden npm publishing — OIDC Trusted Publishing, provenance, and a pre-publish gate

> **Executor instructions**: Follow step by step; run every verification command.
> This plan touches the **release/publish** path, which is hard to fully test
> without cutting a release — honor the STOP conditions strictly and do NOT
> trigger a real publish. When done, update this plan's row in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 591af05..HEAD -- .github/workflows/npm-publish.yml packages/plugin/package.json`
> If changed, re-verify the excerpts below against the live files first.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED (release path)
- **Depends on**: none
- **Category**: dx / security
- **Planned at**: commit `591af05`, 2026-06-15

## Why this matters

The publish workflow uses a long-lived `NPM_TOKEN` secret, no provenance, and a
non-idiomatic publish command. The current 2025–2026 standard is **npm Trusted
Publishing via GitHub Actions OIDC** (GA 2025-07-31), which removes the
long-lived token entirely and **auto-generates provenance attestations** — a
direct mitigation against token-exfiltration supply-chain attacks. Sources:
https://github.blog/changelog/2025-07-31-npm-trusted-publishing-with-oidc-is-generally-available/,
https://docs.npmjs.com/trusted-publishers/.

This plan has a **manual prerequisite** the repository maintainer must do on
npmjs.com (configure the trusted publisher); the executor cannot do that. See
STOP conditions.

## Current state

`.github/workflows/npm-publish.yml` (triggered on `v*.*.*` tags):

```yaml
      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '24'
          registry-url: 'https://registry.npmjs.org/'
      ...
      - name: Publish Package
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
        run: cd packages/plugin && bun run npm publish
```

Issues, each verified:
1. `bun run npm publish` is non-idiomatic — it runs the `npm` binary through
   Bun's task runner (there is no `npm` script in `packages/plugin/package.json`),
   adding pointless indirection. Idiomatic: plain `npm publish`.
2. No `--provenance` and no OIDC — relies on a stored `NPM_TOKEN`.
3. No `permissions: id-token: write` on the job (required for OIDC).
4. No pre-publish package validation. `publint` and `@arethetypeswrong/cli`
   (attw) are now table stakes for a published TS library — they catch broken
   `exports`, condition mis-ordering, and "masquerading" types before they ship.
   (The package's current `exports` ordering is already correct — `types` first —
   but a CI gate prevents future regressions.)

Package facts: ESM-only, `exports["."]` has `types` then `import`/`default`
(`packages/plugin/package.json`). Build output is `dist/`.

## Commands you will need

| Purpose | Command | Expected |
|---|---|---|
| Validate published shape | `cd packages/plugin && bun run build && bun x publint` | reports issues / clean |
| Validate types resolution | `cd packages/plugin && bun x @arethetypeswrong/cli --pack` | reports / clean |
| Lint the workflow YAML | `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/npm-publish.yml'))"` | exit 0 |

## Scope

**In scope**:
- `.github/workflows/npm-publish.yml` (rewrite the publish job)
- `packages/plugin/package.json` (optionally add `publint`/attw scripts; do NOT
  change `exports` — it's already correct)

**Out of scope** (do NOT touch):
- The npm-side trusted-publisher configuration (maintainer does this on
  npmjs.com — it is a prerequisite, see Step 1 / STOP conditions).
- `packages/plugin/package.json` `exports`/`version`/`files` — do not alter the
  package's published shape in this plan.
- `src/` — no source changes.

## Git workflow

- Branch: `advisor/005-publish-hardening`.
- Commit: `ci: use npm trusted publishing with provenance; add publint/attw gate`.
- Do NOT push, tag, or trigger a release.

## Steps

### Step 1: Confirm the trusted-publisher prerequisite (do not proceed blind)

Trusted publishing requires the maintainer to register this GitHub repo +
**workflow filename** (`npm-publish.yml`) as a trusted publisher in the npm
package settings, and requires npm CLI ≥ 11.5.1 and Node ≥ 22.14.0 in the
runner. If you cannot confirm the npm-side config has been done, **do not delete
the `NPM_TOKEN` path** — instead implement the lower-risk subset (Steps 2 + 4:
fix the command + add provenance with the existing token) and leave a clearly
marked TODO for the OIDC switch. See STOP conditions.

### Step 2: Fix the publish command

Replace `cd packages/plugin && bun run npm publish` with `npm publish` run from
the package dir (use a `working-directory: packages/plugin` step or
`cd packages/plugin && npm publish`). Plain `npm` is required anyway because
trusted publishing needs the npm CLI.

### Step 3: Switch to OIDC Trusted Publishing (only if Step 1 confirmed)

- Add to the job:
  ```yaml
  permissions:
    id-token: write
    contents: read
  ```
- Ensure the runner has npm CLI ≥ 11.5.1 (e.g. add a step
  `npm install -g npm@latest` or pin a recent version) and Node ≥ 22.14
  (`node-version: '24'` already satisfies this).
- **Remove** the `env: NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}` from the
  publish step. With trusted publishing, `npm publish` mints short-lived
  credentials via OIDC and **publishes provenance automatically** — no
  `--provenance` flag and no token needed.

If Step 1 was NOT confirmed, skip this step and instead in Step 2's command use
`npm publish --provenance` while keeping the token and adding
`permissions: id-token: write` (provenance with a token still requires the
id-token permission). Mark a TODO to migrate to full OIDC.

### Step 4: Add a pre-publish validation gate

Before the publish step (after build), add steps that fail the job on a bad
package:
```yaml
      - name: Validate package (publint)
        run: cd packages/plugin && bun x publint
      - name: Validate types (are-the-types-wrong)
        run: cd packages/plugin && bun x @arethetypeswrong/cli --pack
```
Run these locally first to confirm the package is currently clean (or to capture
known warnings to allow). If attw reports issues that are false positives for an
ESM-only package (e.g. CJS-resolution warnings), use its `--ignore-rules` for the
specific rule rather than dropping the check.

**Verify (local)**:
- `cd packages/plugin && bun run build && bun x publint` → no errors.
- `cd packages/plugin && bun x @arethetypeswrong/cli --pack` → no blocking errors
  (ESM-only "no CJS" notes are acceptable; document any `--ignore-rules`).

### Step 5: Validate the workflow file

**Verify**:
`python3 -c "import yaml;yaml.safe_load(open('.github/workflows/npm-publish.yml'))"`
→ exit 0. Re-read the job to confirm: no `NPM_TOKEN` env on the publish step (if
Step 3 path) OR token + `--provenance` (fallback path); `permissions:
id-token: write` present; publish command is plain `npm publish`.

## Test plan

This path cannot be exercised without a real tag/release, which is out of scope.
Validation is:
- `publint` and attw pass locally against the built package.
- The workflow YAML parses.
- A careful re-read confirms the token/permission/command changes match the
  chosen path (Step 3 full-OIDC, or the fallback).

## Done criteria

ALL must hold:

- [ ] Publish step uses plain `npm publish` (not `bun run npm publish`)
- [ ] Either: (full OIDC) no `NPM_TOKEN` env on publish + `permissions:
      id-token: write` + npm CLI ≥ 11.5.1 ensured; OR (fallback) `npm publish
      --provenance` with `id-token: write` and a clearly marked TODO to migrate
- [ ] `publint` and attw steps added before publish and pass locally
- [ ] `.github/workflows/npm-publish.yml` parses as valid YAML
- [ ] `packages/plugin/package.json` `exports`/`version`/`files` unchanged
- [ ] No `src/` changes
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report (do not improvise) if:

- You cannot confirm whether the npm-side trusted-publisher config exists. Do the
  fallback subset (Steps 2 + 4 + provenance-with-token) and report that full OIDC
  needs the maintainer to register the publisher on npmjs.com. **Never** delete
  the working `NPM_TOKEN` path without a confirmed OIDC replacement — that would
  break releases.
- `publint` or attw reports a real packaging error (e.g. an entry point that
  doesn't resolve) — that's a separate finding; report it rather than masking it
  with broad ignore rules.
- Any step would change the package's `exports` or `version`.

## Maintenance notes

- After this lands, the next release is the real test. A reviewer/maintainer
  should watch the first tag-triggered run and confirm provenance shows on the
  npm package page.
- Once OIDC is in place, the `NPM_TOKEN` repo secret can be deleted — note this
  but leave the deletion to the maintainer.
- Keep `publint`/attw in CI; they're cheap insurance against future `exports`
  regressions.

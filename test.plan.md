# Test Suite Expansion Plan

This is the planning document for expanding the cross-framework test harness from 23 to ~150 scenarios. Implementation tracker, not a published doc — feel free to edit as work progresses.

---

## Background

The v3 PR (#4) added 23 cross-framework integration tests. Three brainstorming agents enumerated **~245 distinct scenarios** worth covering. After dedup and prioritization this plan commits to **~150 scenarios in 5 implementation waves**, plus **~30 deferred** to CI matrix or nightly-only. The plan also surfaces **~10 likely real bugs** in the current plugin source that the new tests will hit; those become a parallel patch series.

---

## Bugs the new tests will likely surface

Land these as separate small commits *before* enabling the tests that depend on them. Each was identified by 2 of 3 agents independently.

| # | Bug | Severity | Surfaced by |
|---|---|---|---|
| 1 | Filename codegen not escaped (`it's.png` produces invalid TS/JS) | High | Robustness #19/20/21, Plugin B3/B6 |
| 2 | Symlink loops cause infinite recursion in `getAllFiles` | High | Robustness #23/24, Plugin B13 |
| 3 | Watcher listener leak on `server.restart()` | High | Robustness #34/37/83 |
| 4 | Lingering debounce timer keeps event loop alive after `server.close()` | Medium | Robustness #82 |
| 5 | `--silent` flag ignored — plugin uses `console.log` directly | Medium | Robustness #66 |
| 6 | `.mts`/`.cts`/`.mjs`/`.cjs` not transform-validated | Medium | Plugin D15 |
| 7 | Negative `maxDirectoryDepth` silently produces empty set | Low | Plugin A21, Robustness #50 |
| 8 | `debounce: Infinity`/`NaN` clamps to 1ms unintuitively | Low | Robustness #48 |
| 9 | Multiple plugin instances collide on virtual module ID | Design | Plugin G1 |
| 10 | Parallel-build dts write race | Design | Robustness #16 |

Bugs 1–8 are easy fixes. Bugs 9, 10 need design discussion before implementing — flag for human review.

---

## Infrastructure (PR B)

A single helper file `tests/harness-helpers.ts` exporting:

- `makeFixture({ files, dirs, depth, encoding })` — programmatic fixture creator
- `assertDtsTypechecks(dtsContents, consumerSnippet)` — runs `tsc --noEmit --strict` on generated dts
- `assertVirtualModuleParses(jsCode)` — `acorn` parse check
- `withDevServer(app, fn)` — spawns `vite dev`, returns `{ writeFile, deleteFile, renameFile, waitForRegen, getDts, ws }`
- `runJSDOM(htmlString, bundleJsString)` — JSDOM client-execute for hydration parity
- `hashSha256(content)` — golden snapshots
- `stripFrameworkBoilerplate(html, selectors)` — extract harness fragment via cheerio

Plus committed fixtures:
- `tests/fixtures/golden/` — checked-in dts/virtual-module/SSR-fragment SHA-256 snapshots for one canonical fixture
- `tests/fixtures/specials/` — sample files for unicode/quotes/special-char tests

Estimated: ~400 LOC, 1–2 sessions.

---

## Wave 1 — Plugin behavior, build-time only (~50 scenarios, fast)

Pure unit-style tests. Run as a SECOND vitest config (`vitest.unit-extended.config.ts`) under `packages/plugin/tests-extended/`. Import the plugin module directly — no app builds.

**1A. Options matrix (15)** — A1, A2, A3, A4, A5, A6, A7, A8, A9, A10, A11, A12, A13, A24, A25 from the plugin agent. Default vs explicit `directory`/`typesOutputFile`, `ignore` glob behaviors (single, recursive, negation, empty), deprecated-option precedence.

**1B. Codegen correctness (12)** — B1, B2, B3, B6, B7, B8, B9, B10, B11, B14, B15, B19. Special-char names (after bug #1 fix), unicode, capital extensions, multi-dot, empty/single union, deep nest truncation, sort stability. Each uses `assertDtsTypechecks` and `assertVirtualModuleParses`.

**1C. `staticAssets()` runtime (8)** — C1–C8 directly invoking `generateVirtualModuleCode` output via `vm.runInNewContext` with a shimmed `import.meta.env.BASE_URL`.

**1D. Validation regex behavior (12)** — D1, D2, D3, D4, D5, D9, D10, D11, D12, D13, D14, D15. Pin both correct matches and known-limitation false positives/negatives. After bug #6 fix, D15 turns from a gap to a positive test.

**1E. Error messages (4)** — H1, H3, H5, plus a deprecation warning text snapshot.

**Cost: ~30s suite runtime. CI tier: every PR.**

---

## Wave 2 — Cross-framework parameterized expansion (~40 scenarios, medium)

Extend `tests/harness.test.ts` with `describe.each(APPS)`.

- **2A. Hydration parity (3)** — JSDOM-execute client bundle on SSR HTML; assert zero hydration warnings. Highest signal.
- **2B. Data-loading boundary (3)** — TanStack `loader`, Nuxt `useAsyncData`, SvelteKit `+page.server.ts`. URL round-trips through SSR payload to client.
- **2C. Multi-route / layout (5)** — React lazy, Vue async, TanStack nested, Nuxt layout, SvelteKit `<svelte:head>`. Plugin transforms every chunk.
- **2D. SSG / prerender (2)** — `nuxt generate`, SvelteKit `prerender = true`.
- **2E. Adapter / preset matrix (3)** — TanStack `cloudflare-module`, Nuxt `cloudflare-module`, SvelteKit `adapter-static`. Build-only; assert no `node:util` in worker bundle.
- **2F. Auto-import shadowing (1, Nuxt-only)** — `app/composables/staticAssets.ts` collision.
- **2G. CSS / preprocessor (2)** — Vue `<style>`, Svelte `<style>`. Pin negative behavior.
- **2H. Production assertions per app (5)** — Zero `import.meta.env.BASE_URL` matches across ALL chunks. Plugin order before/after framework plugin produces identical output.
- **2I. Base URL edge cases (5)** — CDN absolute (`https://cdn.example.com/v1/`), `/sub` no trailing slash, empty base, `process.env.BASE_URL` doesn't leak.
- **2J. Module resolution (2)** — TanStack `tsconfigPaths`, SvelteKit `$lib`/`$app/paths`.

**Cost: +3–5min runtime. PR tier (harness budget rises to ~7min cold / ~3min warm).**

---

## Wave 3 — Watcher / HMR / dev server (~25 scenarios, medium)

Requires `withDevServer` helper.

- **3A. File-event handling (10)** — add, delete, rename, deep nested add, ignore-pattern short-circuit, debounce burst, touch with no content change, file outside scan dir, post-`buildEnd` no writes.
- **3B. Restart cleanliness (3)** — restart, listener count delta, post-restart module graph state. Depends on bug #3 fix.
- **3C. SvelteKit `kit.paths.base` mid-session (1)**
- **3D. Fallback `client.d.ts` (4)** — F1, F2, F3, F4.

**Cost: ~2min. PR (subset) + nightly (full).**

---

## Wave 4 — Robustness, scale, adversarial (~30 scenarios)

- **4A. Scale (5 PR)** — 1k flat files, long filename, deep nest, large file (no read), 5k flat. Add ~10–20s each. Run as `test:harness:scale` script gated on a label.
- **4A-nightly (3)** — 10k files, 100×100 dirs, size sweep + TS choke threshold.
- **4B. Codegen safety / fuzz (8)** — apostrophe, backslash, newline, tab, full unicode, injection-shaped filename, glob meta-chars, empty `public/`. All cheap, PR-tier.
- **4C. Malformed inputs (8)** — empty/`/` /file/`null`/empty array/`Infinity` for various options.
- **4D. Concurrency (3, nightly)** — mid-scan delete, concurrent dev servers, parallel builds.
- **4E. Filesystem adversities (3)** — locked dir, unwritable typesOutputFile, read-only repo.
- **4F. Diagnostic quality (3)** — no absolute path leaks, `NO_COLOR`, `--silent`.

---

## Wave 5 — Golden snapshots, package hygiene, OS matrix (~10 + matrix)

- **5A. Golden output (3)** — build-twice byte-identical, dts SHA-256, virtual JS SHA-256.
- **5B. Package hygiene (3)** — tarball size baseline, ESM-only `dist`, `publint` + `arethetypeswrong`.
- **5C. Cross-platform CI matrix (4)** — Linux pin (paths use `/`), Windows fixture build, Windows drive-letter, macOS HFS+ NFC/NFD.
- **5D. Hook order invariants (3)** — buildStart before transform, configureServer before first watcher event, no lingering timer post-close.

---

## Implementation order

Each item is a self-contained PR.

| # | PR | Description | Status |
|---|---|---|---|
| 1 | A | Bug fixes batch 1: codegen escaping (#1), symlink loops (#2), `.mts/.cts` (#6), `--silent` (#5) + 8 unit tests | TODO |
| 2 | B | Test infrastructure: `tests/harness-helpers.ts`, fixtures | TODO |
| 3 | C | Wave 1 (~50 plugin behavior tests) — separate `vitest.unit-extended.config.ts` | TODO |
| 4 | D | Bug fixes batch 2: watcher listener leak (#3), lingering timer (#4), debounce validation (#8), `maxDirectoryDepth` validation (#7) | TODO |
| 5 | E | Wave 3 (~25 dev/HMR tests) — depends on PR D | TODO |
| 6 | F | Wave 2 (~40 framework expansion tests) | TODO |
| 7 | G | Wave 4 (~30 robustness tests) — split PR-tier and nightly | TODO |
| 8 | H | Wave 5 (golden + matrix); add Windows + macOS CI rows | TODO |
| 9 | I (opt) | Bug fixes batch 3: multi-instance virtual module (#9), parallel-build race (#10). Need design discussion. | DEFERRED |

---

## CI tier final shape

After Wave 5:

- **`unit`** (PR, every push) — `packages/plugin/tests/*.test.ts` (~35 tests, < 5s)
- **`unit-extended`** (PR) — Wave 1 + Wave 4 PR-tier (~80 tests, ~30s)
- **`harness`** (PR) — Wave 2 + Wave 3 PR-tier (~70 tests, ~7min cold / ~3min warm)
- **`harness-nightly`** (cron, 03:00 UTC) — Wave 4 nightly (scale, concurrency, soak)
- **`os-matrix`** (PR, Linux + macOS + Windows) — golden + cross-platform pinning
- **`package-hygiene`** (PR) — `publint`, `arethetypeswrong`, tarball size

PR runtime: ~10–12 min cold. Nightly: ~30 min.

---

## Deferred (~40 scenarios)

Not in this plan:

- Robustness #31 (slowfs/NFS): requires LD_PRELOAD or fuse mounts
- Robustness #36 (30-min soak): manual pre-release only
- Framework #56 (streaming SSR with `Suspense`): unstable across versions
- Framework #28 (server-only `.server.vue`): Nuxt feature in flux
- Framework #56–#63 (chunking, manualChunks, alias shadowing): low signal
- Plugin G2/G3/G4 (multi-instance variants): blocked on bug #9
- Plugin H6 (chmod 000 file): flaky on CI

---

## Verification per wave

After each PR:
1. `bun run test` — unit pass
2. `bun run test:unit-extended` — Wave 1 pass
3. `bun run test:harness` — full integration pass
4. `bun run test:harness:nightly` (manual) — nightly pass
5. CI matrix green on Linux + macOS + Windows for goldens

After Wave 5: ~150 unique scenarios, ~6.5× current coverage, within ~10-min PR budget.

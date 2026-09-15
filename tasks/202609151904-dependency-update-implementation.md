# Dependency update — September 2026

## Overview

Housekeeping pass after the `npm run check` cleanup. Three goals: clear the `npm audit` backlog,
make `package.json` state what the project actually runs on, and move every dependency to the
newest version the supply-chain window and the peer graph allow.

Outcome: **9 of 10 advisories retired**, 28 stale ranges refreshed, **4 majors taken**
(jsdom 30, openai 7, mailgun.js 14, vitest 5), **1 major deliberately deferred** (TypeScript 7).

## Supply-chain window

`.npmrc` sets `min-release-age=5`. npm 11.18+ honours this natively — `@npmcli/config` translates
it to `before = now − 5 days` (the unit is **days**), and `install`, `update`, `outdated`, `query`
and `audit` all consume it. No extra tooling was added, and nothing here bypassed it.

`npm audit fix` was deliberately **not** used: it is the one command that will reach past the
window if it decides it needs to. Phase 1 used `npm update` instead.

The window cost almost nothing this pass — it held back only `vitest`/`@vitest/ui` 5.0.1 (published
the same day), `openai` 7.15.0 and `@types/node` 26.6.0. Everything taken was ≥5 days old.

## Phases

### Phase 0 — Node floor (done by the repo owner)

Local Node moved 24.13.1 → **24.21.0**, and `package.json` gained:

```json
"engines": { "node": ">=24.15" }
```

This was a prerequisite, not a preference. jsdom 30 requires
`^22.22.2 || ^24.15.0 || >=26.0.0`, and `.npmrc` sets `engine-strict=true`, so on 24.13.1 npm
hard-failed with `EBADENGINE` rather than warning. It is also why `npm outdated` omitted jsdom
entirely — npm filtered the manifest out as incompatible before comparing versions.

CI (`ci.yml`, `node-version: '24'`) and Docker (`node:24-alpine`,
`gcr.io/distroless/nodejs24-debian12`) already resolve above 24.15, so the local machine had been
the only environment that could not install it. The `engines` field now states the floor explicitly
instead of leaving it implied by `engine-strict`.

### Phase 1 — audit cleared inside existing ranges (done by the repo owner)

`npm update` — no major crossed a caret boundary.

|           | Before | After |
| --------- | ------ | ----- |
| high      | 4      | 0     |
| moderate  | 5      | 0     |
| low       | 1      | 4     |
| **total** | **10** | **4** |

Retired: `sharp` → 0.35.4 (libheif), `@sveltejs/kit` → 2.70.3 (`Accept`-header ReDoS),
`vitest`/`@vitest/mocker` → 4.1.11 (path traversal), and `nanoid` / `postcss` / `brace-expansion`
transitively. The five `undici` advisories cleared in Phase 3 with jsdom 30.

**The 4 remaining lows are one advisory, and they are not actionable here.** `@sveltejs/kit@2.70.3`
pins `cookie@0.6.0` (`cookie <0.7.0`, out-of-bounds characters in name/path/domain); the other three
rows are `@sveltejs/kit`, `@sveltejs/adapter-node` and `@sveltejs/adapter-auto` reported as
depending on it. 2.70.3 is the newest Kit there is, so only upstream can retire this.
`npm audit fix --force` "fixes" it by moving Kit backwards across a major — a downgrade, not a fix.
Leave it until Kit bumps its `cookie` dependency.

### Phase 2 — manifest ranges refreshed

28 caret floors had drifted below the resolved versions (e.g. `"svelte": "^5.55.5"` with 5.56.7 on
disk, `"@sveltejs/kit": "^2.58.0"` with 2.70.1). Each was rewritten to the installed version, so the
manifest now states what the project runs on.

Verified no resolution drift: every `packages[*].version` in `package-lock.json` was compared
before and after — **zero changed**. Only the root range block moved, which is what a floor
refresh should do.

### Phase 3 — the four majors

Taken one at a time, each with its own test run, so a failure would be attributable.

**jsdom 29.1.1 → 30.0.1.** Only breaking change is the Node floor handled in Phase 0. Frontend
suite 321/321. This is also what retired the five `undici` advisories.

**openai 6.49.0 → 7.13.0.** The v7.0.0 release notes list exactly one breaking change: "require
Node.js 22". All six new peer deps (`ws`, `zod`, `undici`, `@smithy/*`, `@aws-sdk/*`) are
`optional: true`. No code change. Because `openaiImageClient.js` does not annotate the response, a
clean type-check alone was not treated as proof — openai 7's `images.d.ts` was read directly to
confirm the call still fits:

- all seven options the app passes still exist in `ImageGenerateParams`, with the app's values
  still in their unions (`quality: 'auto'`, `background: 'opaque'`, `output_format: 'webp'`,
  `size: '1024x1024'`)
- `generate()` is now overloaded for streaming; the app's non-streaming call resolves to
  `APIPromise<ImagesResponse>`
- `ImagesResponse.data` is `Array<Image> | undefined`, which matches the existing
  `response.data?.[0]?.b64_json` guard

**mailgun.js 13.3.0 → 14.0.1.** Sole breaking change is "update IP Pools client to Mailgun v3 API",
which this app never touches — `email.js` uses only `new Mailgun(FormData)`, `mg.client()` and
`messages.create()`. Dependencies are byte-identical between 13.3.0 and 14.0.1.

**vitest 4.1.11 → 5.0.0 (+ `@vitest/ui` 5.0.0).** Installed in one command: vitest 5 peers
`@vitest/ui` at an exact version, so they cannot move independently. Two breaking changes actually
bit — see below. The transient `ERESOLVE overriding peer dependency` warning during install was the
outgoing vitest 4.1.11 peering `@vitest/ui@4.1.11` mid-swap; the resulting tree is consistent and
`npm ls` reports no invalid or unmet peers.

Also added `"test:ui": "vitest --ui --config vitest.svelte.config.js"`. `@vitest/ui` had been
carried as a devDependency with no script, config or CI step referencing it; it is now reachable.

### Deferred — TypeScript 6.0.3, not 7.0.2

**This was not a risk-appetite call.** Two _direct_ dependencies declare they do not support it:

| Package                | `peerDependencies.typescript` |
| ---------------------- | ----------------------------- |
| `@sveltejs/kit@2.70.3` | `^5.3.3 \|\| ^6.0.0`          |
| `svelte-check@4.7.6`   | `^5.0.0 \|\| ^6.0.0`          |

`npm install typescript@7.0.2 --dry-run` confirms npm emits `ERESOLVE overriding peer dependency`
and pulls `@typescript/typescript-linux-x64` — the native Go port's platform-specific binary, which
would also put arch-gated optional deps into a lockfile that must install on both `node:24-alpine`
(musl) and `node:24-bookworm-slim` (glibc).

Since `npm run check:ci` gates both CI and `deploy.sh`, running `svelte-check` against a TypeScript
it does not claim to support is the wrong risk for a housekeeping pass. Revisit when
`@sveltejs/kit` widens its peer range.

## Vitest 5 — what actually broke

The migration surface was measured against the suite rather than assumed. Two of the seven
candidate breaking changes bit; the rest had zero exposure.

**1. `vi.mock` must be at module top level** — `test/lib/server/avatarManager.test.js`.
A `vi.mock(...)` sat inside `beforeEach`. Vitest 5 rejects this, and its error states the reason
the old placement was already a fiction: _"Although it appears nested, it will be hoisted and
executed before anything in this file."_ Moved to top level, next to `TEST_DATA_DIR`, with a
comment recording why it has to live there. Behaviour is unchanged — it was always hoisted.

**2. `document` is now a getter-only accessor on the jsdom Window** — `test/setup.svelte.js`.
This one failed **all 20 frontend files at import time**, before a single test ran:

```
TypeError: Cannot set property document of [object Window] which has only a getter
```

The cause was a defensive shim:

```js
global.window = global.window || {};
global.document = global.document || {};
```

Under `environment: 'jsdom'` both already exist, so `||` short-circuits to the existing value — but
the **assignment still happens**, writing `document` its own value straight into a property that no
longer has a setter. Rewritten to only create when genuinely absent:

```js
if (!global.window) global.window = {};
if (!global.document) global.document = {};
```

Worth noting the block is dead code under jsdom; it was kept (guarded rather than deleted) so the
setup still behaves if ever run under a non-DOM environment.

**3. `reporter` → `reporters`** — `vitest.svelte.config.js`. The singular spelling has been the
deprecated form since v3. Changed to `reporters: ['default']`.

Zero exposure, verified rather than assumed:

| Breaking change                               | Exposure                                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `clearMocks` now defaults to `true`           | Clears call history only; implementations survive. No mocks configured in `beforeAll`. All 53 `toHaveBeenCalledTimes` assertions still pass |
| Unawaited async assertions now fail           | 0 sites — all 61 `.resolves`/`.rejects` are `await expect(...)`                                                                             |
| `toHaveTextContent` strict                    | 0 uses                                                                                                                                      |
| `sequential` removed                          | 0 uses                                                                                                                                      |
| Node ≥22, Vite ≥6.4                           | Satisfied (Node 24.21, Vite 8.3)                                                                                                            |
| `attachmentsDir` / reporter output dirs moved | Not used                                                                                                                                    |

## Files modified

| File                                    | Change                                                               |
| --------------------------------------- | -------------------------------------------------------------------- |
| `package.json`                          | `engines` floor, 28 range refreshes, 4 major bumps, `test:ui` script |
| `package-lock.json`                     | regenerated                                                          |
| `vitest.svelte.config.js`               | `reporter: 'default'` → `reporters: ['default']`                     |
| `test/setup.svelte.js`                  | guard the `window`/`document` shim against getter-only `document`    |
| `test/lib/server/avatarManager.test.js` | hoist `vi.mock` out of `beforeEach` to top level                     |

Unchanged: `.npmrc`, `svelte.config.js`, `jsconfig.json`, `vite.config.js`, `eslint.config.js`,
`Dockerfile`, `.github/workflows/ci.yml`, `deploy.sh`. No application source changed — every edit
is manifest, test-harness or config.

## Verification

```
npm run lint       prettier + eslint clean
npm run check:ci   2281 files, 0 errors, 0 warnings
npm test           1351 passed + 1 skipped (backend), 321 passed (frontend)
npm run build      adapter-node production build ✔
npm audit          4 low (the Kit/cookie advisory above), 0 moderate, 0 high
npm ls             no invalid or unmet peers
npm outdated       typescript only (deferred by design)
```

Because the test suite mocks the runtime dependencies that moved, they were exercised directly
rather than trusted:

- **SSR** — dev server on a scratch port (Vite 8.3.0), eight routes served without an SSR error;
  `/auth` rendered 402KB of real HTML with title, form and hydration markers.
- **sharp 0.35.4** — the one runtime change with real local reach, and the one the suite cannot
  catch. Ran a magenta-keyed image through `removeCornerBackground` (→ webp with alpha) and the
  512×512 avatar webp path. libvips 8.18.6.
- **openai** and **mailgun.js** need live credentials and were verified by type shape and call-site
  reading rather than by spending an API call. They are the two to watch on first deploy.

Note the Docker libc constraint still applies: sharp's libvips binding is glibc-specific, the
prod-deps stage must stay `bookworm-slim`, and no test will catch a breakage there.

## Assumptions and limitations

- The 4 remaining low advisories are upstream-only. Do not run `npm audit fix --force` to clear
  them — it downgrades `@sveltejs/kit` across a major.
- TypeScript 7 is blocked by peer ranges, not by anything in this repo. Re-check when Kit updates.
- openai and mailgun.js paths are unverified against the live services; the type shapes match and
  the unit tests cover the call shape, but neither made a real request.
- `engines: { "node": ">=24.15" }` now makes `npm install` fail on older Node under
  `engine-strict=true`. That is intended, but anyone on an older local Node must upgrade.

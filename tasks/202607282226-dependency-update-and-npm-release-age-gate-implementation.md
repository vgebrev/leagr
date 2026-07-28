# Dependency Update + npm Release-Age Gate

**Date:** 2026-07-28
**Commits:** `3e83c99`, `5eb69e1`, `2f93da7`

## Overview

First dependency refresh in a while. `npm outdated` listed 29 stale packages and `npm audit`
reported **11 vulnerabilities (8 high)**, five of them against direct dependencies. Alongside the
upgrade we added a supply-chain guard: npm's `min-release-age`, which refuses to resolve any
version published within the last N days, so a compromised release cannot be pulled in by a
routine install.

Outcome: all 8 high-severity findings cleared, dependencies current, a 5-day quarantine window on
future installs, and a latent production bug in the Docker image found and fixed.

## Architecture decisions

### 1. Gate first, upgrade second

`min-release-age=5` was configured **before** running any dependency update, so the upgrade itself
was filtered by the policy rather than pulling the freshest possible versions. This visibly
changed the result:

| Package       | Newest published | Resolved           | Reason                                   |
| ------------- | ---------------- | ------------------ | ---------------------------------------- |
| `svelte`      | 5.56.8 (3.9d)    | **5.56.7** (8.0d)  | inside window                            |
| `openai`      | 6.49.0 (5.0d)    | **6.48.0** (11.7d) | inside window                            |
| `@types/node` | 26.1.2 (1.1d)    | **26.1.1** (20.6d) | inside window; range pinned to `^26.1.1` |

Both held-back versions still clear their advisories, so no security was traded for the delay.

### 2. Config in both user and project scope

- `~/.npmrc` — covers every project on the machine
- `.npmrc` (committed) — travels with the repo, applies to contributors and clones

`min-release-age` requires **npm ≳ 11.12**; the machine was on 11.8.0 where the key is silently
`undefined`. npm was upgraded to **11.18.0** (latest 11.x, avoiding npm-major churn).

### 3. CI and Docker deliberately untouched by the gate

Verified by reading arborist: the window is applied in `build-ideal-tree` only
(`install` / `update` / `audit fix`), never in `loadVirtual` / `reify`. `npm ci` installs the
lockfile verbatim, so `.github/workflows/ci.yml` and the Docker build are unaffected. An older npm
in CI ignores the key with a warning rather than failing.

### 4. Deferred majors, with reasons

- **typescript 6 → 7** — `svelte-check@4.7.4` declares `peerDependencies.typescript: "^5 || ^6"`.
  TS 7 would ERESOLVE on install and break `npm run check`. Revisit when svelte-check widens.
- **openai 6 → 7** — published 0.9 days before this work, so the release-age gate blocks it
  regardless; the major also needs `openaiImageClient.js` reviewed against v7 breaking changes.

## The Docker regression (the non-obvious part)

Bumping sharp 0.34.5 → 0.35.3 **broke the production image**, and no test caught it because the
suite never exercises the built container.

The `prod-deps` stage ran `npm ci --omit=dev` on `node:24-alpine` (musl), but its `node_modules`
is copied into `gcr.io/distroless/nodejs24-debian12` (glibc). That mismatch was always there. It
worked only by accident: sharp 0.34.x's `@img/*` platform packages declared **no `libc` field**,
so npm could not filter them and installed every `linux-x64` variant — including the glibc one the
runtime actually needed.

sharp 0.35.x adds `libc: ["glibc"]` / `["musl"]`. npm now filters correctly, the alpine stage
installs musl binaries only, and the runtime fails with:

```
Could not load the "sharp" module using the linux-x64 runtime
```

This would have broken avatar uploads and team-logo rendering in production.

**Fix:** `prod-deps` now builds on `node:24-bookworm-slim`, matching the Debian 12 runtime. The
builder stage stays on alpine — its `node_modules` is never copied into the final image.

Confirmed by building both the pre- and post-upgrade images and comparing `/app/node_modules/@img`
contents, which is the technique to reuse if this ever regresses.

## Files modified

| File                     | Change                                                                                                      |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `.npmrc`                 | added `min-release-age=5` alongside existing `engine-strict=true`                                           |
| `~/.npmrc` (not in repo) | added `min-release-age=5`                                                                                   |
| `package.json`           | `sharp ^0.35.3`, `@types/node ^26.1.1`, `@testing-library/jest-dom ^7.0.0`, `prettier-plugin-svelte ^4.1.1` |
| `package-lock.json`      | regenerated                                                                                                 |
| `Dockerfile`             | `prod-deps` stage `node:24-alpine` → `node:24-bookworm-slim`, with a comment explaining the libc constraint |
| `tasks/202511291516-…md` | reformatted by prettier 3.9                                                                                 |

No application source changed. `prettier-plugin-svelte` 4 produced **zero** reformatting
(`prettier --list-different` returned nothing), so it was a clean version bump.

## Testing

- Baseline suite captured **before** any change, to separate pre-existing failures from regressions.
- After: backend **887 passed / 2 skipped**, frontend **139 passed** — identical to baseline.
- `npm run lint` (prettier + eslint) clean; `npm run build` succeeds.
- sharp verified functionally rather than by version number, exercising the exact API the app
  uses (`sharp()`, `.metadata()`, `.resize()`, `.ensureAlpha()`, `.webp()`, `.toBuffer()`, raw
  input) both on the host and **inside the built container**.
- Container smoke test: boots and serves HTTP 200.

## Known limitations

- **4 low findings remain** for `cookie <0.7.0`, pinned by `@sveltejs/kit@2.70.1`'s own
  `cookie: ^0.6.0` range — not fixable downstream without an override. Not exploitable here:
  the advisory concerns out-of-bounds characters in cookie **name, path, and domain**, and
  `hooks.server.js:208` sets a constant name (`_ls`) and path (`/`) with no domain. Revisit when
  SvelteKit widens the range.
- npm 11.18.0 also introduced an `allowScripts` gate on install scripts. It flagged sharp 0.34.5,
  but sharp 0.35.x ships **no install script**, so the tree is now clean. Worth knowing about when
  adding future dependencies that do run install scripts.
- If a future security fix is ever blocked by the release-age window, the escape hatch is
  `min-release-age-exclude[]=<pkg>` in `.npmrc` rather than removing the gate. `npm audit fix`
  exits non-zero and warns when it is blocked this way — that is expected behaviour, not a failure.

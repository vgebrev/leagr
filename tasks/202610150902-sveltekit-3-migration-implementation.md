# SvelteKit 3 Migration + Dependency Housekeeping

## Overview

Two parts, done in this order so that each could be verified on its own:

1. **Housekeeping** - `npm update` within existing caret ranges. This cleared all 4 high
   advisories (`sharp` librsvg CVE, `devalue`, `brace-expansion`, `source-map-js`).
2. **SvelteKit 2.70.3 → 3.0.1**, `@sveltejs/adapter-node` 5 → 6. The unused
   `@sveltejs/adapter-auto` (a scaffold leftover) was removed. Kit 3 ships `cookie@2`, which
   clears the 4 low `cookie@0.6.0` advisories that were previously unfixable.

The only advisories left are the 2 moderate `postcss-selector-parser` ones, which come in through
`@tailwindcss/typography` and only run at build time. npm's suggested "fix" is a downgrade, so
they are ignored.

TypeScript 7 is still blocked: Kit 3's peer range is `typescript ^6.0.0`.

**Follow-up round (2026-10-23):** after the 5-day window, `npm update` took the newer versions
within existing ranges:

- Kit 3.0.1 → 3.1.0: the minors are CSP `report-sha*` keywords and a `+server` tracing span; the
  rest are patch fixes. No breaking entries.
- vitest and @vitest/ui 5.0.5, svelte-check 4.7.7, eslint 10.13, jsdom 30.1.3, openai 7.38,
  prettier 3.9.10, @testing-library/user-event 14.6.8.

The full gate and the built-server smoke test were re-run and both pass. vite 8.3.5 and newer
openai releases were still inside the window.

## The codemod was not used

`npx sv migrate sveltekit-3` (sv 1.1.1) reprints every file it touches. In this repo it:

- rewrote snippet JSDoc parameters into `/** @type {T} */ (param)`. That is a parenthesised
  pattern, which is a syntax error, and it then crashed on that file in a later task;
- broke indentation inside `try` blocks, and expanded or collapsed markup throughout;
- generated `src/env.js` with `schema: (input) => input ?? ''`. That turns an unset
  `OPENAI_MODEL` into `''`, which bypasses `generateTeamLogo`'s `model = 'gpt-image-2'` default.

Its source edits were therefore reverted and every change was made by hand. Its intended changes
served as the checklist. If you re-run it, use `--tasks <name>` and review each diff.

## Architecture decisions

- **`handleError` only logs `kind === 'unknown'`.** Kit 3 sends _every_ error through the hook,
  including our own `error()` calls (`kind: 'app'`) and 404s and bad requests
  (`kind: 'framework'`). Without this filter, every bot scan and wrong access code would be logged
  at error level as "Unhandled". A 5xx declared with `error(500, ...)` is still logged with its
  body by `handle`'s `failureDetail` path, so it is not lost. When there is no route fallback
  message, the hook _omits_ `message` rather than returning `undefined`, so SvelteKit's default
  still applies.
- **`$lib` → `#lib` and `$components` → `#components`** as Node subpath imports
  (`package.json` `imports`). Kit 3 removed `$lib`, and `config.alias` is now deprecated, so both
  were moved. Vite and Vitest resolve them natively, so the Vitest `resolve.alias` entries are
  gone.
- **`resolve()` pathnames have no leading `/`** (`resolve('rankings?…')`). Route IDs keep it
  (`resolve('/')`, `resolve('/year-recap/[year]', …)`). During SSR Kit renders these as
  page-relative links (`./?date=` on `/rankings`, `../?date=` on `/rankings/Tinashe`); both were
  checked against the built server.
- **`OPENAI_API_KEY` and `OPENAI_MODEL` are declared in `src/env.js`** and read through
  `$app/env/private`. Both are optional: an unset or empty value becomes `undefined`. All other
  config is still read from `process.env`.
- **eslint no longer passes a `svelteConfig`.** `svelte.config.js` is gone (its config moved into
  `sveltekit({...})` in `vite.config.js`), and we have no preprocessors or compiler options for
  eslint-plugin-svelte to pick up.
- **Deprecated but left alone:** `pushState` (4 sites, could become
  `goto('', { shallow: true, state })`), `error(status, { message })` (10 sites in
  `api/leagues/*`), and `json()`. All still work and none produce a check warning.

## Files modified

- `package.json` / `package-lock.json` - upgrades, `imports` field, adapter-auto removed
- `svelte.config.js` - deleted; adapter and `csrf.trustedOrigins` moved into `vite.config.js`
- `jsconfig.json` - extends `$app/tsconfig`; Kit 2 `.svelte-kit/*.d.ts` includes dropped (Kit 3
  generates types into `node_modules/$app/types`)
- `eslint.config.js`, `vitest.config.js`, `vitest.svelte.config.js` - alias and config cleanup
- `src/hooks.server.js` - Kit 3 `handleError` contract (`@sveltejs/kit/hooks` type)
- `src/env.js` - new; env var declarations
- `src/lib/server/teamLogoManager.js` - `$env/dynamic/private` → `$app/env/private`
- `src/routes/+layout.js` - `$app/environment` → `$app/env`
- 8 `goto(..., { replaceState: true })` → `{ replace: true }`
- 38 `resolve()` calls - leading `/` dropped from pathnames
- ~175 `src` and `test` files - `$lib` / `$components` → `#lib` / `#components`
- `test/hooks.server.test.js` - Kit 3 input shape, plus app/framework errors not logged
- 6 frontend tests - the `$app/paths` `resolve` mock now prefixes `/` like Kit 3 does
- `CLAUDE.md`, `README.md` - `#lib`, SvelteKit 3, env var declarations

## Testing

- `npm run check:ci`: 0 errors, 0 warnings (2320 files)
- `npm test`: backend 1374 passed / 1 skipped, frontend 323 passed
- `npm run build` and a Docker image build
- Built server smoke test (`node --env-file=.env.local build`, port 3100):
    - session cookie `Path=/`;
    - 404 / 401 / 400 return correct bodies (which now include `status`) and write nothing at
      error level;
    - authenticated API returns 200, and a request without a session returns 401;
    - the `X-Forwarded-Host`-only flow works end to end;
    - immutable assets get a content-hash ETag;
    - preflight returns 204 with an empty body;
    - headless Chrome hydration on `/rankings`, `/teams`, `/help/badges` and `/news` shows no
      console errors, and the client-side `?code=` auth flow runs.

## Assumptions / limitations

- `npm run build` prints `Failed to create logs directory: EACCES ... '/app/logs'`. This is
  **existing behaviour, also present on Kit 2**: Kit's analyse step imports server modules with
  `NODE_ENV=production`, and the logger picks `/app/logs`. It is harmless and unrelated to this
  upgrade.
- Behaviour changes in Kit 3 that no test covers:
    - clicking a link to the current page now re-runs all load functions;
    - `updated` polls hourly;
    - `goto` rejects URLs that don't resolve to a route;
    - cross-page enhanced forms navigate on success (we have no form actions).

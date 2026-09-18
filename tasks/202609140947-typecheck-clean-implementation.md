# Clean `npm run check`, gated in CI and deploy

## Overview

`npm run check` went from **1509 errors and 29 warnings across 138 files** to
**0 errors and 0 warnings across 2223 files**, and is now enforced by
`npm run check:ci` in both GitHub Actions and `deploy.sh`.

The work was done in 20 commits, each one verified with the full test suite
(1667 tests) and lint before landing.

## Architecture decisions

**Ambient domain types.** `src/lib/shared/types.js` became
`src/lib/shared/domain.d.ts`: one `declare global` block holding every shared
shape. They resolve in any `.js` or `.svelte` file with no import, which removed
47 `@typedef {import(...)}` preamble lines and stopped the same shape being
redeclared in three places. `jsconfig.json` picks it up via `src/**/*.ts`.

**`{Object}` is worse than no annotation.** `data.get()` returns `Promise<*|null>`
(= `any`) and produced _zero_ errors. It was the 266 hand-written `{Object}` /
`Promise<Object>` / `Map<string, Object>` annotations that re-narrowed `any` into
TypeScript's `Object` interface, which has no properties — 439 errors on their own.
This is now a documented rule in CLAUDE.md and AGENTS.md.

**Pipelines are modelled, not flattened.** Rankings and fantasy pricing both build
records across several passes. Rather than loosening the persisted types for every
consumer, the intermediate stages are named: `RankablePlayer` →
`EnrichingPlayerRankingData` → `PlayerRankingData`, and `FantasyDraftEntry` →
`ExpectedPointsEntry` → `PriceEntry`.

**Guard helpers return discriminated unions.** `{isValid, value: T|null}` does not
narrow, so every downstream call re-failed. Changing `validateLeagueForAPI` and
`validateDateParameter` to unions cleared 51 errors across 24 API routes without
touching a call site.

**A temporary ratchet, not a big-bang branch.** `check-ratchet.mjs` recorded
per-file counts in `.check-baseline` and failed CI if any file got worse — so the
gate was live from the first commit and each batch stayed reviewable. At zero both
were deleted and `check:ci` became `svelte-check --fail-on-warnings`.

## Files modified

- `jsconfig.json` — its own `include` was overriding the one it extends, so
  `.svelte-kit/ambient.d.ts`, `env.d.ts` and every generated `$types.d.ts` were
  never loaded. Adding them back cleared 24 errors and surfaced the real
  `resolve()` and `PageData` typing underneath.
- `src/lib/shared/domain.d.ts` — new; ~90 shared types.
- `src/lib/shared/{validation,helpers,matchUtils,badges,favicon,defaults}.js`
- `src/lib/server/**` — every module; `playerManager.js` was the template.
- `src/lib/client/**` — services, stores.
- `src/routes/**` — pages, components, API routes.
- `package.json`, `.github/workflows/ci.yml`, `deploy.sh` — the gate.
- `CLAUDE.md`, `AGENTS.md` — the typing rules the gate enforces.

## Testing approach

Every commit ran `npm run check`, `npm run lint` and `npm test`. The final state
also passes `npm run build`.

`rankings.js` was the highest-risk file, so it was verified by recalculating
pirates 2026 with the code before and after the commit: the two outputs are
**byte-identical apart from the `lastCalculated` timestamp**.

The gate itself was verified to bite — a deliberate type error and a deliberate
reactivity warning each fail `npm run check:ci`.

## Bugs found and fixed

1. **`Match.homeScorers` was typed `string[]`** but every producer and every stored
   session writes `Record<string, number> | null`. The six `home/away*Actions`
   fields and the knockout penalties were missing from the typedef entirely.
2. **`+layout.svelte` assigned `$settings = data.settings` once at init.**
   `+layout.server.js` recomputes settings per `?date=`, so changing the session
   date left the store holding the previous day's settings.
3. **`DrawReplay` reassigned a non-`$state` `SvelteSet`.** Mutations tracked, but
   the two reassignments swapped in a set the template never read — stale reveal
   classes on replay reset.
4. **`settings/+page.svelte` returned its cleanup from an `async` `onMount`.**
   Svelte ignores that, so the body-scroll lock was never lifted on leaving
   Settings.
5. **`LeagueInfo` computed `displayInfo` once**, so a late-arriving `leagueInfo`
   left the nav on "Leagr".
6. **Ten Flowbite `Input`s used `classes={{ wrapper }}`**, a key from an older
   API — the current outer div reads `styling.div`, so those `w-full` / `flex-1`
   classes had silently stopped applying.
7. **`+layout.js` returned `data.apiKey`**, which its server load has never
   produced — a leftover from the API-key auth the session cookie replaced.
8. **`teamGenerator` indexed rankings with a possibly-null team slot** in five
   places, silently scoring an empty slot as an average player.
9. **`GoalscorerList` searched rosters for `p.name`**, but a roster holds names —
   its avatar lookup could never match. (The component is also unreferenced.)

## Assumptions and limitations

- `test/**` stays outside the type-check scope, as before. Including it adds
  ~2312 errors; Vitest executes those files instead.
- Two `goto()` calls carry an explained `eslint-disable` for
  `svelte/no-navigation-without-resolve`: they navigate to a path taken from
  `page.url` or a `?redirect=` param, which already carries any base path, so
  there is no route literal to give `resolve()` and re-resolving would double the
  prefix.
- `ConsolidatedSettings` uses a loose index signature for its date keys. A type
  cannot carry both `LeagueSettings`' named keys and a `DaySettings` index; the
  named keys keep their real types through dot access.
- `GoalscorerList.svelte` is not imported anywhere. It is typed rather than
  deleted — whether to keep it is a call for the maintainer.

# News Feed: absence-aware streak lines + server-side pagination

## Overview

Two changes to the `/news` feed:

1. **Carried-over streak lines now appear only for the first session a player misses.** A
   player with a live streak who sits out previously produced a `carriedOver` thread ("X sat
   out — the 5-session trophy run stays alive") on _every_ subsequent recap card. With a
   long-term absence that line became a permanent squatter on a card with only 12 slots.
2. **The API now returns one page of cards instead of the whole season.** Stories are still
   derived from the full history — only the returned slice is narrowed. "Load more" is now a
   real fetch rather than a front-end filter over an already-downloaded year.

Measured on `data/pirates/rankings-2026.json` at `asOf=2026-08-13`:

|                                         | before             | after               |
| --------------------------------------- | ------------------ | ------------------- |
| carried-over threads across the season  | 51                 | 25 (all first-miss) |
| recap cards at the 12-thread cap        | 20 of 30           | 13 of 30            |
| first response payload                  | 40.9 kB (31 cards) | 7.1 kB (5 cards)    |
| `getStandingsForDate` calls per request | 30                 | 5                   |

## Architecture decisions

### Attendance is read off `team`/`performance`, not off the history key

The obvious predicate — "the player has no history entry for that date" — is a **no-op in
production**. `rankings.js` writes a _non-appearance_ entry for every ranked player every
session (a rank/decay snapshot holding only `ratings` and `ranking`). On `2026-08-01`, 69
players have a `history[date]` key and only 23 actually played. The key-presence rule
suppressed 0 of 51 threads when measured against real data.

It looks correct only because the test fixtures express "sat out" by omitting the key (the
`history()` helper filters `null` entries), which production never does. So attendance is:

```js
entry != null && (entry.team != null || entry.performance != null);
```

matching the idiom already used for the team result lines. `newsFeed.test.js` now has a
`snapshotEntry()` fixture that reproduces the production shape, so the regression is covered.

### Suppression is a filter, not a new argument to the resolver

`resolveStreakThread` stays a pure `(inputs) → thread`. The absence rule is applied where the
roster gate already lives, **before** the `slice(0, maxThreads)` selection — so a suppressed
line frees its slot for a real story rather than leaving a hole. One filter covers all three
streak families (trophy, spoon, baller category).

The rule is local and backward-looking (`!attended(D) && !attended(prev(D))`), so a recap card
can never change when a later session is played — the frozen-board invariant still holds.

### `recapDates` in, not `{before, limit}`

`buildNewsFeed` takes the exact list of recap dates to build. The route has to resolve the
page's dates before calling it anyway (to scope the standings load), so passing them in falls
out for free, keeps the `Card[]` return type, and left all 61 pre-existing tests untouched.

Everything else per card still derives from the **full** `players` map — `deriveTeamCounts`,
`deriveBallerTops`, `playerSessions`, `boundHistories`, and the new `previousPlayed` map. A
card is therefore identical whichever page it lands on; a golden test and a live page-walk
both assert byte-equality against the unpaginated feed.

### A date cursor, not an offset

The only mutation between two page requests is a new session landing at the head. An offset
would then re-serve a card the client already has, and with `{#each cards as card (card.date)}`
a duplicate key is a hard Svelte runtime error. `before` is immune to head insertions.

The client never computes the cursor — it echoes the server's `nextCursor`. `cards.at(-1).date`
would be the _future_ preview date on a recap-less page and would re-serve the newest cards.
The resolved `asOf` is likewise returned and echoed, so a page turn across midnight (or across
1 January, where the year file changes) stays on one consistent window.

### Deliberately out of scope

The baller path also yields `carriedOver` when a player _did_ play but the stat category was
untracked that week; that copy reads "sat out" and is misleading. Left alone — it measures 0
occurrences in real data, the existing test at `newsFeed.test.js` pins the behaviour, and
changing it would alter `spoonStreak` semantics for league-less sessions.

## Files modified

- **`src/lib/server/newsFeed.js`** — added `attended()` (with the non-appearance-entry
  rationale in a comment), a `previousPlayed` map built from the full played-date set, an
  `inAbsenceRun()` predicate per card, and a combined roster/absence thread filter. Exported
  `playedSessionDates()` and `pageRecapDates()`; added `recapDates` and `includePreview`
  options to `buildNewsFeed` (both optional — omitting them reproduces the previous behaviour
  exactly). Unknown dates are dropped and newest-first order is imposed inside, so a caller
  can't emit a junk or mis-ordered card.
- **`src/routes/api/news/+server.js`** — new `limit` (default 5, clamped to 1–50, garbage
  clamps rather than erroring the way `asOf` does) and `before` (400 on a malformed date)
  params. The preview card's work — the directory scan in `earliestRegisteredSession` plus the
  registration lookup — now runs on page 1 only. `loadSessionStandings` takes the page's dates
  instead of every played date. Response is `{ cards, hasMore, nextCursor, asOf }`, with all
  four keys present even on the momentum-disabled path so the client never branches on shape.
- **`src/routes/news/+page.svelte`** — cards accumulate instead of being sliced;
  `hasMore`/`nextCursor`/`asOf`/`loadingMore` state; `loadMore()` with a re-entrancy guard, a
  disabled button with an inline spinner, and dedupe-by-date on append. `loadMore` deliberately
  does **not** use `withLoading` (its global `$isLoading` branch replaces the whole list, which
  would unmount every rendered card mid-scroll) and does not set the page-level `error` flag
  (which swaps the feed for an alert) — it toasts and leaves the button for a retry.
  `$effect(() => loadNews())` became `onMount(loadNews)`: `loadNews` reads the api-client's
  auth `$state` synchronously, so as an effect it re-ran when the admin code landed after
  mount — harmless with a full payload, but it would have reset an admin's feed to page 1.
- **`test/lib/server/newsFeed.test.js`** — hoisted the `stats` helper to module scope for
  reuse; added `carried-over streaks during a long absence`, `playedSessionDates`,
  `pageRecapDates` and `paged feeds` suites. 61 → 82 cases.

## Testing

`npm test` — backend 924 passed / 2 skipped across 34 files. All 61 pre-existing `newsFeed`
cases pass unedited; that was the acceptance gate for the refactor.

21 new cases, in the module's existing pure-fixture style (no mocks, no fs):

- Carried-over reported on the first missed session and not the second, for trophy, spoon and
  baller-category runs; and with a production-shaped `snapshotEntry()` rather than an omitted
  key — the test that catches the no-op predicate.
- Reporting resumes when the player returns.
- A recap card stays frozen when the absence continues into later sessions.
- An absentee is still suppressed when the previous session falls outside the requested page,
  proving `previousPlayed` comes from the full set.
- `pageRecapDates` cursor arithmetic: first page, continuation, exact-remainder end, cursor
  older than everything, cursor that isn't itself a session date, over-large limit.
- Page-equivalence: the unpaginated feed deep-equals the concatenation of its pages.

Live verification against the real pirates data (dev server + CDP-driven headless Chrome):

- Page 1 is one `/api/news?limit=5` request at 7.1 kB; walking all 6 pages returns 30 cards
  with zero duplicates, byte-identical to the unpaginated feed.
- Double-clicking "Load more" fires exactly one request (`before=<cursor>&asOf=<pinned>`);
  cards go 5 → 10 with the scroll container's `scrollTop` unchanged at 2135, i.e. nothing
  unmounts. Console clean — no duplicate-key errors.
- The button disappears at the oldest session of the year.
- Edge cases: `before=nope` → 400; `before=2020-01-01` → empty page, `hasMore:false`;
  `limit=999` clamps to 50; `limit=abc` falls back to 5.

`npm run lint` clean.

## Assumptions and limitations

- The absence rule keys on the immediately preceding **league** session, not on the player's
  own last appearance in that competition. Equivalent in practice, and much cheaper.
- Page 1 now returns the preview card plus 5 recaps (6 cards) rather than 5 cards total —
  `limit` counts recaps. Not worth a special case.
- The preview card is unchanged. It's roster-gated, so a long-term absentee who isn't
  registered can't appear on it; one who _is_ registered legitimately still carries their run.
- No caching was added. Each page turn re-reads the year's rankings and recomputes the boards
  for that page's cards (~18 ms for 5 cards vs ~86 ms for 31). The accepted trade is "derive
  from everything, return a slice".
- `NavMenu.svelte.test.js` fails 5 cases under the full `npm test` run (passes in isolation).
  Verified pre-existing — it reproduces identically on a stashed clean tree and is unrelated
  to this work.

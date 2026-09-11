# Weekly Fantasy — a live market, open from registration

Supersedes the lifecycle half of
`202608311520-fantasy-team-api-and-screens-implementation.md`. Pricing is untouched:
`fantasyPricing.js` has not changed.

## The problem with v1's shape

v1 opened the market at `isTeamDrawOpen` and froze the price board on the first squad
submission, on the reasoning that "the pool is settled and prices would otherwise be a moving
target". Neither half held up:

- `isTeamDrawOpen` never looks at whether teams exist. It is a clock check against
  `registrationWindow.teamDrawDayOffset/teamDrawTime` — Friday 16:00 by default.
- The pool does not settle then, or at any point before the session ends.
  `validateCompetitionOperationsAllowed` is the **only** guard on `/api/players`,
  `/api/teams/players` and `/api/teams/auto-assign`, so players register, withdraw and get
  reassigned right up to `registrationWindow.endTime` — Saturday 12:00, after kick-off. A
  withdrawal leaves a `null` hole in a drawn team, with no auto-backfill.

So the market locked on a moment that settles nothing, and anyone who signed up on Friday
evening or Saturday morning was shut out of that week's game entirely.

## The new shape

```
registration opens ─────────── first match scored ──────── rankings updated
      │                               │                           │
  market opens                    squads lock                  settled
  (pending → open)                (open → closed)            (points appear)
      └────────── prices move with the pool the whole way ─────────┘
```

| State     | Condition                                                      |
| --------- | -------------------------------------------------------------- |
| `pending` | before `isRegistrationOpen(date, settings)`                    |
| `open`    | registration open, competition not ended, first match unscored |
| `closed`  | first match has a score, or `isCompetitionEnded`               |

Only the `pending` gate moved. Close conditions and the admin-unlock bypass are unchanged.

## Architecture decisions

**The board is live while the window is open, and freezes when it closes.** `GET` rebuilds it
from the current pool on every read and persists nothing, so a late signup is priced
immediately. The freeze moved from "the first entry" to "the window closed", which is the
first moment the pool genuinely stops mattering. `#resolveBoard` is unchanged — a frozen board
always wins, which is also the right answer for an admin-unlocked session: it reopens editing
but must not reprice a market the session has already been judged on.

**The whistle pins the market, not the next page load.** `ensureBoardFrozen()` is public,
identity-free and idempotent. `getState()` calls it inside its own mutex, and the score-update
branch of `POST /api/games` calls it fire-and-forget when `hasSessionStarted(result)` turns
true (renamed from `hasFirstMatchStarted` and widened to any recorded score by
`202609111030-fantasy-info-and-hidden-squads-implementation.md`). Without that hook a lazy freeze could price from a pool that grew _during_ the match,
since registration stays legal until noon. Freezing must never fail a score save, so it is a
detached promise with a `.catch`, the same idiom as team-logo generation in
`api/teams/+server.js`.

**A read still never writes for a session nobody entered.** The freeze is guarded on
`entries.length > 0`, so browsing a past session leaves no file behind — the property v1 had,
kept.

**Validity is derived, never stored.** `#evaluateEntry(entry, board, available)` re-prices a
squad against whichever board applies and returns `{cost, valid, invalidReason,
withdrawnPlayers}`. Because it is a pure function of (board, picks, signups), a rankings
rebuild or a corrected board flows through on the next read — the same self-correcting
property settlement already had. An invalid squad scores `null` rather than a number, sorts
below every valid one, and gets no `rank` at all.

**A withdrawn pick does not invalidate a squad.** They score nothing, which is punishment
enough; a manager should not lose their week to someone else's no-show. `withdrawnPlayers` is
measured against the signup list rather than the board, so it reads identically before and
after the freeze — a live board simply drops them, a frozen board keeps their price. How that
is drawn moved later: see `202609111040-fantasy-withdrawn-on-the-tile-implementation.md`.

**The leaderboard's cost column is the live cost.** `entry.cost` is still stored as the
save-time cost for the record, but the payload always carries the re-evaluated one: the number
a squad is judged on has to be the one that applies now.

**`marketReady`.** Opening with registration means the first managers arrive to a pool too
thin to buy from — the budget is a fraction of what the most expensive `squadSize` players
cost, so a pool of exactly `squadSize` can never afford its only possible squad. The payload
carries `marketReady` + `marketNotice`, and `saveEntry` rejects with that message rather than a
misleading "over budget".

## How much does drift actually bite?

Measured on 14 real pirates sessions, replaying the true registration order from
`players.available`, having a manager pick the budget-optimal squad (`bestSquad`) part-way
through signups, then repricing at the final pool:

| Manager picks when…            | squads that go over budget | worst overshoot |
| ------------------------------ | -------------------------- | --------------- |
| 50% of the pool has registered | 0 / 14                     | —               |
| 75%                            | 0 / 14                     | —               |
| 90%                            | 3 / 14                     | 1.5             |

Withdrawals are benign: the top-priced player leaving _raises_ the budget (41.5 vs 40.5,
because prices compress upward); the cheapest player leaving moves nothing.

The direction that hurts is cheap players registering late — that drops the pool floor, which
inflates mid-tier prices, while the budget (anchored on the top `squadSize`, pinned near the
ceiling) barely moves. In an artificial worst case — the four cheapest all arriving after you
pick — 13 of 14 maxed-out squads flip. Real signup order is not adversarial like that, but it
is why `/fantasy/team` now says outright that prices move and headroom is wise.

On the thin-pool end: a pool of 5 has no legal squad (cheapest 39.5 against a 32.5 budget); a
pool of 6 already does (31.5 against 32.5). So `marketReady` is false only for the first
couple of signups.

## Payload

Added to `/api/fantasy`, nothing removed:

```js
{ …, marketReady, marketNotice,
  entries: [{ …, cost /* live */, valid, invalidReason, withdrawnPlayers, rank: number|null }] }
```

`locked` keeps its name but now means "the market is final" rather than "someone has entered".

## Files

| File                                                | Role                                                                                                                                                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/shared/helpers.js`                         | **New** `isRegistrationOpen(dateString, settings)`, mirroring `isTeamDrawOpen`                                                                                                                 |
| `src/lib/client/services/players.svelte.js`         | Its `isRegistrationOpen` derivation now delegates to that helper, so the market and the players page cannot disagree                                                                           |
| `src/lib/server/fantasyManager.js`                  | Registration gate; `#freezeIfClosedUnsafe`, `ensureBoardFrozen`, `#evaluateEntry`, `#marketReadiness`; `saveEntry` prices against the live board; `getState` freezes then settles in one write |
| `src/routes/api/games/+server.js`                   | Freezes the fantasy market when the first score lands                                                                                                                                          |
| `src/routes/fantasy/team/+page.svelte`              | Over-budget and thin-market banners, `canSave` gated on `marketReady`, the headroom hint                                                                                                       |
| `src/routes/fantasy/components/SquadSummary.svelte` | `withdrawn` badge on a slot                                                                                                                                                                    |
| `src/routes/fantasy/+page.svelte`                   | Registration wording, invalid rows flagged and rank-less, `withdrawnPlayers` passed to the modal                                                                                               |
| `src/components/FantasyTeamModal.svelte`            | Optional `withdrawnPlayers` prop → a line naming picks that score nothing                                                                                                                      |

The two UI rows above describe the screen as it was; the pick screen was reshaped straight
afterwards — see `202609110920-fantasy-pick-screen-rework-implementation.md`.

## Testing

`npm test` — 1326 backend, 260 frontend, all passing.

A pre-existing time-bomb had to be defused first: `test/lib/server/fantasyManager.test.js`
pinned the clock only inside its `window state` describe, so every other suite ran at the real
`now` against a hard-coded `SESSION_DATE = '2026-09-05'`. Once that date fell into the past,
`isCompetitionEnded` closed the window and 21 of 36 tests failed — on a calendar change rather
than a code change. The clock is now pinned in the top-level `beforeEach`.

New coverage: the market staying live after a save; a withdrawal dropping out of the live
market and surfacing as `withdrawnPlayers`; the freeze happening at close, only once, and on
demand via `ensureBoardFrozen`; no file left behind for a closed session nobody entered; two
simultaneous reads producing one board; `marketReady` on a thin pool and the matching
`saveEntry` rejection; and, on a hand-written frozen board with exact numbers, an over-budget
squad reporting `valid: false`, staying unscored, and ranking below a legal one.
`test/lib/shared/helpers.test.js` gains an `isRegistrationOpen` suite, including the case that
motivates the change — registration open while the team draw is not.

## Limitations

- **Still no settings UI**, and settlement still waits on a manual rankings update.
- **The invalid-squad notice is in-app only.** A manager who never opens the page between the
  price move and kick-off finds out afterwards.
- **The board is frozen from the pool at close.** With the games hook that is the pool at the
  first score; for a session that closes on the clock instead, it is the pool at the first read
  after noon.

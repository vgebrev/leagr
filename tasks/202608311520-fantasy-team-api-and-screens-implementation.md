# Weekly Fantasy — entry API and screens

Builds the game on top of `202608311145-fantasy-pricing-engine-implementation.md`, which
shipped the valuation model as **engine only** — "No API, no page, no settings UI, no game."

Managers now pick a 5-player squad from the session's signups inside a budget, and a
leaderboard ranks the entries by what their picks actually scored. Pricing itself is
unchanged: `fantasyPricing.js` was not touched.

## The shape of a fantasy week

> **Superseded** by `202609101740-fantasy-live-market-implementation.md`. The market now opens
> with **registration**, the board stays live while the pool moves, and it freezes when the
> window closes rather than on the first entry. This section records the original reasoning
> and why it did not hold.

```
team draw opens ──────────── first match scored ──────── rankings updated
      │                              │                          │
   market opens                  squads lock                 settled
   (pending → open)              (open → closed)         (points appear)
```

`windowState` is the single value the whole feature turns on, and the UI reads it directly:

| State     | Condition                                              | Screen                          |
| --------- | ------------------------------------------------------ | ------------------------------- |
| `pending` | before `isTeamDrawOpen(date, settings)`                | prices visible, saving disabled |
| `open`    | draw open, competition not ended, first match unscored | full edit                       |
| `closed`  | first match has a score, or `isCompetitionEnded`       | read-only                       |

The close condition was specified. The **open** condition had to be chosen, and
`isTeamDrawOpen` is the app's own "signups are done, make the teams" moment — the same lock
the pricing doc's open question #2 asked for. Admin session-unlock passes through
`adminUnlockDate`, matching every other write-locked endpoint.

## Architecture decisions

**The market freezes on the first squad submission.** `buildWeeklyPrices` is a pure function
of (rankings, pool, date), and leak-free — it only reads sessions strictly before `date`. But
the pool is `players.available`, which keeps moving until registration closes, and prices are
pool-relative (top anchor = pool max, bottom = 10th percentile). A board recomputed per
request would silently invalidate a squad that was legal when it was saved. Freezing on the
first entry gives every manager one identical market and makes the leaderboard's cost column
comparable.

Consequences, both deliberate: a player who signs up after the freeze is not in that week's
market, and a pick who withdraws stays on the board and simply scores nothing. The second is
not a policy at all — `sessionActuals` has no history entry for someone who did not play, so
they contribute 0. The market flags them `withdrawn` rather than forcing a swap.

**A read never writes the board.** `GET` computes a live preview when no board is frozen, so
browsing a session — including a past one — leaves no file behind. Only `POST` freezes.

**Its own directory, not a key on the session file.** `data.js` pins every filename to
`<date>.json` in the league root (`data.js:49`), so `data/{league}/fantasy/{date}.json` is
unreachable through it. `fantasyManager.js` therefore owns its own `fs` + per-path `Mutex`,
which is the established pattern for subdirectory data (`avatarManager.js`,
`teamLogoManager.js`).

**Settlement is recomputed, then cached.** `sessionActuals` needs
`rankings.players[name].history[date]`, which only exists after `updateRankings()` — a
**manual** action in this app (`/api/rankings` POST, the Update button on `/rankings`). So a
finished session reads `settled: false` with an explanatory line until someone runs it. Once
rankings know the date, every `GET` recomputes and persists when the value changed, so a
corrected score flows through instead of being frozen at first settlement.

**One entry per owner per date.** `PlayerAccessControl.deriveOwnerId()` already hashes
`leagueId|date|clientId`, so the hash is per-session and needs no extra key. `POST` upserts.

**Owner names are stored _and_ re-resolved.** `ownerName` is the first name in `playerOwners`
claimed by the same hash — the manager's own registered player. It is resolved and stored at
save time so an entry stays self-describing, and re-resolved on read so a rename follows
through, falling back to the stored value once the owner deregisters. `Anonymous` only when
the client owns no registered player.

**Owner hashes never leave the server.** `#present()` strips `owner` and hands the client
`isMine` plus `ownerName`. Asserted by a test.

## Data

`data/{leagueId}/fantasy/YYYY-MM-DD.json`:

```jsonc
{
    "date": "2026-09-05",
    "board": {
        // absent until the first entry is saved
        "lockedAt": "2026-09-04T14:00:12.345Z",
        "asOf": "2026-08-29", // last in-regime session the prices were built from
        "regime": ["goals", "offActions", "defActions", "saveActions"],
        "budget": 40.5,
        "squadSize": 5,
        "prices": { "Dan": 12, "Uriel": 4 },
        "meta": {
            "Dan": { "expectedPoints": 58.6, "provisional": false, "elo": 1663, "sessions": 21 }
        }
    },
    "entries": [
        {
            "owner": "Eb0t59Fo9olII1d-RUmGRr", // client hash, never serialised to a client
            "ownerName": "Veli",
            "teamName": "Smoke Test XI",
            "players": ["Dan", "Uriel", "Simon", "Irry", "Dave"],
            "cost": 28,
            "points": null, // null until settled
            "createdAt": "…",
            "updatedAt": "…"
        }
    ],
    "results": { "settledAt": "…", "playerPoints": { "Dan": { "total": 62.5, "breakdown": {} } } }
}
```

`board.meta` exists so the market still renders years later, when the rankings the prices came
from may have been rebuilt.

## API

`/api/fantasy?date=YYYY-MM-DD`, auth handled entirely by `hooks.server.js`. `GET`, `POST`
(`{teamName, players}`) and `DELETE` all return the same payload, so the client replaces state
wholesale rather than patching it:

```js
{ date, squadSize, budget, asOf, locked, windowState, windowReason, settled, settleHint,
  market:  [{ playerName, price, expectedPoints, provisional, elo, avatar, withdrawn, points }],
  entries: [{ rank, teamName, ownerName, players, cost, points, isMine, updatedAt }],
  myEntry: { … } | null }
```

**A locked save answers 400, not 403.** This was caught in live verification, not review: the
first cut used 403, and the client's `handleAuthError` treats 403 as a bad league access code —
it cleared the stored code and bounced to `/auth`. A manager who hit Save as the whistle went
would have been logged out. 400 also matches how `games/+server.js` answers the same class of
failure. There is a regression test pinning the status code with that reasoning in a comment.

## Files

| File                                                               | Role                                                                                                                                                                                                               |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/server/fantasyManager.js`                                 | **New.** Store, lock rules, validation, settlement, presentation. `FantasyError` carries status codes.                                                                                                             |
| `src/routes/api/fantasy/+server.js`                                | **New.** GET / POST / DELETE.                                                                                                                                                                                      |
| `src/lib/shared/helpers.js`                                        | `hasFirstMatchStarted(games)` — first non-`bye` match in round 1 with both scores. Now `hasSessionStarted(games)`, true for any scored match: see `202609111030-fantasy-info-and-hidden-squads-implementation.md`. |
| `src/lib/shared/validation.js`                                     | `validateFantasyTeamName()` — reuses `PLAYER_NAME_CONFIG`'s blocklist, 40 chars.                                                                                                                                   |
| `src/lib/shared/defaults.js` / `types.js`                          | `'fantasy'` in `LEAGUE_ONLY_SETTINGS`; `FantasySettings` typedef. No `defaultSettings.fantasy` — the top-level merge is shallow, and `resolveFantasyConfig` already deep-merges every nested default.              |
| `src/components/TeamFormation.svelte`                              | Optional `statDefs` prop (default = the contributions panel); `Icon` optional; caller keys pass through `playerStats`. Backwards compatible.                                                                       |
| `src/components/FantasyTeamModal.svelte`                           | **New.** Props-driven pitch view of a squad — no self-loading, since one `/api/fantasy` payload already holds everything.                                                                                          |
| `src/routes/fantasy/+page.svelte`                                  | **New.** Leaderboard; row opens the modal via `pushState`.                                                                                                                                                         |
| `src/routes/fantasy/team/+page.svelte`                             | **New.** Manage screen.                                                                                                                                                                                            |
| `src/routes/fantasy/components/{SquadSummary,PlayerMarket}.svelte` | **New.** Budget meter + slots; priced pool picker.                                                                                                                                                                 |
| `src/routes/components/NavMenu.svelte`                             | Fantasy item (the bottom bar is already 6 on a `grid-cols-6`).                                                                                                                                                     |
| `src/routes/+layout.svelte`                                        | `/fantasy` and `/fantasy/team` added to `datePages`.                                                                                                                                                               |

Icons are all fresh glyphs — `WalletOutline` (nav), `TagOutline` (price), `ChartMixedOutline`
(fantasy points). In particular `StarSolid` stays "contribution total" and did not become
"fantasy points".

## Testing

`npm test` — 1262 backend, 257 frontend, all passing.

- `test/lib/server/fantasyManager.test.js` (36) — board freezes and never moves once a late
  signup joins; squad size / duplicates / unpriced name / over-budget / unsafe name rejections;
  upsert keeps `createdAt`; separate owners stay separate; owner-name resolution, fallback and
  `Anonymous`; no owner hash in the payload; all three window states plus admin unlock; the
  400-not-403 lock status; withdrawn pick scores 0; settlement math, leaderboard ordering and
  re-settlement after a correction.
- `test/routes/fantasy/{PlayerMarket,SquadSummary}.svelte.test.js` (13) — affordability gating,
  taking a pick back from a full squad, read-only, provisional/withdrawn markers, over-budget
  wording.
- `test/components/TeamFormation.svelte.test.js` — 3 added for custom `statDefs`, including a
  def with no icon and leader highlighting on a custom key.

### Live verification

Driven end to end through the real app (headless Chrome over CDP) against a scratch league
seeded from pirates' rankings and a future-dated session, then restored:

- the board matched `node scripts/fantasy-weekly-report.mjs pirates 2026-08-29` exactly —
  `asOf 2026-08-22`, 24 signed up, budget 40, Dan 12.0 / Veli 10.5 — so the endpoint did not
  change the model;
- pick → preview → save → leaderboard → modal, with the file on disk matching the schema above;
- `ownerName` resolved live to the client's registered player after `playerOwners` changed,
  though the stored value was `null`;
- scoring the first match closed the window: alert shown, inputs disabled, `POST` refused 400
  with the client still on `/fantasy/team`;
- a second client id saw `myEntry: null`, `isMine: false`, and no owner hash anywhere.

Settlement was verified against real pirates data (2026-08-29 returns `settled: true` with
per-player points) plus five unit tests.

## Limitations

- **No settings UI.** `resolveFantasyConfig` reads optional per-league overrides from
  `info.json`, so squad size / affordability / scoring are tunable by editing that file. A
  `FantasySettings.svelte` panel beside `MomentumSettings.svelte` is the follow-up.
- **Settlement waits on a manual rankings update**, the same as every other derived view in
  the app. The leaderboard says so rather than showing zeros.
- ~~**The market is only as good as the pool at freeze time.** A late signup is out for that
  week.~~ Fixed in `202609101740-fantasy-live-market-implementation.md`: the board stays live
  until the window closes, and a squad that drifts over budget is warned and left unscored
  rather than being protected by an early freeze.
- **No "squad to beat".** `bestSquad` is already exported and would show the
  expected-points-optimal XI before the session and the hindsight-best after it; deliberately
  left out of v1.

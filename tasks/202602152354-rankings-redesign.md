# Rankings Data Redesign

## Implementation Summary

### Phase 1 — Completed

**What was done:**

- Renamed `rankingDetail` → `history` throughout the codebase
- Replaced flat 23-key history entries with a grouped structure (`points`,
  `performance`, `ratings`, `ranking`)
- Non-appearance entries now carry only `ratings` + `ranking` — no
  null-padded keys
- Attendance detection simplified to `'points' in entry`
- Removed `playersWhoAppeared` parameter from `updateRanksForDate` (made
  redundant by the new structure — presence of `history[date]` is now the
  attendance signal)
- All 612 backend tests updated and passing

**Files changed:**

- `src/lib/server/rankings.js` — write side, all internal reads
- `src/lib/server/playerManager.js` — provisional anchor + ELO lookup
- `src/lib/server/yearRecapManager.js` — rank improvement + silver/final loss
- `src/routes/api/rankings/+server.js` — strips `history` from list response
- `src/routes/api/rankings/[player]/+server.js` — player detail + chart data
- `src/routes/api/champions/+server.js` — hall of fame aggregation
- `src/routes/api/champions/[player]/+server.js` — trophy session details
- `test/lib/server/rankings.test.js`
- `test/lib/server/rankings.championships.test.js`
- `test/lib/server/rankings.yearBoundary.test.js`
- `test/lib/server/yearRecapManager.test.js`
- `test/lib/server/avatarManager.test.js`

**Deployment note:**

Run `updateRankings` oldest-year-first when regenerating after deploy, so
the previous year file is in the new format before the current year carries
ELO over from it. For the current deployment: 2025 first, then 2026.
Regenerating 2026 before 2025 causes the year-boundary decay gap to be
skipped, producing slightly inflated ELOs for players inactive over winter.

**Phase 2 status:** ready to begin — see below.

---

## Overview

A two-phase redesign of the rankings data structure to improve readability,
reduce file size, and establish a cleaner separation of concerns between
historical rankings data and session-time player ratings.

## Background

The `rankings-{year}.json` file has grown organically through multiple feature
iterations, resulting in:

- A flat 23-key `rankingDetail` entry per player per session date
- Non-appearance entries that carry 18 null keys alongside the 5 values that
  actually matter
- No clear distinction in the data shape between "played" and "didn't play"
- `rankings-2025.json` for pirates is 1.2MB for 39 players across 35 sessions

### Related branches (superseded, do not merge)

- `feat/rating-snapshots` — partial implementation of session ratings snapshot;
  needs to be redone from current `develop` HEAD per the design below

---

## Phase 1: rankingDetail grouping + non-appearance compaction

This is the immediate work. No schema changes to session files, no changes to
how rankings are calculated — only how the result is serialised.

### New `rankingDetail` entry shape

Rename `rankingDetail` → `history` at the player level.

#### Appearance entry (player attended the session)

```json
"2026-02-08": {
  "team": "green bats",
  "points": {
    "appearance": 1,
    "match": 6,
    "bonus": 4,
    "knockout": 0,
    "total": 11
  },
  "performance": {
    "leaguePosition": 1,
    "cupProgress": "semi",
    "leagueWinner": true,
    "cupWinner": false
  },
  "ratings": {
    "elo": 1043.2,
    "eloGames": 28,
    "attacking": 0.72,
    "control": 0.61,
    "gfRank": 3,
    "gfCount": 18,
    "gaRank": 5,
    "gaCount": 18,
    "goalsForPerSession": 12.5,
    "goalsAgainstPerSession": 8.3
  },
  "ranking": {
    "rank": 4,
    "totalPlayers": 39,
    "rankingPoints": 187.4
  }
}
```

Presence of the `points` and `performance` groups is the natural signal that
this was an attended session. No explicit `attended` flag needed.

`cupProgress` is kept inside `performance` even when null (no cup that session)
because null here is meaningful: the session happened but had no cup. Omitting
it would be ambiguous.

#### Non-appearance entry (player did not attend)

Only the fields that change when a session runs without you are stored. Null
keys are omitted entirely.

```json
"2026-02-15": {
  "ratings": {
    "elo": 1043.2,
    "eloGames": 28,
    "attacking": 0.72,
    "control": 0.61,
    "gfRank": 3,
    "gfCount": 18,
    "gaRank": 5,
    "gaCount": 18,
    "goalsForPerSession": 12.5,
    "goalsAgainstPerSession": 8.3
  },
  "ranking": {
    "rank": 5,
    "totalPlayers": 39,
    "rankingPoints": 187.4
  }
}
```

`rank` and `rankingPoints` must be stored even for non-attendees because rank
is a cross-player property: other players' sessions change everyone's position.
Accurate rank movement ("you went from 4 to 5 while you were away") requires a
rank entry on every session date for every player.

`ratings` is carried forward from last appearance for team-balancing context
and graph display. `elo` and `eloGames` do not change for non-attendees so
carrying them forward here is accurate.

#### Detecting attendance in consumers

```js
const attended = 'points' in entry;
```

### Flat → grouped field mapping

| Old flat key             | New location                     |
| ------------------------ | -------------------------------- |
| `team`                   | top-level (appearance only)      |
| `appearancePoints`       | `points.appearance`              |
| `matchPoints`            | `points.match`                   |
| `bonusPoints`            | `points.bonus`                   |
| `knockoutPoints`         | `points.knockout`                |
| `totalPoints`            | `points.total`                   |
| `leaguePosition`         | `performance.leaguePosition`     |
| `cupProgress`            | `performance.cupProgress`        |
| `leagueWinner`           | `performance.leagueWinner`       |
| `cupWinner`              | `performance.cupWinner`          |
| `eloRating`              | `ratings.elo`                    |
| `eloGames`               | `ratings.eloGames`               |
| `attackingRating`        | `ratings.attacking`              |
| `controlRating`          | `ratings.control`                |
| `gfRank`                 | `ratings.gfRank`                 |
| `gfCount`                | `ratings.gfCount`                |
| `gaRank`                 | `ratings.gaRank`                 |
| `gaCount`                | `ratings.gaCount`                |
| `goalsForPerSession`     | `ratings.goalsForPerSession`     |
| `goalsAgainstPerSession` | `ratings.goalsAgainstPerSession` |
| `rank`                   | `ranking.rank`                   |
| `totalPlayers`           | `ranking.totalPlayers`           |
| `rankingPoints`          | `ranking.rankingPoints`          |

### Player-level field cleanup

The player object currently duplicates several fields that are already in the
most recent history entry. These are kept at player level for convenience (API
consumers don't need to dig into history for current values). No changes
proposed to player-level fields for Phase 1 — this is out of scope.

### Estimated size impact

Current state (2026 file, 39 players):

- 206 total entries; 62 non-appearance (30%)
- Non-appearance entries: 18 null keys + 5 real values = 23 keys stored
- After compaction: 2 groups (10 values) per non-appearance entry
- Rough estimate: 40–50% file size reduction

### Files to change

**`src/lib/server/rankings.js`**

- `updateRanksForDate()` — writes non-appearance entries; strip null keys,
  write grouped structure
- The section in `updateRankings()` that writes appearance entries (around
  line 1081); write grouped structure
- `calculateAttackControlRatings()` — reads and writes per-entry rating fields;
  update to grouped paths
- `calculateMovementFromHistory()` — reads `rankingDetail[date].rank`; update
  to `history[date].ranking.rank`
- `findLastAppearance()` — reads `rankingDetail[date].totalPoints`; update to
  `history[date].points?.total`
- `countChampionships()` — reads `.leagueWinner` / `.cupWinner`; update to
  `.performance.leagueWinner` etc.
- `addChampionshipFlags()` — writes those same fields; update accordingly
- Rename all internal references from `rankingDetail` to `history`

**Consumers to audit** (read rankingDetail fields):

- `src/lib/server/playerManager.js` — ELO lookups, last-detail-before-date logic
- `src/lib/server/teamGenerator.js` — provisional rating anchor calculation
- `src/routes/api/rankings/+server.js` — response shape exposed to client
- `src/routes/api/teams/+server.js` — rating lookups for draw
- Any Svelte components that consume `rankingDetail` directly

### No migration script needed

`updateRankings()` already reconstructs rankings entirely from session files.
After deploying, simply call `updateRankings()` for each active league and the
rankings file will be rewritten in the new format.

There is no window risk for the pirates league: the gap between session end and
the next sign-up window opening is wide enough to run the update at leisure.

### Test changes

- Update all tests that construct or assert against `rankingDetail` flat
  structure to use the new grouped shape
- Add tests asserting non-appearance entries contain no null-valued keys
- Add tests asserting attendance detection via `'points' in entry`

---

## Phase 2: Session ratings snapshot

Addresses the separate problem of draw-time rating accuracy: the Teams page
should always show the ELO ratings players had _at the time of the draw_, not
their post-session recalculated values.

**Status**: partial implementation exists in `feat/rating-snapshots` branch but
needs to be redone from `develop` HEAD after Phase 1 lands.

Full design in `tasks/session-rating-snapshot-implementation.md`. Key points:

- A `ratingsSnapshot` object stored in each session file at the time players
  register, keyed by player name
- Recalculated on every player operation (add/remove/move/assign) so it always
  reflects the current registered player pool
- Becomes the sole source of truth for the Teams page and DrawReplay component
- Removes the need for complex "infer ratings from last ranking detail before
  date" reconstruction logic in playerManager and teamGenerator

Phase 2 does not depend on Phase 1 being complete, but Phase 1 should land
first so the snapshot implementation is built against the stable new structure.

---

## Out of scope (deferred)

- `rankingDetail` restructure proposed in `tasks/goal-scorer-tracking-implementation.md`
  is superseded by this document
- Per-player ranking files (`rankings/{year}/{player}.json`) — rejected; rank
  is a cross-player property requiring all players to be loaded anyway
- Separate `sessionRanks` top-level structure — considered and rejected in
  favour of keeping non-appearance entries in player history, compacted

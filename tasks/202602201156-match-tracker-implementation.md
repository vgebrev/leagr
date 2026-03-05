# Match Tracker Implementation

## Overview

Adding a dedicated `/games/match` route optimised for real-time action capture during a match. This is a third additive layer on top of existing score entry — all existing workflows remain intact.

**Capture layers:**

- Layer 1 (existing): /games score inputs → `homeScore`/`awayScore`
- Layer 2 (existing): scorer popover on MatchCard → score + `homeScorers`/`awayScorers`
- Layer 3 (new): /games/match → all of the above + `homeOffensiveActions`/`awayOffensiveActions`/`homeDefensiveActions`/`awayDefensiveActions`

**UX goal:** Single-tap capture — screen on → tap player → screen off. Sticky action mode (Goals / Offensive / Defensive) eliminates the need to re-select the action type between consecutive same-type events.

**Medium-term intent:** The new action fields will feed into more refined attack/defense ratings, better team balancing (avoid all-defenders or all-attackers), and archetype badges (Lethal Finisher, Brick Wall, Midfield Maestro). For now the data is captured in session files alongside scorers; `updateRankings` will be extended later to aggregate and use it.

---

## Architecture Decisions

### URL Structure

```
/games/match?date=YYYY-MM-DD&competition=league|knockout&round=R&match=M
```

- `competition=league`: `round` = 1-indexed round number, `match` = 1-indexed position within round
- `competition=knockout`: `round` = string name (`quarter`, `semi`, `final`, `round-of-N`), `match` = match number from bracket object

This uniquely identifies any match in any competition without ambiguity.

### Data Model

Four new optional fields per match object — same shape as `scorers`:

```json
{
    "homeOffensiveActions": { "Player Name": 2 },
    "awayOffensiveActions": { "Player Name": 1 },
    "homeDefensiveActions": { "Player Name": 3 },
    "awayDefensiveActions": { "Player Name": 1 }
}
```

No API changes required — new fields pass through existing endpoints transparently (`data.set()` stores the full match object). Validation of action fields deferred to when they are consumed by rankings logic.

### Action Mode (Sticky)

The page has a mode selector (Goals | Offensive | Defensive) that persists until changed. This means consecutive same-type events require only one tap per event — no need to navigate back to a popover.

| Mode      | [+] effect                                              | Score change                                        |
| --------- | ------------------------------------------------------- | --------------------------------------------------- |
| Goals     | increment `homeScorers`/`awayScorers`                   | yes — same logic as `MatchCard.handleScorersUpdate` |
| Offensive | increment `homeOffensiveActions`/`awayOffensiveActions` | no                                                  |
| Defensive | increment `homeDefensiveActions`/`awayDefensiveActions` | no                                                  |

Own Goal row (capped at 2, matching ScorerPopover) appears only in Goals mode.

### Score Inputs

Manual score entry is preserved on the match page — the score inputs work identically to the /games page. This is the only mechanism for capturing penalty-shootout winners in the knockout competition (manually adding a goal to the winning team's score).

### Save Strategy

Optimistic update on every tap → API save → revert + notification on error. Same pattern as /games page.

---

## Files Modified

| File                                                    | Change                                                                                                                        |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/shared/matchUtils.js`                          | New — pure utility functions: `findLeagueMatch`, `findKnockoutMatch`, `updateActionCount`                                     |
| `src/lib/client/services/games.svelte.js`               | New — `GamesService` singleton; re-exports utils; also refactors all league + knockout API logic out of both page components  |
| `src/routes/games/match/+page.svelte`                   | New — match tracker page; reads URL params via `page.url.searchParams` (no `+page.js`)                                        |
| `src/routes/games/components/ScheduleDisplay.svelte`    | Add `date` prop; inline SVG eye-icon link on each match row → `/games/match?competition=league&...`                           |
| `src/routes/games/+page.svelte`                         | Refactored to use `gamesService`; passes `date` prop to `<ScheduleDisplay>`                                                   |
| `src/routes/knockout/components/KnockoutBracket.svelte` | Add `date` prop; inline SVG eye-icon link on valid match cards (hidden for BYE/TBD) → `/games/match?competition=knockout&...` |
| `src/routes/knockout/+page.svelte`                      | Refactored to use `gamesService`; passes `date` prop to `<KnockoutBracket>`                                                   |
| `test/routes/games/match.test.js`                       | New — 19 unit tests for the three pure utility functions (imports from `$lib/shared/matchUtils.js`)                           |

---

## Testing Approach

Unit tests cover the pure stateless utility functions:

- `findLeagueMatch(rounds, roundParam, matchParam)` — 1-indexed params → 0-indexed array lookup
- `findKnockoutMatch(bracket, roundParam, matchParam)` — string round name + match number lookup
- `updateActionCount(actions, playerName, delta)` — increment/decrement with key cleanup at zero

End-to-end verification:

1. Navigate /games → click tracker icon on a league match → page loads with correct scores
2. Tap player in Goals mode → score increments, scorer recorded, saves
3. Switch to Offensive mode → tab stays selected; tap player → action count up, score unchanged
4. [−] disabled at count 0
5. Navigate /knockout → click tracker icon → knockout data loads correctly
6. Manual score entry works (including penalty scenario)
7. Back button returns to correct page (/games or /knockout)

---

## Deviations from Original Spec

- **No `+page.js`**: URL params (`competition`, `round`, `match`) are read directly from `page.url.searchParams` in the component, following the project convention of avoiding `+page.js`/`+page.server.js` where possible.
- **`GamesService` introduced**: All league and knockout API calls and state were extracted from `/games/+page.svelte` and `/knockout/+page.svelte` into a new `GamesService` singleton (`src/lib/client/services/games.svelte.js`), matching the existing `PlayersService`/`TeamsService` pattern. Both pages were refactored to use it.
- **Utility functions in `$lib/shared/`**: `findLeagueMatch`, `findKnockoutMatch`, `updateActionCount` live in `src/lib/shared/matchUtils.js` (a plain `.js` file) rather than inline in the page or bundled with the service, so they can be imported in the node-environment test without Svelte rune dependencies.
- **Tracker link uses inline SVG**: An inline SVG eye icon (`heroicons` outline style) is used for the match tracker link rather than a flowbite-svelte-icons component, avoiding uncertainty about icon availability at build time.
- **`GamesService.loadForMatchTracker`**: The knockout variant of this method only fetches bracket + teams (2 API calls) rather than the full `loadKnockout` call (4 API calls), keeping the tracker page lightweight.

## Assumptions & Limitations

- Action data is display-only for now — not yet consumed by rankings or team generator
- No per-action undo stack — corrections are made via [−] buttons
- The match page does not display the full schedule context, only the single match being tracked
- Players must already be assigned to teams for the player list to populate (depends on teams data being set for the date)

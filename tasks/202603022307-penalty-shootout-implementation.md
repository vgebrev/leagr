# Penalty Shootout Feature

**Date:** 2026-03-02

## Overview

Penalty shootouts are now a first-class data concept. Previously, tiebreakers required manually adding an unattributed goal to the main scoreline, which polluted goal stats and misrepresented results. Penalties are now stored separately (`homePenalties` / `awayPenalties`), displayed in the bracket, used correctly for advancement/winner logic, and awarded a modest 0.65/0.35 ELO split rather than a full win or neutral draw.

## Files Modified

| File                                                    | Change                                                                                                                                                                                                                                          |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/knockoutManager.js`                     | `getMatchWinner()` checks `homePenalties`/`awayPenalties` when main score is a draw                                                                                                                                                             |
| `src/routes/api/games/knockout/+server.js`              | Added penalty validation in `updateScores` handler (both-together, range, draw-only)                                                                                                                                                            |
| `src/routes/games/match/+page.svelte`                   | Added penalty state, `handlePenaltyChange()`, penalty inputs UI (shown when knockout draw), and penalty auto-clear in `handleScoreChange()`                                                                                                     |
| `src/components/MatchCard.svelte`                       | Added display-only `(4–3p)` line in vertical orientation when penalties are present                                                                                                                                                             |
| `src/routes/knockout/+page.svelte`                      | Extracted `getKnockoutWinner()` helper; used in `checkForWinner()` and `celebrateTeam()`                                                                                                                                                        |
| `src/routes/knockout/components/KnockoutBracket.svelte` | Updated `isLoser()` and click handlers to be penalty-aware                                                                                                                                                                                      |
| `src/lib/server/rankings.js`                            | `getTeamCupProgress()` handles draw + penalty; `getCupWinner()` handles penalty fallback; `updateEloRatingsForGame()` accepts `homePenalties`/`awayPenalties` with 0.65/0.35 split; `processEloRatings()` passes penalties for knockout matches |
| `src/lib/server/yearRecapManager.js`                    | Cup winner colour stat handles penalty tiebreaker                                                                                                                                                                                               |
| `test/lib/server/knockoutManager.test.js`               | 5 new penalty shootout tests + 1 `advanceWinners` penalty test                                                                                                                                                                                  |

## Architecture Decisions

- **0.65 / 0.35 ELO split** — at K=15 (cup) with evenly matched teams, the penalty winner gains ≈2.25 ELO pts; meaningful but modest.
- **Margin multiplier unchanged** — uses `homeScore − awayScore` (0 for a draw), so a penalty win never gets a goal-difference bonus.
- **Penalties auto-clear** — `handleScoreChange` sends `homePenalties: null, awayPenalties: null` whenever the main scores stop being a draw, preventing stale data.
- **No new validation helper** — `validateGameScore()` reused for range checks; "both together" and "draw only" checks are inline in the API route.
- **Display only on /knockout bracket** — `MatchCard` shows `(4–3p)` in vertical mode. Penalty inputs live exclusively on the match tracker page (`/games/match`).

## Testing

- 5 new `getMatchWinner` tests (home win on penalties, away win on penalties, draw on equal penalties, draw with no penalties, null for incomplete)
- 1 new `advanceWinners` test (penalty winner correctly slotted into next round)
- All 713 existing tests continue to pass (636 backend + 77 frontend)

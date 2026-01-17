# Golden Boot Implementation

## Overview

Implemented a season-level golden boot feature that aggregates individual goal scorer data across all sessions for a league, displaying top scorers with their league goals, cup goals, and total goals.

## Architecture Decisions

### Data Aggregation

- **Session file scanning**: Reads all session files (`YYYY-MM-DD.json`) for the specified year(s)
- **Goal extraction**: Extracts scorer data from both league rounds (`games.rounds`) and knockout cup matches (`games.knockout-games.bracket`)
- **Reserved key filtering**: Skips reserved scorer keys (`__ownGoal__`, `__unassigned__`) when aggregating player goals
- **Year support**: Supports specific year or "all" for all-time aggregation (same pattern as Champions Hall)

### API Design

- **Endpoint**: `GET /api/golden-boot?year={year|all}`
- **Response**: `{ scorers: [{ playerName, leagueGoals, cupGoals, totalGoals }] }`
- **Sorting**: By total goals (desc), then league goals (desc), then cup goals (desc)

### UI/UX Design

- **Year selector**: Dropdown with year options plus "all" for all-time
- **Table display**: Rank, Player name, League goals, Cup goals, Total goals
- **Golden Boot icon**: SoccerBootIcon displayed next to top scorer
- **Celebration**: Click on top scorer triggers confetti celebration
- **Empty state**: Friendly message when no goals have been recorded

## Files Modified

### New Files

- `/src/routes/api/golden-boot/+server.js` - API endpoint for aggregating goal scorer data
- `/src/routes/golden-boot/+page.svelte` - Golden boot page component

### Modified Files

- `/src/routes/rankings/+page.svelte` - Added Golden Boot button below Champions Hall button
  - Added import for SoccerBootIcon
  - Added goldenBootUrl derived value
  - Added Golden Boot button with flex layout

## Data Flow

1. **Request**: Client requests `/api/golden-boot?year=2025` (or `year=all`)
2. **File scanning**: API reads all session files for the specified year(s)
3. **Goal extraction**: For each session, extracts scorers from:
   - League games: `games.rounds[round][match].homeScorers` / `awayScorers`
   - Cup games: `games.knockout-games.bracket[match].homeScorers` / `awayScorers`
4. **Aggregation**: Accumulates goals per player, separating league and cup goals
5. **Response**: Returns sorted array of scorers with goal breakdown

## Testing Strategy

- Existing test suite passes (1039+ tests)
- Linting passes
- Production build succeeds
- Manual testing with existing session data

## Integration with Goal Scorer Tracking

This feature builds on the goal scorer tracking implementation (Phase 1), which stores individual goal scorers in match data:

```json
{
  "homeScorers": { "PlayerName": goalCount, "__ownGoal__": ownGoalCount },
  "awayScorers": { "PlayerName": goalCount }
}
```

The golden boot feature aggregates this data across all sessions to produce season-level statistics.

## Limitations

- Only includes goals from sessions with scorer data (optional field)
- Historical sessions without scorer tracking will not contribute to totals
- Own goals are tracked separately and excluded from player totals

## Future Enhancements

- Add player avatars to the golden boot table
- Add session details popover showing when goals were scored
- Integrate with rankings page player detail view

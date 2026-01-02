# Goal-Scorer Tracking Implementation

## Overview

Implemented individual goal-scorer tracking for both league games and knockout cup matches. Users can now assign goals to specific players through an interactive popover UI, enabling detailed performance analytics and future attack rating improvements.

## Architecture Decisions

### Phase 1: Data Capture (Completed)

- **Data Storage**: Scorer data stored alongside scores in session files (`homeScorers`, `awayScorers`)
- **Data Format**: `{ "PlayerName": goalCount, "__ownGoal__": ownGoalCount }`
- **Reserved Keys**: `__ownGoal__` for own goals, `__unassigned__` reserved for future use
- **Partial Assignment**: Goals don't need to be fully assigned - supports gradual adoption
- **Dual Input**: Manual score entry preserved as fallback, popover as primary capture method

### Phase 2: Aggregation & Analytics (Pending)

- Rankings calculation to aggregate individual goals per player
- Attack rating calculation using hybrid formula (team performance + individual goals)
- rankingDetail restructure for better organization

### UI/UX Design

**Popover Interaction Pattern:**

- Click score input to open popover
- Compact design: No header, no close button
- Team-colored styling for visual context
- +/- buttons for each player
- Own Goal tracking with 2-goal limit
- Auto-closes on score change or outside click

**Auto-Zero Behavior:**

- First goal on unscored match: Auto-set opposite team to 0
- Reducing to zero: Keep as 0 (not null) to preserve valid score state
- Never touch opposite score if already set

**Component Architecture:**

- Unified `MatchCard` component with orientation support:
    - `horizontal` - League games (single row: badge-score-score-badge)
    - `vertical` - Knockout games (two rows: badge-score per team)
- Popover state managed internally within MatchCard
- Decoupled from API persistence logic

## Files Modified

### Core Components

- `/src/components/MatchCard.svelte` - **NEW**: Unified match card with dual orientation support
- `/src/components/ScorerPopover.svelte` - **MOVED**: Shared scorer input UI component

### League Games

- `/src/routes/games/components/ScheduleDisplay.svelte` - Updated to use unified MatchCard
- `/src/routes/games/+page.svelte` - Loads teams data for scorer validation

### Knockout Cup

- `/src/routes/knockout/components/KnockoutBracket.svelte` - Updated to use unified MatchCard
- `/src/routes/knockout/+page.svelte` - Loads teams data for scorer validation
- `/src/routes/api/games/knockout/+server.js` - Added scorer validation

### API Layer

- `/src/routes/api/games/+server.js` - Added scorer validation for league games
- `/src/lib/shared/validation.js` - Fixed sanitization to preserve scorer fields

### Validation

- Added `validateScorers()` - Validates scorer data for a single team
- Added `validateMatchScorers()` - Validates both home/away scorers for a match
- Reserved keys: `RESERVED_SCORER_KEYS.OWN_GOAL`, `RESERVED_SCORER_KEYS.UNASSIGNED`
- Validation rules:
    - Scorers must be on team roster
    - Goal counts must be positive integers
    - Total assigned goals cannot exceed team score
    - Own goals limited to 2 per team per match
    - Partial assignment allowed (total assigned < team score)

## Data Structure

### Session File Format

```json
{
    "rounds": [
        [
            {
                "home": "green bats",
                "away": "blue gladiators",
                "homeScore": 3,
                "awayScore": 2,
                "homeScorers": {
                    "Veli": 2,
                    "Dan": 1
                },
                "awayScorers": {
                    "Chris": 1,
                    "__ownGoal__": 1
                }
            }
        ]
    ]
}
```

### Knockout Bracket Format

```json
{
    "bracket": [
        {
            "round": "semi",
            "match": 1,
            "home": "green bats",
            "away": "orange wizards",
            "homeScore": 2,
            "awayScore": 0,
            "homeScorers": {
                "Morena": 1,
                "Kat": 1
            },
            "awayScorers": null
        }
    ]
}
```

## Testing Strategy

### Validation Tests (Existing)

- 122 tests passing for scorer validation
- Tests cover:
    - Valid scorer assignments
    - Invalid player names
    - Exceeding team score
    - Negative goal counts
    - Own goal limits
    - Reserved key handling

### Integration Tests (Pending)

- API endpoint tests for score + scorer updates
- Concurrent update handling
- Rankings aggregation tests

## Implementation Notes

### Component Refactoring Benefits

- **Eliminated duplication**: ~150 lines of scorer logic consolidated
- **Simplified state**: Popover state managed internally, no parent tracking needed
- **Better separation**: MatchCard handles UI, parent handles persistence
- **Easier maintenance**: Single source of truth for match interaction patterns

### Validation Flow

1. Client sends match with optional `homeScorers`/`awayScorers`
2. Server validates score consistency
3. Server validates scorer data against team rosters
4. Sanitization preserves scorer fields (fixed bug in `validateRound()`)
5. Data persisted to session file

### Known Limitations

- Scorer data optional - supports gradual adoption
- No historical migration (only affects new score entries)
- Own goals count toward team score (by design)

## Future Enhancements (Phase 2)

### Rankings Aggregation

- Calculate total goals scored per player across all matches
- Separate league vs cup goal tallies
- Track own goals separately

### Attack Rating Improvements

- Hybrid formula: Team performance (existing) + Individual goals (new)
- Weight individual contribution alongside team success
- Maintain historical compatibility for players without scorer data

### rankingDetail Restructure

- Current flat structure: 24 properties
- Proposed grouped structure:
    ```javascript
    {
      team: "...",
      points: { appearance, match, bonus, knockout, total },
      goals: { scored, ownGoals, teamGoalsFor, teamGoalsAgainst, goalsForPerSession, goalsAgainstPerSession },
      performance: { leaguePosition, cupProgress, leagueWinner, cupWinner },
      ratings: { elo, eloGames, attacking, control },
      ranking: { rank, totalPlayers, rankingPoints, gfRank, gfCount, gaRank, gaCount }
    }
    ```
- Migration script: `/scripts/migrate-ranking-detail-v2.js`

## Migration Strategy

### Data Migration

- No migration needed for existing data (scorer fields are optional)
- New scores can include scorer data from day 1
- Backward compatible: Rankings still work without scorer data

### rankingDetail Migration (Pending)

- Script created: `/scripts/migrate-ranking-detail-v2.js`
- Supports `--dry-run` for validation
- Supports `--league=ID` for targeted migration
- Preserves all existing data, just reorganizes structure

## Performance Considerations

- Minimal overhead: Scorer data only transmitted when present
- Validation lightweight: Single pass through team roster
- No impact on existing score-only workflows

## User Experience

### Pilot Phase

- Loose validation: Partial assignment allowed
- No visual indicators removed for simplicity
- Users can adopt gradually (manual scores still supported)
- Popover intuitive: Click input → assign goals → auto-close

### Accessibility

- Keyboard navigable (Enter/Space on team badges)
- Clear aria-labels on score inputs
- Focus management for popover interactions

## Lessons Learned

1. **Incremental refactoring pays off**: Moving ScorerPopover to shared components enabled reuse
2. **Unified components reduce bugs**: Single MatchCard eliminated state management complexity
3. **Validation-first approach**: Comprehensive validation tests caught edge cases early
4. **Graceful degradation**: Optional scorer data ensures backward compatibility
5. **User feedback critical**: Removed confusing green borders after pilot feedback

## Next Steps

1. Monitor usage during pilot session
2. Gather user feedback on UX
3. Implement Phase 2: Rankings aggregation
4. Update attack rating formula
5. Run rankingDetail migration
6. Write integration tests for full flow

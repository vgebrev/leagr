# Performance Tracking Implementation

## Overview

Added comprehensive performance tracking to player rankings, including league positions, cup progress, win streaks, and achievements. This feature provides players with detailed insights into their competitive performance across sessions.

**Implementation Date:** November 2025

## Features Implemented

### 1. League Position Tracking

- Tracks the league position (1st, 2nd, 3rd, etc.) for each session a player participates in
- Stored as `leaguePosition` (1-indexed integer) in player's `rankingDetail[{date}]`
- Displayed as a distribution bar chart showing frequency of each position

### 2. Cup Progress Tracking

- Tracks how far a player progressed in knockout cup competition
- Stored as `cupProgress` (raw round name or 'winner') in player's `rankingDetail[{date}]`
- Supports all knockout rounds: `winner`, `final`, `semi`, `quarter`, `round-of-16`, `round-of-32`, etc.
- Only populated when cup matches had completed results (distinguishes "cup didn't happen" from "player didn't play")
- Displayed as a distribution bar chart showing frequency of each cup achievement

### 3. Achievements Tracking

- **Longest League Win Streak**: Consecutive sessions where player finished 1st
- **Longest Cup Win Streak**: Consecutive sessions where player won the cup
- **Double Winners**: Count of sessions where player won both league and cup

### 4. Missed Sessions Toggle

- Optional toggle to show/hide missed sessions count on distribution charts
- Missed sessions appear as grayed, dashed bars at the bottom of charts
- Toggle is off by default

## Architecture

### Backend Changes

#### `src/lib/server/rankings.js`

**New Methods:**

1. **`getLeaguePositions(standings)`**
    - Converts 0-indexed team standings to 1-indexed league positions
    - Returns: `{ [teamName]: position }` where position is 1-indexed

2. **`getTeamCupProgress(knockoutBracket)`**
    - Determines the furthest cup round each team reached
    - Handles all round formats (final, semi, quarter, round-of-16, round-of-32, etc.)
    - Returns: `{ [teamName]: 'winner' | roundName }` or empty object if no completed matches

**Updated Methods:**

3. **`updateRankings()`**
    - Now calculates `leaguePositions` and `teamCupProgress` for each session
    - Adds `leaguePosition` and `cupProgress` to each player's `rankingDetail[{date}]`

**Data Flow:**

```javascript
// During ranking calculation for each session:
const leaguePositions = this.getLeaguePositions(standings);
const teamCupProgress = this.getTeamCupProgress(knockoutBracket);

// Added to each player's detail:
playerData.rankingDetail[date] = {
    // ... existing fields
    leaguePosition: leaguePositions[teamName] || null,
    cupProgress: teamCupProgress[teamName] || null
};
```

### API Changes

#### `src/routes/api/rankings/[player]/+server.js`

Updated to include new fields in player details response:

```javascript
{
    // ... existing fields
    leaguePosition: entry.leaguePosition !== undefined ? entry.leaguePosition : null,
    cupProgress: entry.cupProgress !== undefined ? entry.cupProgress : undefined
}
```

### Frontend Implementation

#### `src/routes/rankings/[player]/components/PerformanceSection.svelte`

**New Component** - Displays player performance metrics and achievements.

**Key Features:**

- Distribution charts for league positions and cup progress
- Achievements section showing win streaks and double winners
- Toggle for showing/missed sessions
- Responsive grid layout (2 columns on desktop)

**Reactive Calculations:**

```javascript
// Distribution aggregation
const leagueDistribution = $derived.by(() => {
    // Aggregates league position frequency
});

const cupDistribution = $derived.by(() => {
    // Aggregates cup progress frequency with proper ordering
});

// Streak calculations
const longestLeagueStreak = $derived.by(() => {
    // Finds longest consecutive league wins
});

const longestCupStreak = $derived.by(() => {
    // Finds longest consecutive cup wins
});

const doubleWinnerCount = $derived.by(() => {
    // Counts sessions with both league and cup wins
});
```

**Chart Rendering:**

- SVG-based bar charts with dynamic sizing
- Color-coded (primary for league, secondary for cup, yellow for double winners)
- Responsive labels with ordinal suffixes (1st, 2nd, 3rd, etc.)
- Dashed, grayed styling for missed sessions

#### Updated: `src/routes/rankings/[player]/+page.svelte`

Added PerformanceSection between RankProgressionChart and AppearanceHistorySection:

```svelte
<RankProgressionChart {playerData} />
<PerformanceSection {playerData} />
<AppearanceHistorySection {playerData} />
```

## Data Structure

### rankingDetail Entry Format

```javascript
rankingDetail: {
    "2025-11-16": {
        team: "Red Team",
        appearancePoints: 1,
        matchPoints: 6,
        bonusPoints: 3,
        knockoutPoints: 2,
        totalPoints: 12,
        eloRating: 1050,
        leagueWinner: false,
        cupWinner: false,
        leaguePosition: 2,          // NEW: 1-indexed position (null if didn't play)
        cupProgress: "semi"          // NEW: round name or 'winner' (null if didn't play, undefined if cup didn't happen)
    }
}
```

### Round Name Mapping

Backend stores raw round names from knockout bracket:

- `'winner'` - Won the cup
- `'final'` - Lost in final
- `'semi'` - Lost in semi finals
- `'quarter'` - Lost in quarter finals
- `'round-of-16'` - Lost in round of 16
- `'round-of-32'`, `'round-of-64'`, etc. - Lost in earlier rounds

Frontend maps to human-readable labels:

- `'winner'` → "Cup Winner"
- `'final'` → "Final"
- `'semi'` → "Semi Finals"
- `'quarter'` → "Quarter Finals"
- `'round-of-16'` → "Round of 16"
- `'round-of-32'` → "Round of 32"

## Testing

### Unit Tests Added

**File:** `test/lib/server/rankings.test.js`

Added 15 new tests covering:

1. **getLeaguePositions (3 tests)**
    - Converts 0-indexed to 1-indexed positions
    - Handles empty standings
    - Handles single team

2. **getTeamCupProgress (12 tests)**
    - Identifies cup winners
    - Handles teams eliminated in different rounds
    - Supports all round formats (final, semi, quarter, round-of-16, round-of-32)
    - Returns empty for null/undefined brackets
    - Returns empty when no completed matches
    - Ignores incomplete matches but processes complete ones
    - Tracks furthest round reached

**Test Coverage:** All 596 tests pass (519 backend + 77 frontend)

### Test Examples

```javascript
it('should identify cup winner', () => {
    const bracket = [
        { round: 'semi', home: 'Red', away: 'Blue', homeScore: 2, awayScore: 1 },
        { round: 'semi', home: 'Green', away: 'Yellow', homeScore: 3, awayScore: 1 },
        { round: 'final', home: 'Red', away: 'Green', homeScore: 2, awayScore: 1 }
    ];

    const progress = rankingsManager.getTeamCupProgress(bracket);

    expect(progress['Red']).toBe('winner');
    expect(progress['Green']).toBe('final');
    expect(progress['Blue']).toBe('semi');
    expect(progress['Yellow']).toBe('semi');
});
```

## Design Decisions

### 1. Raw Round Names in Backend

**Decision:** Store raw round names from knockout bracket in backend.

**Rationale:**

- Keeps backend data consistent with source (knockout bracket)
- Formatting/display concerns handled in presentation layer
- Easier to support new round formats in future

### 2. Undefined vs Null for cupProgress

**Decision:** `undefined` = cup didn't exist, `null` = player didn't participate

**Rationale:**

- Distinguishes between "feature didn't exist yet" and "player was absent"
- Important for historical data where cup was added mid-season
- Only populate when `hasCompletedMatches` to avoid ambiguity

### 3. 1-Indexed League Positions

**Decision:** Store league positions as 1-indexed (1st, 2nd, 3rd) rather than 0-indexed.

**Rationale:**

- Matches user mental model (people think "1st place" not "0th place")
- Simplifies frontend display logic
- Null value clearly indicates "didn't participate"

### 4. Consecutive Streak Calculation

**Decision:** Calculate streaks from consecutive sessions (not total wins).

**Rationale:**

- More impressive/meaningful achievement
- Rewards consistency over time
- Common pattern in sports statistics

### 5. Toggle for Missed Sessions

**Decision:** Make missed sessions toggle off by default.

**Rationale:**

- Primary focus is on performance when playing
- Missed sessions can skew visual perception
- User can enable if interested in attendance patterns

## Files Modified

### Backend

- `src/lib/server/rankings.js` - Added performance tracking methods

### API

- `src/routes/api/rankings/[player]/+server.js` - Include new fields in response

### Frontend

- `src/routes/rankings/[player]/+page.svelte` - Added PerformanceSection
- `src/routes/rankings/[player]/components/PerformanceSection.svelte` - **NEW** component

### Tests

- `test/lib/server/rankings.test.js` - Added 15 new unit tests

## Usage

### Triggering Ranking Updates

Performance data is calculated automatically when rankings are updated:

```bash
# Manual update via script
node test/manual/update-rankings.js pirates

# Or via API
POST /api/rankings
```

### Accessing Performance Data

Performance data is available through the player profile API:

```javascript
GET /api/rankings/[player]?year=2025

Response:
{
    player: "John Doe",
    details: [
        {
            date: "2025-11-16",
            leaguePosition: 2,
            cupProgress: "semi",
            // ... other fields
        }
    ]
}
```

## Future Enhancements

### Potential Additions

1. **Head-to-head performance** - Track performance against specific opponents
2. **Form indicators** - Recent performance trends (last 5 sessions)
3. **Best/worst performances** - Highlight standout sessions
4. **Year-over-year comparison** - Compare streaks across different years
5. **Export functionality** - Download performance data as CSV/PDF
6. **Performance goals** - Set and track personal achievement targets

### Visual Improvements (Planned)

- Enhanced styling for achievements section
- Icons for different achievement types
- Animated transitions when toggling missed sessions
- Tooltips showing session dates for chart bars

## Notes

- Performance data is only calculated when rankings are updated
- Existing historical data will have these fields populated on next ranking update
- League position is always available (all sessions have standings)
- Cup progress only available when knockout matches were played and had results
- Streaks reset when player misses a session (doesn't participate)

## Related Features

- **Ranking System** - Core ranking calculation (src/lib/server/rankings.js)
- **Knockout Cup** - Cup bracket management (src/lib/server/knockoutManager.js)
- **Standings** - League table calculation (src/lib/server/standings.js)
- **Year Recap** - Annual performance summary (src/lib/server/yearRecapManager.js)

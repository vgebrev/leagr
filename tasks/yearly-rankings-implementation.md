# Yearly Rankings System Implementation

**Date**: 2025-11-02
**Status**: ✅ Completed

## Overview

Implemented a yearly rankings system that resets player statistics annually while preserving ELO ratings for team balance. This motivates players with fresh competition each year while maintaining fair team generation.

## Architecture Decisions

### Rankings File Structure

- **Before**: Single `rankings.json` file with all-time data
- **After**: Yearly files `rankings-YYYY.json` (e.g., `rankings-2025.json`, `rankings-2026.json`)
- **Rationale**: Bounded processing time (~50 sessions max per year), natural archival structure

### ELO Carry-Over Strategy

- **What carries over**: ELO rating + total games played
- **What resets**: Points, appearances, ranking stats, rank movement
- **Rationale**: Preserves team balance while giving fresh competitive slate

### Year Configuration

- Created `src/lib/shared/yearConfig.js` with MIN_YEAR and MAX_YEAR constants
- MAX_YEAR can be set to future year for testing (e.g., 2026)
- All year selectors dynamically generate options from this config

## Files Modified

### Backend (Server-side)

**`src/lib/server/rankings.js`**

- Added `getRankingsPath(year)` - Year-specific file paths
- Added `filterSessionFilesByYear(files, year)` - Filter sessions by year
- Added `loadPreviousYearElo(previousRankings)` - Extract ELO for carry-over
- Added `initializePlayerWithCarryOverElo(player, eloCarryOver)` - Init with carried ELO
- Updated `updateRankings(year)` - Year parameter, reads previous year's ELO, filters sessions
- Updated `loadRankings(year)` - Accept year parameter
- Updated `loadEnhancedRankings(year)` - Accept year parameter
- Updated `processEloRatings()` - Pass eloCarryOver through to game processing
- Updated `updateEloRatingsForGame()` - Use carry-over data when initializing players

**`src/routes/api/rankings/+server.js`**

- Added year query parameter (defaults to current year)
- GET and POST now accept `?year=YYYY`

**`src/routes/api/rankings/[player]/+server.js`**

- Added year query parameter
- GET accepts `?year=YYYY&limit=N`

**`src/routes/api/players/ranked/+server.js`**

- Updated to aggregate unique players from all yearly rankings files
- Uses Set for automatic deduplication
- Returns all players who have ever been ranked (2025-2026)

**`src/routes/api/champions/+server.js`**

- Added year query parameter with three modes:
    - No parameter: current year (default)
    - `?year=YYYY`: specific year
    - `?year=all`: aggregate all years
- Aggregates leagueWins and cupWins across years when year=all

**`src/lib/shared/yearConfig.js`** (NEW)

- Defines MIN_YEAR (2025) and MAX_YEAR (configurable, defaults to current year)
- Exports `getYearOptions()` helper for UI dropdowns
- Centralized configuration for year bounds

### Frontend (Client-side)

**`src/routes/rankings/+page.svelte`**

- Added year dropdown selector (Button + Dropdown pattern)
- Reads year from URL `?year=YYYY` parameter
- Uses `$effect` to reload rankings when year changes
- Auto-disables "Regular players only" filter when < 2 sessions in selected year

**`src/routes/rankings/[player]/+page.svelte`**

- Added year dropdown selector
- Preserves year parameter when changing limit
- Fetches player data with `?year=YYYY&limit=N`

**`src/routes/champions/+page.svelte`**

- Added year dropdown selector with "All" option
- Dynamic subtitle based on selected year
- Fetches champions with `?year=YYYY` or `?year=all`

### Testing

**`test/lib/server/rankings.test.js`**

- Added test suite "RankingsManager - Yearly Rankings" with tests for:
    - `getRankingsPath()` with year parameter
    - `filterSessionFilesByYear()` year filtering
    - `loadPreviousYearElo()` ELO extraction from previous year
    - `initializePlayerWithCarryOverElo()` player initialization with carry-over
- Updated existing tests to match new ELO carry-over structure (object with rating + gamesPlayed)

## Testing Approach

### Unit Tests

- Comprehensive tests for yearly file paths, session filtering, and ELO carry-over logic
- All 486 backend tests pass ✅

### Manual Testing Steps

1. Set MAX_YEAR to 2026 in `yearConfig.js` for testing
2. Create test 2026 session files
3. Update rankings for 2026, verify ELO carry-over from 2025
4. Test year selectors on rankings, player detail, and champions pages
5. Verify "All" option on champions hall aggregates correctly

## Data Migration

- Existing `rankings.json` files renamed to `rankings-2025.json` for all leagues
- ELO data preserved intact
- No data loss during migration

## Assumptions & Limitations

### Assumptions

- Year rollover happens automatically based on session file dates (e.g., first 2026 session triggers ELO carry-over)
- Missing previous year rankings file is handled gracefully (start fresh with baseline ELO)
- All session files use YYYY-MM-DD.json naming convention

### Limitations

- Year selector only goes back to 2025 (MIN_YEAR)
- No automated cleanup of very old ranking files
- Champions "All" mode loads all year files sequentially (could be slow with many years, but acceptable for foreseeable future)

## Future Enhancements (Not Implemented)

- Year-over-year performance comparison charts
- "Year in Review" summary pages
- Historical data cleanup tools
- Bulk year migration utilities

# Session Rating Snapshot Implementation

## Overview

This document outlines the implementation of a ratings snapshot system that stores pre-calculated player ratings directly in session data, replacing the current reconstruction-from-ranking-details approach.

## Problem Statement

Currently, when viewing historical sessions (teams page), player ratings are reconstructed from ranking details by finding the last detail entry before the session date. This approach has several issues:

1. **Inconsistent with draw time**: Ratings shown when viewing historical teams don't always match what was shown during the draw
2. **Provisional rating discrepancies**: After ranking updates, provisional players' anchor calculations can change because the player pool has changed (players who participated now exist in current year rankings)
3. **Complex fallback logic**: Requires multiple fallback paths (current year details → previous year rankings) at various points
4. **Year boundary complexity**: Special handling needed for players carrying over ratings from previous year
5. **Maintenance burden**: Reconstruction logic exists in multiple places (playerManager, teamGenerator, teams API)

### Specific Example

On Jan 10, 2026:

- **Before ranking update**: Provisional ratings calculated with anchor based on weakest established player (Offie at 788.62)
- **After ranking update**: Players who participated in Jan 10 now exist in 2026 rankings but have no detail before Jan 10
- **Result**: Anchor calculation found them in 2026 but excluded them (games=0), changing anchor from 780.737 to 862.609
- **Outcome**: Historical display of Jan 10 teams shows different ratings than the draw showed

## Proposed Solution

Store a **ratings snapshot** in session data that captures each player's ratings at the moment they register for the session. This snapshot becomes the single source of truth for all historical displays.

### Key Design Decisions

1. **Snapshot recalculation on any player change**: Since provisional ratings depend on the anchor (weakest established player in session), the ENTIRE snapshot must be recalculated whenever:
    - A player is added to available/waiting list
    - A player is removed from the session
    - A player moves between lists
    - A player is assigned to/removed from a team

2. **No fallback/dual code paths**: After migration, there will be NO reconstruction fallback. All code will expect and use the snapshot. This keeps the codebase simple and unambiguous.

3. **Migration of historical data**: Create a one-time migration script to backfill all existing sessions with reconstructed snapshots using the current reconstruction logic, then remove that logic.

4. **Simplified draw history**: Store only player names in `initialPots`, not full player objects. Components look up ratings from snapshot.

## Data Structures

### Ratings Snapshot (stored in session data)

```json
{
    "ratingsSnapshot": {
        "John Doe": {
            "elo": 955,
            "actualElo": 1000,
            "isProvisional": true,
            "eloGames": 12,
            "attackingRating": 0.75,
            "controlRating": 0.68,
            "avatar": "avatar-url-or-null"
        },
        "Jane Smith": {
            "elo": 1245,
            "actualElo": 1245,
            "isProvisional": false,
            "eloGames": 156,
            "attackingRating": 0.82,
            "controlRating": 0.79,
            "avatar": null
        }
    }
}
```

### Draw History (updated structure)

```json
{
    "drawHistory": {
        "drawHistory": [
            { "player": "John Doe", "toTeam": "Blue Team" },
            { "player": "Jane Smith", "toTeam": "White Team" }
        ],
        "initialPots": [
            {
                "name": "Pot 1",
                "players": ["John Doe", "Jane Smith"] // Just names, not objects
            }
        ],
        "method": "seeded"
    }
}
```

Components fetch player data via: `ratingsSnapshot[playerName]`

## Implementation Status

### ✅ Completed

#### 1. PlayerManager Snapshot Calculation (playerManager.js)

**Added method `#calculateRatingsSnapshot()`** (lines 754-843):

- Takes players object, rankings, previousYearRankings, and avatars
- Calculates anchors from current player pool (available + waiting)
- For each player, reconstructs their pre-session ratings using existing logic:
    - Try current year rankings, find last detail before session date
    - If no detail or not in current year, fall back to previous year
    - Calculate provisional ELO if games < 35
- Returns snapshot object keyed by player name

**Updated `executeTransaction()`** (lines 532-562):

- Detects if players or teams changed
- If changed, loads rankings and avatars
- Calls `#calculateRatingsSnapshot()` with new player pool
- Adds snapshot to atomic save operations
- Snapshot is recalculated on ANY player operation (add/remove/move/assign)

**Key implementation details:**

- Uses same anchor calculation logic as before (`#calculateProvisionalAnchors()`)
- Uses same detail lookup logic (last detail before session date)
- Includes both current and previous year rankings for year boundary handling
- Atomic save via `data.setMany()` ensures consistency

### 🚧 Pending Implementation

#### 2. Migration Script

Create `scripts/migrate-session-snapshots.js`:

```javascript
// Pseudocode structure:
import { readdirSync, readFileSync } from 'fs';
import { createPlayerManager } from '$lib/server/playerManager.js';
import { createRankingsManager } from '$lib/server/rankings.js';
import { createAvatarManager } from '$lib/server/avatarManager.js';
import { data } from '$lib/server/data.js';

async function migrateLeague(leagueId) {
    const dataDir = `data/${leagueId}`;
    const sessionFiles = readdirSync(dataDir).filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));

    for (const file of sessionFiles) {
        const date = file.replace('.json', '');
        const sessionData = await data.get(null, date, leagueId); // Get full session

        // Skip if already has snapshot or no players
        if (sessionData.ratingsSnapshot || !sessionData.players) continue;

        const year = new Date(date).getFullYear();
        const previousYear = year - 1;

        // Load rankings and avatars
        const rankingsManager = createRankingsManager().setLeague(leagueId);
        const avatarManager = createAvatarManager().setLeague(leagueId);

        const [rankings, previousYearRankings, avatars] = await Promise.all([
            rankingsManager.loadEnhancedRankings(year, { fallbackToPreviousYear: true }),
            rankingsManager.loadEnhancedRankings(previousYear),
            avatarManager.getAvatarData()
        ]);

        // Use playerManager's snapshot calculation
        const manager = createPlayerManager().setDate(date).setLeague(leagueId);
        const snapshot = await manager.#calculateRatingsSnapshot(
            sessionData.players,
            rankings,
            previousYearRankings,
            avatars
        );

        // Save snapshot to session
        await data.set('ratingsSnapshot', date, snapshot, {}, true, leagueId);

        console.log(`Migrated ${leagueId}/${date}`);
    }
}

// Run for all leagues
async function migrateAll() {
    const leagues = readdirSync('data').filter((d) => !d.includes('.'));
    for (const league of leagues) {
        await migrateLeague(league);
    }
}
```

**Notes:**

- The `#calculateRatingsSnapshot()` method is private, so migration script needs access
- Options:
    1. Make it public temporarily for migration
    2. Export a separate `calculateSnapshotForMigration()` function
    3. Run migration logic inline (duplicating the calculation)

**Recommended:** Add a public method `calculateAndSaveSnapshot()` to PlayerManager that can be used by migration script.

#### 3. Update Team Generator

**File:** `src/lib/server/teamGenerator.js`

**Changes needed:**

1. Add `ratingsSnapshot` property (✅ already added line 29)
2. Add `setRatingsSnapshot()` method (✅ already added lines 76-84)

3. **Update `getProvisionalPlayerData()`** (lines 170-205):

    ```javascript
    getProvisionalPlayerData(playerName, anchors) {
      // Use snapshot as ONLY source (remove rankings fallback)
      const snapshot = this.ratingsSnapshot?.[playerName];
      if (!snapshot) {
        throw new TeamError(`Player ${playerName} not found in ratings snapshot`, 500);
      }

      // Get appearances from rankings for historical context
      let playerData = this.rankings?.players?.[playerName];
      if (!playerData && this.previousYearRankings?.players?.[playerName]) {
        playerData = this.previousYearRankings.players[playerName];
      }
      const appearances = playerData?.appearances ?? 0;

      return {
        name: playerName,
        elo: snapshot.elo,
        actualElo: snapshot.actualElo,
        isProvisional: snapshot.isProvisional,
        attackingRating: snapshot.attackingRating,
        controlRating: snapshot.controlRating,
        avatar: snapshot.avatar,
        appearances
      };
    }
    ```

4. **Update `initialPots` structure** to store player names only (lines 328-335, 1103-1106):

    ```javascript
    // Random teams (line 328):
    this.initialPots = [
        {
            name: 'All Players',
            players: this.players // Just names, not objects
        }
    ];

    // Seeded teams (line 1103):
    this.initialPots.push({
        name: `Pot ${potNumber}`,
        players: potPlayers // Just names from sortedPlayers array
    });
    ```

5. **Remove unused methods** after migration:
    - Keep `calculateProvisionalRating()` as it's still used for team generation logic
    - Remove `#calculateProvisionalAnchors()` (no longer needed - snapshot has pre-calculated values)
    - Actually keep anchors for now - might still be needed for established player sorting

#### 4. Update Teams API

**File:** `src/routes/api/teams/+server.js`

**Changes needed:**

1. **Load snapshot from session data** (add after line 117):

    ```javascript
    const ratingsSnapshot = await data.get('ratingsSnapshot', dateValidation.date, leagueId);
    ```

2. **Pass snapshot to team generator** (around line 175):

    ```javascript
    const teamGenerator = createTeamGenerator()
        .setSettings(gameData.settings)
        .setPlayers(eligiblePlayers)
        .setRankings(rankings)
        .setPreviousYearRankings(previousYearRankings)
        .setRatingsSnapshot(ratingsSnapshot) // NEW
        .setTeammateHistory(teammateHistory)
        .setHistoryRecording(true);
    ```

3. **Return snapshot in response** (around line 220):

    ```javascript
    return json({
        teams: enhancedData.teams,
        players: enhancedData.players,
        ratingsSnapshot: ratingsSnapshot, // NEW
        drawHistory: teams.drawHistory
    });
    ```

4. **Remove `#enhancePlayersWithEloAndAvatar()` logic** from playerManager.js (lines 777-900+):
    - This entire method becomes obsolete
    - Teams API should no longer call `getEnhancedTeamsAndPlayers()`
    - Instead, pass snapshot directly to frontend

5. **Simplify response structure**:
    ```javascript
    // Instead of enhancing, just return raw data + snapshot
    return json({
        teams: gameData.teams,
        players: gameData.players,
        ratingsSnapshot: ratingsSnapshot,
        drawHistory: drawHistory
    });
    ```

#### 5. Update DrawReplay Component

**File:** `src/routes/teams/components/DrawReplay.svelte`

**Changes needed:**

1. **Accept ratingsSnapshot prop** (line 26):

    ```javascript
    let { drawHistory, ratingsSnapshot, open = $bindable(false) } = $props();
    ```

2. **Update helper functions** to use snapshot lookup (lines 96-120):

    ```javascript
    function getPlayerElo(playerName) {
        return ratingsSnapshot?.[playerName]?.elo ?? null;
    }

    function getPlayerAvatar(playerName) {
        return ratingsSnapshot?.[playerName]?.avatar ?? null;
    }

    function getPlayerIsProvisional(playerName) {
        return ratingsSnapshot?.[playerName]?.isProvisional ?? false;
    }

    function getPlayerActualElo(playerName) {
        return ratingsSnapshot?.[playerName]?.actualElo ?? null;
    }
    ```

3. **Update pot rendering** (lines 546-572):

    ```javascript
    {#snippet potDisplay(potName, players)}
      <div class="pot min-w-0 flex-1">
        <Listgroup class="shadow-lg">
          <ListgroupItem>
            {potName}
          </ListgroupItem>
          {#each players as playerName (playerName)}
            {@const playerData = ratingsSnapshot[playerName]}
            {@const elo = playerData?.elo}
            {@const isProvisional = playerData?.isProvisional}
            {@const actualElo = playerData?.actualElo}
            <ListgroupItem class={...}>
              <div class="flex w-full items-center justify-between">
                <div class="mr-1 flex-1 overflow-hidden">
                  {playerName}
                </div>
                {#if elo !== null && showPlayerRankings}
                  <div class="text-xs" class:italic={isProvisional}
                       title={isProvisional ? `Provisional (actual: ${actualElo})` : ''}>
                    {#if isProvisional}~{/if}{elo}
                  </div>
                {/if}
              </div>
            </ListgroupItem>
          {/each}
        </Listgroup>
      </div>
    {/snippet}
    ```

4. **Update teams rendering** (lines 656-668):
    ```javascript
    {#each Object.entries(currentTeamsWithRankings) as [teamName, teamData], i (i)}
      {@const teamPlayers = teamData.players.map(name =>
        name ? {
          name,
          ...ratingsSnapshot[name]
        } : null
      )}
      <TeamTable
        team={teamPlayers}
        {teamName}
        color={teamName.split(' ')[0].toLowerCase()}
        canModifyList={false}
        size="sm"
        {showPlayerRankings}
        showTeamRatings={false} />
    {/each}
    ```

#### 6. Update Parent Component

**File:** `src/routes/teams/+page.svelte`

**Changes needed:**

1. **Pass ratingsSnapshot to DrawReplay**:
    ```javascript
    <DrawReplay
        drawHistory={teamsData?.drawHistory}
        ratingsSnapshot={teamsData?.ratingsSnapshot}
        bind:open={showDrawReplay}
    />
    ```

#### 7. Update TeamTable Component

**File:** `src/routes/teams/components/TeamTable.svelte`

**Current usage** (lines 56-63, 87-94, 103-110):

- Already expects `player` objects with `elo`, `attackingRating`, `controlRating`, `isProvisional`, `actualElo`
- No changes needed if we continue passing enriched player objects

**Potential simplification:**

- Could pass `ratingsSnapshot` as prop and look up on render
- But current approach is fine - keeps component simple

#### 8. Update TeamsGrid Component

**File:** `src/routes/teams/components/TeamsGrid.svelte`

- Passes through to TeamTable
- No changes needed

### Cleanup After Migration

**Remove from playerManager.js:**

- `#calculateProvisionalAnchors()` method (lines 660-743) - only needed for snapshot calculation, which is now done
- `#enhancePlayersWithEloAndAvatar()` method (lines 777-900+) - replaced by snapshot
- `getEnhancedTeamsAndPlayers()` method - no longer called by API

**Remove from teamGenerator.js:**

- Legacy reconstruction logic from `getProvisionalPlayerData()` (keep only snapshot path)
- Possibly `#calculateProvisionalAnchors()` if not needed for team generation balance calculations

**Actually, keep anchor calculation in teamGenerator:**

- Still needed for sorting established players during seeded team generation
- The snapshot already has provisional values calculated, but generator needs to know who's established for balancing

## Testing Plan

### Before Migration

1. ✅ Verify snapshot calculation works for new player registrations
2. ✅ Test that snapshot updates when player pool changes (add/remove/move)
3. ✅ Verify provisional ratings recalculate when anchor changes

### Migration Testing

1. **Backup data directory** before running migration
2. Run migration on test league first
3. Verify all session files now have `ratingsSnapshot` field
4. Spot-check snapshot values match expected ratings for known sessions
5. Compare pre/post migration displays for several historical sessions

### Post-Migration Testing

1. Verify DrawReplay displays correctly for historical sessions
2. Verify teams page shows correct ratings for historical sessions
3. Test new player registration creates snapshot
4. Test player removal updates snapshot
5. Test provisional ratings display correctly
6. Verify year boundary handling (Dec/Jan sessions)

### Regression Testing

1. Team generation produces same balance as before
2. Draw history playback works correctly
3. Player rankings display correctly
4. No performance regressions on teams API

## Migration Execution Steps

1. **Create migration script** (`scripts/migrate-session-snapshots.js`)
2. **Add public snapshot method** to playerManager for migration use
3. **Backup production data**: `cp -r data data-backup-$(date +%Y%m%d)`
4. **Run migration locally first** on test data
5. **Verify migration results** manually
6. **Run migration on production** data
7. **Commit migrated data** to version control
8. **Deploy code changes** (updated components/APIs)
9. **Verify production** displays correctly
10. **Remove deprecated code** in follow-up PR

## Benefits After Completion

1. **Consistent historical display**: Teams always show ratings as they were at draw time
2. **Simpler codebase**: No reconstruction logic, no fallbacks, single source of truth
3. **Better performance**: No need to load and parse ranking details for display
4. **Easier debugging**: Snapshot is visible in session data, no complex reconstruction to trace
5. **Reliable year boundaries**: No special handling needed, snapshot already has correct values
6. **Maintainability**: Changes to ranking calculation don't affect historical displays

## Notes and Considerations

### Performance

- Snapshot recalculation happens on every player operation
- Requires loading rankings and avatars each time
- Could add caching in playerManager to avoid repeated loads within same request
- Not a concern for current usage patterns (1-2 player ops per request)

### Data Size

- Adds ~100-200 bytes per player to session file
- For 24 players: ~2-5 KB per session
- Negligible compared to current session size

### Breaking Changes

- Old session data without snapshot will fail to display after code cleanup
- **Must run migration before deploying code changes**
- Consider adding validation/warning if snapshot missing

### Future Enhancements

- Could snapshot team balancing metadata (pot assignments, teammate history scores)
- Could snapshot game predictions based on team ratings
- Could track snapshot version for future schema changes

## Related Files

- `/home/veli/projects/leagr/src/lib/server/playerManager.js` (snapshot calculation)
- `/home/veli/projects/leagr/src/lib/server/teamGenerator.js` (draw history generation)
- `/home/veli/projects/leagr/src/routes/api/teams/+server.js` (teams API)
- `/home/veli/projects/leagr/src/routes/teams/components/DrawReplay.svelte` (draw playback)
- `/home/veli/projects/leagr/src/routes/teams/components/TeamTable.svelte` (team display)

## References

- Previous implementation attempts with fallback logic (abandoned)
- Year boundary ELO carry-over fix (January 2026)
- Provisional rating anchor calculation issues (January 2026)

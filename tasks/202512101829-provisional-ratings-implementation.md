# Provisional Player Ratings Implementation

**Last Updated:** 2025-12-14

## Update: Games-Based Threshold (2025-12-14)

**Migration from sessions to games played:**

Changed provisional rating threshold from **5 sessions** to **35 games played**. This change:

1. **Simplifies implementation**: Uses `elo.gamesPlayed` directly instead of counting `appearances`
2. **Improves normalization logic**: Replaced 7-line session-counting loop with direct property lookup (`detail.eloGames`)
3. **More accurate trust metric**: Based on actual skill observations (games) rather than session attendance
4. **Self-adjusting fairness**: Players who perform well in cup competitions (more games per session) earn trust faster
5. **Preserves trust across year boundaries**: `elo.gamesPlayed` is carried over with ELO ratings during yearly reset

**Rationale:**

- Average session = ~7 games (league + potential cup games)
- 35 games ≈ 5 sessions worth of data
- Threshold remains static, but trust journey persists across year boundaries via ELO carry-over

**Files affected:**

- `src/lib/server/teamGenerator.js` - Updated `GAMES_THRESHOLD = 35`
- `src/lib/server/playerManager.js` - Updated to use `elo.gamesPlayed`
- `src/lib/server/rankings.js` - Updated `MIN_GAMES_FOR_NORMALIZATION_POOL = 35`
- `test/lib/server/teamGenerator.test.js` - Updated mock data and test expectations

---

## Overview

Implemented provisional ratings for new players (<35 games played) that pessimistically start at 99% of the weakest established player's rating and gradually pull toward actual ratings as they gain experience. This ensures trusted players maintain their rightful pot positions while new players are conservatively placed.

## Key Changes

### 1. Rankings Storage (`src/lib/server/rankings.js`)

- Removed the session threshold that prevented attack/control rating calculation
- All players now get ratings calculated from their first game
- Ratings are normalized against the established players' bounds (35+ games)
- New players' ratings are clamped to [0, 1] range
- **Simplified normalization**: Uses `detail.eloGames` property directly instead of counting sessions

### 2. Team Generator (`src/lib/server/teamGenerator.js`)

**New provisional rating system:**

- Added `GAMES_THRESHOLD = 35` constant (~5 sessions worth of games)
- `calculateProvisionalAnchors()` - Uses weakest established player's rating × 0.99 as anchor
- `calculateProvisionalRating()` - Linear interpolation from anchor to actual based on `gamesPlayed`
- `getProvisionalPlayerData()` - Returns player object with provisional ratings and `isProvisional` flag

**Two-pass sorting in `generateSeededTeams()`:**

1. First pass: Sort only established players (35+ games) by actual ELO
2. Calculate anchor values from weakest established player
3. Second pass: Calculate provisional ratings for all players, then sort

**Updated balance methods to use provisional ratings:**

- `calculateTeamEloAverages()` - Uses provisional ELO based on games played
- `calculateTeamRatingAverages()` - Uses provisional attack/control based on games played
- `calculateEloSpreadBalance()` - Uses provisional ELO based on games played

**Updated `initialPots` structure:**

```javascript
{
    name: string,
    elo: number,           // Provisional ELO (for display/balancing)
    actualElo: number,     // True ELO (for transparency)
    isProvisional: boolean,
    attackingRating: number,
    controlRating: number,
    avatar: string|null,
    appearances: number
}
```

### 3. Player Manager (`src/lib/server/playerManager.js`)

- Added `#calculateProvisionalRating()` and `#calculateProvisionalAnchors()` methods
- `#enhancePlayersWithEloAndAvatar()` now returns provisional ratings for consistency with team generation
- Returns both `elo` (provisional) and `actualElo` for transparency
- Extracts `eloGames` from `rankingDetail` for accurate games played count

### 4. Front-end Display

**TeamTable.svelte:**

- Shows `~` prefix for provisional ratings
- Italic styling for provisional players
- Tooltip shows "(X/35 games)"

**DrawReplay.svelte:**

- Shows `~` prefix for provisional ratings in pots
- Italic styling
- Tooltip shows actual ELO for transparency

## Provisional Rating Formula

```javascript
if (gamesPlayed >= 35) return actualRating;
const anchor = weakestEstablishedRating * 0.99;
const pullFactor = gamesPlayed / 35;
return anchor + (actualRating - anchor) * pullFactor;
```

**Example: New player's journey to established status**

Setup:

- Weakest established player: 900 ELO
- Anchor: 900 × 0.99 = 891
- New player's actual ELO: 1100

| Games Played | Pull Factor  | Calculation              | Provisional ELO |
| ------------ | ------------ | ------------------------ | --------------- |
| 0            | 0/35 = 0.00  | 891 + (1100 - 891) × 0.0 | **891**         |
| 7            | 7/35 = 0.20  | 891 + (1100 - 891) × 0.2 | **933**         |
| 14           | 14/35 = 0.40 | 891 + (1100 - 891) × 0.4 | **975**         |
| 21           | 21/35 = 0.60 | 891 + (1100 - 891) × 0.6 | **1016**        |
| 28           | 28/35 = 0.80 | 891 + (1100 - 891) × 0.8 | **1058**        |
| 35+          | —            | Uses actual rating       | **1100**        |

The player starts conservatively at 891 (below the weakest trusted player) and gradually earns their way to their true 1100 rating over 35 games (~5 sessions).

## Fallback Hierarchy

1. **Has established players** → Use weakest established × 0.99
2. **No established players (new league)** → Use defaults (ELO: 1000, attack/control: 0.5)

## Files Modified

| File                                            | Changes                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `src/lib/server/rankings.js`                    | Removed 5-session threshold for rating storage                     |
| `src/lib/server/teamGenerator.js`               | Added provisional methods, two-pass sorting, updated balance calcs |
| `src/lib/server/playerManager.js`               | Added provisional calculation to player enrichment                 |
| `src/routes/teams/components/TeamTable.svelte`  | Visual indicator (tilde + italic)                                  |
| `src/routes/teams/components/DrawReplay.svelte` | Visual indicator with actual ELO tooltip                           |
| `test/lib/server/teamGenerator.test.js`         | Updated test for new provisional behavior                          |

## Testing

All 529 backend tests pass (as of 2025-12-14). Tests were updated to:

- Add `gamesPlayed` field to mock ELO data
- Update comments and expectations to reflect games-based threshold
- Verify provisional rating calculations use games instead of sessions

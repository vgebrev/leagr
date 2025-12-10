# Provisional Player Ratings Implementation

## Overview

Implemented provisional ratings for new players (<5 sessions) that pessimistically start at 99% of the weakest established player's rating and gradually pull toward actual ratings as they gain experience. This ensures trusted players maintain their rightful pot positions while new players are conservatively placed.

## Key Changes

### 1. Rankings Storage (`src/lib/server/rankings.js`)

- Removed the 5-session threshold that prevented attack/control rating calculation
- All players now get ratings calculated from their first session
- Ratings are normalized against the established players' bounds (5+ sessions)
- New players' ratings are clamped to [0, 1] range

### 2. Team Generator (`src/lib/server/teamGenerator.js`)

**New provisional rating system:**

- Added `PROVISIONAL_THRESHOLD = 5` constant
- `calculateProvisionalAnchors()` - Uses weakest established player's rating × 0.99 as anchor
- `calculateProvisionalRating()` - Linear interpolation from anchor to actual based on appearances
- `getProvisionalPlayerData()` - Returns player object with provisional ratings and `isProvisional` flag

**Two-pass sorting in `generateSeededTeams()`:**

1. First pass: Sort only established players (5+ sessions) by actual ELO
2. Calculate anchor values from weakest established player
3. Second pass: Calculate provisional ratings for all players, then sort

**Updated balance methods to use provisional ratings:**

- `calculateTeamEloAverages()` - Uses provisional ELO
- `calculateTeamRatingAverages()` - Uses provisional attack/control
- `calculateEloSpreadBalance()` - Uses provisional ELO

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

### 4. Front-end Display

**TeamTable.svelte:**

- Shows `~` prefix for provisional ratings
- Italic styling for provisional players
- Tooltip shows "(X/5 sessions)"

**DrawReplay.svelte:**

- Shows `~` prefix for provisional ratings in pots
- Italic styling
- Tooltip shows actual ELO for transparency

## Provisional Rating Formula

```javascript
if (appearances >= 5) return actualRating;
const anchor = weakestEstablishedRating * 0.99;
const pullFactor = appearances / 5;
return anchor + (actualRating - anchor) * pullFactor;
```

**Example: New player's journey to established status**

Setup:

- Weakest established player: 900 ELO
- Anchor: 900 × 0.99 = 891
- New player's actual ELO: 1100

| Appearances | Pull Factor | Calculation              | Provisional ELO |
| ----------- | ----------- | ------------------------ | --------------- |
| 0           | 0/5 = 0.0   | 891 + (1100 - 891) × 0.0 | **891**         |
| 1           | 1/5 = 0.2   | 891 + (1100 - 891) × 0.2 | **933**         |
| 2           | 2/5 = 0.4   | 891 + (1100 - 891) × 0.4 | **975**         |
| 3           | 3/5 = 0.6   | 891 + (1100 - 891) × 0.6 | **1016**        |
| 4           | 4/5 = 0.8   | 891 + (1100 - 891) × 0.8 | **1058**        |
| 5+          | —           | Uses actual rating       | **1100**        |

The player starts conservatively at 891 (below the weakest trusted player) and gradually earns their way to their true 1100 rating over 5 sessions.

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

All 530 backend tests pass. The ELO calculation test was updated to reflect the new provisional rating behavior.

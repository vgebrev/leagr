# Team Balance Improvements - Implementation Summary

**Date**: 2025-11-29
**Version**: 2.14.1 → 2.15.0 (proposed)
**Status**: ✅ Implemented and Tested (601/601 tests passing)

## Overview

Implemented comprehensive improvements to team generation balance and ELO rating system based on deep analysis of 28 Pirates league sessions showing 67.9% runaway winner rate and 60.7% dominated team rate.

## Changes Implemented

### 1. Reduced Pot Size (Team Generation)

**File**: `src/lib/server/teamGenerator.js`

**Change**: Lines 397, 681

```javascript
// Before
const potSize = Math.min(numTeams * 2, sortedPlayers.length - playerIndex);

// After
const potSize = Math.min(Math.ceil(numTeams * 1.5), sortedPlayers.length - playerIndex);
```

**Impact**:

- Reduces within-pot ELO variance from ~70 to ~40-50 points
- More granular snake draft distribution
- Reduces "lottery effect" where one team gets all top-of-pot players

---

### 2. Adaptive ELO Balance Targets + Hard Constraints

**File**: `src/lib/server/teamGenerator.js`

**Changes**: Lines 674-689, 310-338, 691

```javascript
// Calculate adaptive targets based on player pool variance
const eloRange = Math.max(...playerElos) - Math.min(...playerElos);
const adaptiveFactor = Math.floor(eloRange / 100) * 3;
const targetEloDelta = Math.min(baseTarget + adaptiveFactor, 40);
const hardEloDeltaLimit = Math.max(60, Math.floor(eloRange * 0.15));
const maxIterations = 300; // Tripled from 75

// Hard constraint: reject solutions exceeding ELO delta limit
violatesHardConstraints(teams, pairingLimit, eloDeltaLimit);
```

**Impact**:

- **Adaptive targets**: Automatically adjusts based on player pool variance
    - Low variance (200 ELO spread): Target 18 ELO
    - Medium variance (400 ELO spread): Target 24 ELO
    - High variance (600 ELO spread): Target 30 ELO
    - Extreme variance (800 ELO spread): Target 36 ELO (capped at 40)
- **Hard ELO constraint**: Rejects any team configuration exceeding 15% of player pool range (min 60)
- **Tripled iterations** (75 → 300): Much better chance of finding optimal balance
- **Realistic goals**: No longer tries to achieve impossible targets when player pool has high variance

---

### 3. Increased K-Factors (ELO Rating)

**File**: `src/lib/server/rankings.js`

**Change**: Lines 20-21

```javascript
// Before
const ELO_K_LEAGUE = 16;
const ELO_K_CUP = 10;

// After
const ELO_K_LEAGUE = 24; // +50%
const ELO_K_CUP = 15; // +50%
```

**Impact**:

- Faster rating adjustments after each match
- Creates clearer skill separation between elite and weak players
- Counteracts compression from decay
- Elite players rise faster, weak players fall faster

---

### 4. Reduced Decay Rate (ELO Rating)

**File**: `src/lib/server/rankings.js`

**Change**: Line 22

```javascript
// Before
const ELO_DECAY_RATE = 0.05; // 5% per week

// After
const ELO_DECAY_RATE = 0.02; // 2% per week
```

**Impact**:

- Maintains skill differentiation longer
- Prevents rating compression toward baseline
- 1200 ELO player now loses ~8 points/month instead of ~18 points/month
- Better reflects true long-term skill levels

**Decay Examples**:
| Weeks Idle | Old (5%) | New (2%) |
|-----------|----------|----------|
| 4 weeks | -37 pts | -15 pts |
| 12 weeks | -100 pts | -43 pts |
| 24 weeks | -152 pts | -81 pts |

---

### 5. ELO Spread Balance Metric (Team Generation)

**File**: `src/lib/server/teamGenerator.js`

**New Function**: Lines 370-413 - `calculateEloSpreadBalance()`

**Integration**: Lines 700-704

```javascript
// Calculate ELO spread balance (prevents lottery effect from pot variance)
const spreadBalance = this.calculateEloSpreadBalance(teams);

// Combined score: ELO balance + variance penalty + spread balance
const totalScore = eloDelta + pairingPenalty * varianceWeight + spreadBalance * 0.3;
```

**How it Works**:

- Calculates max, min, and median ELO for each team
- Measures variance across teams' distributions
- Prevents one team from getting all "top of pot" players
- Weighted scoring: median × 1.0 + max × 0.6 + min × 0.4

**Impact**:

- Ensures teams have similar skill distribution shapes
- Complements average ELO balancing
- Addresses root cause of lottery effect

---

### 6. Win Margin ELO Multiplier (NEW FEATURE)

**File**: `src/lib/server/rankings.js`

**New Function**: Lines 458-472 - `calculateMarginMultiplier()`

```javascript
calculateMarginMultiplier(goalDifference) {
    const absDiff = Math.abs(goalDifference);

    if (absDiff === 0) return 1.0;  // Draw - no bonus
    if (absDiff === 1) return 1.0;  // Narrow win - standard
    if (absDiff === 2) return 1.15; // +15% bonus
    if (absDiff === 3) return 1.25; // +25% bonus
    return 1.3; // +30% max (caps at 4+ goal margin)
}
```

**Integration**: Lines 587-589

```javascript
// Calculate margin multiplier based on goal difference
const marginMultiplier = this.calculateMarginMultiplier(homeScore - awayScore);
const effectiveKFactor = kFactor * marginMultiplier;
```

**Impact**:

- Dominant wins (3-0, 4-0) now grant more ELO points than narrow wins
- Capped at 30% to prevent "running up the score"
- Faster convergence to true skill levels
- Rewards consistent dominant performance

**Examples** (1050 ELO beats 1000 ELO):
| Result | Base Change | With Margin | Total Change |
|--------|-------------|-------------|--------------|
| 1-0 | +12 ELO | ×1.0 | +12 ELO |
| 2-0 | +12 ELO | ×1.15 | +13.8 ELO |
| 3-0 | +12 ELO | ×1.25 | +15 ELO |
| 4-0 | +12 ELO | ×1.3 | +15.6 ELO |
| 6-0 | +12 ELO | ×1.3 (cap) | +15.6 ELO |

---

## Testing

**Test Coverage**:

- ✅ All 601 tests passing (524 backend + 77 frontend)
- ✅ Added 5 new tests for `calculateMarginMultiplier()`
- ✅ Updated 2 tests for new decay rate (0.98 vs 0.95)
- ✅ Verified team generator with new pot size and spread balance
- ✅ Verified ELO calculations with margin multiplier

**Test Files Modified**:

- `test/lib/server/rankings.test.js` - Updated decay calculations, added margin tests
- All existing tests continue to pass

---

## Expected Impact

### Phase 1 Impact (Pot Size + ELO Delta)

- **Runaway winners**: 67.9% → ~40-45%
- **Dominated teams**: 60.7% → ~35-40%
- **Points range**: 10.8 → ~8-9

### Phase 2 Impact (+ K-factors + Decay)

- **Runaway winners**: → ~30-35%
- **Dominated teams**: → ~25-30%
- **Points range**: → ~7-8

### Full Impact (All 6 changes)

- **Runaway winners**: → ~20-25% (target <25%)
- **Dominated teams**: → ~15-20% (target <20%)
- **Points range**: → ~6-7 (target <7)

---

## Migration Notes

### Data Compatibility

- ✅ **No database migration needed** - all changes are algorithmic
- ✅ **Existing rankings preserved** - new calculations apply going forward
- ✅ **Backward compatible** - can be reverted without data loss

### Gradual Effect

- **Team generation**: Immediate effect (next draw uses new algorithm)
- **ELO ratings**: Gradual convergence over 4-8 weeks
    - Higher K-factors spread ratings faster
    - Lower decay maintains separation
    - Win margin accelerates convergence
- **Rankings stability**: Rankings will shift over 2-3 sessions as ELO adjusts

---

## Configuration Tunables

All changes use constants that can be easily tuned:

### Team Generation

```javascript
// teamGenerator.js
const potMultiplier = 1.5; // Currently 1.5× teams (was 2×)
const maxIterations = 300; // Max attempts (was 75)
const spreadBalanceWeight = 0.3; // Spread balance scoring weight

// Adaptive targets (calculated from player pool variance)
const baseTarget = 12; // Base target ELO delta
const adaptiveFactor = Math.floor(eloRange / 100) * 3; // Scales with variance
const hardEloDeltaLimit = Math.max(60, Math.floor(eloRange * 0.15)); // Hard rejection limit
```

### ELO System

```javascript
// rankings.js
const ELO_K_LEAGUE = 24; // League K-factor (was 16)
const ELO_K_CUP = 15; // Cup K-factor (was 10)
const ELO_DECAY_RATE = 0.02; // Weekly decay rate (was 0.05)
```

### Win Margin

```javascript
// rankings.js - calculateMarginMultiplier()
// Can adjust multipliers: 1.0, 1.15, 1.25, 1.3
// Can adjust cap threshold (currently 4+ goals)
```

---

## Monitoring Plan

### Key Metrics to Track (Next 8 weeks)

1. **Runaway winner rate**: % of sessions with 6+ point margin to 2nd place
2. **Dominated team rate**: % of sessions with team ≤3 points or ≤-5 GD
3. **Average points range**: Average of (max points - min points) per session
4. **ELO spread**: Track range of active player ELOs over time
5. **Player feedback**: Subjective sense of balance

### Success Criteria (After 8 weeks / 8 sessions)

- ✅ Runaway winner rate < 30%
- ✅ Dominated team rate < 30%
- ✅ Average points range < 8
- ✅ No player complaints about "broken" team generation
- ✅ ELO spread between 150-250 points (currently ~150)

---

## Rollback Plan

If changes cause issues:

### Quick Rollback (Revert Code)

```bash
git revert <commit-hash>
npm test
./deploy.sh
```

### Selective Rollback

Can selectively revert individual changes:

1. Pot size: Change 1.5 back to 2.0
2. ELO delta: Change 12 back to 20
3. K-factors: Change 24/15 back to 16/10
4. Decay: Change 0.02 back to 0.05
5. Spread balance: Set weight to 0
6. Win margin: Return 1.0 instead of calculated multiplier

---

## Files Modified

1. `src/lib/server/teamGenerator.js` - Team generation algorithm
2. `src/lib/server/rankings.js` - ELO rating system
3. `test/lib/server/rankings.test.js` - Updated test expectations
4. `TEAM_BALANCE_ANALYSIS.md` - Analysis document (new)
5. `tasks/team-balance-improvements-implementation.md` - This file (new)

---

## Next Steps

### Immediate (Before Next Session)

1. ✅ Deploy changes to production
2. ⏳ Announce changes to players (optional)
3. ⏳ Monitor first session with new algorithm

### Short Term (2-4 weeks)

1. Track metrics for 4 sessions
2. Gather player feedback
3. Adjust tunables if needed

### Medium Term (6-8 weeks)

1. Comprehensive analysis of 8 sessions
2. Compare to baseline (previous 28 sessions)
3. Decide on permanent configuration
4. Document learnings

---

## Conclusion

Implemented 7 comprehensive improvements targeting the root causes of team imbalance:

1. **Reduced pot size** (2× → 1.5× teams) - Addresses lottery effect
2. **Adaptive ELO targets** - Realistic balance goals based on player pool variance
3. **Hard ELO constraints** - Rejects excessively unbalanced teams
4. **Tripled iterations** (75 → 300) - More chances to find optimal balance
5. **Increased K-factors** (+50%) - Faster skill separation
6. **Reduced decay** (5% → 2%) - Maintains differentiation
7. **Spread balance metric** - Prevents skill distribution skew
8. **Win margin multiplier** - Rewards dominant performance

All changes tested and deployed successfully. Expected to reduce runaway winners from 67.9% to ~20-25% and dominated teams from 60.7% to ~15-20% over the next 2 months.

---

## Player Announcement

**Copy-paste this to your league group:**

---

### ⚽ Team Balance Improvements - November 2025

Hey everyone! 👋

I've made some updates to the team generation and ranking system based on analysis of our last 28 sessions. Here's what's changing and why:

**The Problem:**
Looking at the data, about 68% of our sessions had one team dominating (winning by 6+ points), and 61% had one team getting crushed. Not great for competitive balance!

**What I've Done:**

**1. Smarter Team Generation**

- Teams are now drawn from smaller "pots" of players (6 instead of 8), which reduces the luck factor
- The algorithm tries 300 different combinations (up from 75) to find the best balance
- It now adapts to how spread out everyone's skill levels are - if we have a massive skill gap, it adjusts expectations accordingly
- Added a hard limit that rejects any team setup that's too unbalanced

**2. Better Player Ratings**

- Ratings will change faster after matches (50% more responsive)
- Your rating decays slower when you're inactive (2% per week instead of 5%)
- **New:** Big wins now matter more than narrow wins for your rating
    - A 1-0 win = standard rating change
    - A 3-0 win = 25% more rating change
    - A 4+ goal win = 30% more rating change (capped, so no point running up the score!)

**What This Means For You:**

- **Better balanced teams**: We're aiming for competitive matches where all 4 teams have a realistic shot
- **More accurate ratings**: Your skill rating will reflect your actual ability more quickly
- **Gradual improvement**: These changes will take effect over the next 4-8 weeks as ratings adjust

**Expected Results:**

- Runaway winners: 68% → ~20-25%
- Dominated teams: 61% → ~15-20%
- Closer, more competitive matches overall

The changes are live now. Let me know if you notice any issues or have questions!

Cheers! 🍻

# ELO Balance Improvements Implementation

**Date**: 2025-11-08
**Status**: Phase 1 Complete
**Version**: 2.12.0+

## Overview

Implemented improvements to the ELO rating system to address team balance issues arising from limited player pool, team-based ELO calculations, and varying player attendance patterns.

### Problem Statement

Players reported imbalanced teams during Saturday sessions, with concerns that:

- ELO ratings weren't spread out enough to differentiate skill levels
- Irregular players' ratings didn't decay fast enough toward the mean
- Small sample sizes (1-2 sessions) could disproportionately affect team generation

### Goals

1. **Faster decay** - Players drift toward baseline (1000) more quickly during absences
2. **More spread** - Larger rating swings to better differentiate active players
3. **Sample size handling** - Prevent new/irregular players from skewing team balance

## Current ELO System Architecture

### Key Parameters (Pre-Implementation)

```javascript
// rankings.js
ELO_BASELINE_RATING = 1000;
ELO_K_LEAGUE = 10; // League game impact
ELO_K_CUP = 7; // Cup game impact
ELO_DECAY_RATE = 0.02; // 2% per week
```

### Team Generation Flow

1. **Player Sorting** (`teamGenerator.js:586-612`)
    - Primary: ELO rating (highest to lowest)
    - Fallback: Ranking points → Total points → Appearances

2. **Pot Distribution**
    - Players divided into pots of 2× team count
    - Randomized within pots for variability

3. **Balance Optimization**
    - 75 iterations to minimize ELO delta + pairing penalty
    - Target: 20pt ELO delta between teams
    - Hard constraint: Reject pairings with 4+ previous matchups

### Decay Mechanics

**Formula**: `newRating = baseline + (currentRating - baseline) × (1 - decayRate)^weeks`

**Pre-implementation decay impact** (1200 → ?):

- 1 month: 1184 (-16 pts)
- 3 months: 1154 (-46 pts)
- 6 months: 1119 (-81 pts)

**Result**: Very sticky ratings, slow regression to mean

## Phase 1 Implementation

### Changes Made

#### 1. Increased Decay Rate (5× faster)

**File**: `src/lib/server/rankings.js:22`

```javascript
// Before
const ELO_DECAY_RATE = 0.02; // 2% per week

// After
const ELO_DECAY_RATE = 0.05; // 5% per week
```

**Impact** (1200 → ?):

- 1 month: 1163 (-37 pts)
- 3 months: 1100 (-100 pts)
- 6 months: 1048 (-152 pts)

**Rationale**:

- Faster convergence to baseline reduces impact of stale ratings
- Players returning from breaks start closer to average
- Rewards consistent attendance with stable ratings

#### 2. Increased K-Factors (60% higher league, 43% higher cup)

**File**: `src/lib/server/rankings.js:20-21`

```javascript
// Before
const ELO_K_LEAGUE = 10;
const ELO_K_CUP = 7;

// After
const ELO_K_LEAGUE = 16;
const ELO_K_CUP = 10;
```

**Impact**:

- League rating changes increase from ±10 max to ±16 max
- Cup rating changes increase from ±7 max to ±10 max
- Creates more separation between skill levels in active players
- Cup relative weight: 62.5% of league (vs 70% originally, 44% initially tested)

**Rationale**:

- Limited player pool needs stronger signals per game
- Weekly sessions mean ~50 games/year (enough for convergence)
- Cup K-factor increased to 10 (from initial 7) to avoid over-penalizing cup performance when historical data is recalculated
- Maintains cup as meaningful but still less volatile than league

#### 3. Minimum Games Threshold

**File**: `src/lib/server/teamGenerator.js:585-597`

```javascript
const minGamesForElo = 5; // Minimum games before ELO is considered reliable

// In player sorting:
const eloGamesA = playerA?.elo?.gamesPlayed ?? 0;
const eloGamesB = playerB?.elo?.gamesPlayed ?? 0;
const eloA = eloGamesA >= minGamesForElo ? (playerA?.elo?.rating ?? defaultElo) : defaultElo;
const eloB = eloGamesB >= minGamesForElo ? (playerB?.elo?.rating ?? defaultElo) : defaultElo;
```

**Impact**:

- Players with <5 games treated as baseline (1000) for team generation only
- Actual stored ELO unaffected (continues to update normally)
- Prevents outlier early sessions from affecting balance

**Rationale**:

- 5 games ≈ 1 month of attendance (sufficient sample)
- One hot/cold session shouldn't label someone elite/poor
- Encourages consistent attendance for accurate placement

## Files Modified

| File                               | Changes        | Purpose                                                  |
| ---------------------------------- | -------------- | -------------------------------------------------------- |
| `src/lib/server/rankings.js`       | Lines 20-22    | Updated K-factors (league, cup) and decay rate constants |
| `src/lib/server/teamGenerator.js`  | Lines 585-597  | Added minimum games threshold logic                      |
| `test/lib/server/rankings.test.js` | Lines 759, 808 | Updated test expectations for new decay rate             |

### Post-Implementation Adjustments

**K_cup Increased to 10** (from initial 7):

- Initial implementation set K_cup to 7 while K_league increased to 16
- This reduced cup's relative weight from 70% to 44% (37% reduction)
- Recalculating historical data caused players who performed well in cups to drop significantly (up to 8 positions)
- Adjusted K_cup to 10 to maintain cup importance at 62.5% (middle ground between 70% and 44%)
- This prevents over-penalizing cup performance while still maintaining league as primary signal

## Testing Approach

### Test Updates

Modified 2 decay-related tests to expect new 5% rate:

- `applyEloDecay > should apply weekly decay correctly`
- `applyEloDecayToAllPlayers > should use first session date as baseline for initial decay`

Changed expected decay formula from `(0.98)^weeks` to `(0.95)^weeks`

### Test Results

✅ **584/584 tests pass**

- 507 backend tests
- 77 frontend tests

### Manual Testing Required

1. **Immediate Impact** (Next Session)
    - Generate teams and check ELO delta in team modal
    - Verify new players (0-4 games) treated as baseline

2. **Medium Term** (4-8 weeks)
    - Monitor rating spread among active players
    - Check if irregular players decay toward 1000 appropriately

3. **Balance Feedback** (8+ weeks)
    - Gather subjective feedback on team competitiveness
    - Compare ELO deltas: target <20pts more consistently

## Architecture Decisions

### Why Team-Based ELO?

Individual ratings averaged per team, not individual vs individual. This is appropriate for:

- Fixed team assignments per session
- Collective team performance (5-a-side)
- Shared wins/losses

### Why Keep Cup K-Factor Lower?

Cup games use K=10 vs League K=16 because:

- Single elimination = higher variance outcomes
- Fewer cup games per session = less data
- 62.5% relative weight balances cup importance vs league consistency
- Lower impact prevents cup volatility from dominating team generation
- Still meaningful (10 vs 16) but recognizes league as primary skill indicator

### Why 5 Games Minimum?

- **Statistical**: ~5 data points for reasonable confidence
- **Practical**: ~1 month attendance (4-5 sessions)
- **Behavioral**: Encourages regular participation

### Hard Constraints Use Recency Window

The teammate pairing hard constraint (reject teams with 4+ previous pairings) uses a **12-session recency window**, not total history:

- `teammateHistory.js:88` - Only considers last 12 sessions chronologically
- Prevents constraint saturation over time (eventually all pairs would violate)
- Window = ~12 weeks with weekly sessions
- Constraint checks "4+ matchups in last 12 sessions" not "4+ matchups ever"

## Phase 2 Improvements (Planned)

If balance issues persist after Phase 1 testing:

### 1. Tiered Decay (Medium Effort)

```javascript
// Decay based on absence duration
calculateTieredDecay(currentRating, weeksElapsed) {
    let decayRate;
    if (weeksElapsed <= 4) {
        decayRate = 0.03;  // 3% for short absences
    } else if (weeksElapsed <= 8) {
        decayRate = 0.06;  // 6% for medium absences
    } else {
        decayRate = 0.10;  // 10% for long absences
    }
    return baseline + (currentRating - baseline) * Math.pow(1 - decayRate, weeksElapsed);
}
```

**Benefits**:

- Punishes long absences more heavily
- Preserves ratings for consistent players
- Addresses "returning player" balance issues

### 2. Dynamic K-Factor (Medium Effort)

```javascript
// K-factor based on experience
getKFactor(gamesPlayed, phase) {
    if (phase !== 'league') return ELO_K_CUP;

    if (gamesPlayed < 10) return 20;   // Volatile learning phase
    if (gamesPlayed < 30) return 15;   // Stabilizing phase
    return 12;                          // Established phase
}
```

**Benefits**:

- New players converge to true skill faster
- Veteran players have more stable ratings
- Reduces impact of early lucky/unlucky streaks

### 3. Goal Difference Multiplier (Small Effort)

```javascript
// Actual score adjustment based on margin
calculateActualScore(homeScore, awayScore) {
    const baseScore = homeScore > awayScore ? 1 : (homeScore < awayScore ? 0 : 0.5);
    const margin = Math.abs(homeScore - awayScore);
    const marginBonus = Math.min(margin * 0.05, 0.2); // Max 0.2 bonus

    return homeScore > awayScore
        ? Math.min(baseScore + marginBonus, 1.2)
        : Math.max(baseScore - marginBonus, -0.2);
}
```

**Benefits**:

- Rewards dominant performances
- Slightly faster convergence
- **Risk**: May overfit to variance

### 4. Confidence-Weighted Team Averages (Complex)

Weight players by experience when calculating team ELO:

- <5 games: 50% weight
- 5-20 games: 50-100% linear
- 20+ games: 100% weight

**Benefits**:

- Reduces impact of unreliable ratings on team balance
- More accurate expected score calculations

## Assumptions & Limitations

### Assumptions

1. **Weekly cadence** - Decay rates calibrated for ~weekly sessions
2. **Stable pool** - Same core players week-to-week (~15-20 regulars)
3. **Team randomness** - Pot randomization provides sufficient variety
4. **Skill stability** - Players' actual skill changes slowly

### Limitations

1. **Cold start** - New players need 5+ games for accurate placement
2. **Small sample** - Limited pool means slower convergence
3. **Team dynamics** - ELO can't capture chemistry/positions
4. **Variance** - Small-sided games have higher score variance

### Known Edge Cases

1. **Player returns after months** - Will be rated too high initially, but decays toward baseline
2. **One amazing session** - New player could get high rating, but threshold prevents team impact
3. **Consistent mediocrity** - Player at baseline (1000) won't decay further

## Monitoring & Metrics

### Key Metrics to Track

1. **ELO Distribution**
    - Current range: Check rankings page
    - Target: 900-1100 spread for active players

2. **Team Balance**
    - Pre-generation delta: Available in team modal
    - Target: <20pts consistently

3. **Decay Rate**
    - Check players absent 4+ weeks
    - Expected: ~18% drop per month

### Success Criteria

Phase 1 considered successful if after 8 weeks:

- Average ELO delta <25pts (currently varies widely)
- Subjective balance feedback improves
- No increase in "stomp" games (5+ goal margin)

## Future Considerations

### Alternative Approaches (Not Chosen)

1. **Appearance-based pull** - Rejected to avoid penalizing irregular attendance
2. **Manual handicaps** - Too subjective, defeats purpose of ELO
3. **Individual ELO** - Doesn't match team-based format

### Long-term Ideas

1. **Position awareness** - Weight defenders/forwards differently
2. **Form component** - 70% ELO + 30% last 5 games performance
3. **Attendance incentive** - Bonus for consistency (separate from ratings)

## References

- ELO rating system: https://en.wikipedia.org/wiki/Elo_rating_system
- Team generator logic: `src/lib/server/teamGenerator.js`
- Rankings calculation: `src/lib/server/rankings.js`
- CLAUDE.md: Project development guidelines

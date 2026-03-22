# Enhanced Ratings & Player Profiles — Plan

**Created:** 2026-03-14
**Status:** Planning — revised after design review

---

## Overview

Two related improvements to make team generation smarter:

1. **Enhanced attack/control ratings** — incorporate individual stats (goals, offensive actions, defensive actions, saves) into the weighted composite ratings used for team balance, rather than relying solely on team-level goals for/against.

2. **Player traits & internal team balance** — assign each player a set of boolean traits (Finisher, Attacker, Defender, Shot Stopper) based on their normalised stat profile, then balance the distribution of those traits across teams. A player who is above-threshold in multiple areas (an "engine") simultaneously contributes to multiple trait pools — e.g. they fulfil the attack quota for one team's balance while also fulfilling the defence quota. A single display label is derived from the trait set for UI purposes, but the balance engine works directly on the raw traits.

---

## Current State Analysis

### Individual stats: stored but unused by rankings

Match data in session JSON files already contains:

- `homeScorers` / `awayScorers` — `Record<string, number>` player → goal count
- `homeOffensiveActions` / `awayOffensiveActions` — player → offensive action count
- `homeDefensiveActions` / `awayDefensiveActions` — player → defensive action count
- `homeSaveActions` / `awaySaveActions` — player → save action count

**These are displayed in UI (TeamModal, StarsOfTheDay, golden-boot API) but are never read by `rankings.js`.** The rankings engine only sees team-level goal totals.

### Current attack/control calculation

In `rankings.js → calculateAttackControlRatings()`:

- Carries forward `goalsForPerSession` and `goalsAgainstPerSession` (team-level running averages)
- Min-max normalises per date using established players (≥35 ELO games) as bounds
- `attacking = (goalsForPerSession − minGF) / (maxGF − minGF)` — [0,1]
- `control  = (maxGA − goalsAgainstPerSession) / (maxGA − minGA)` — [0,1]

These flow into `teamGenerator.js → calculateNormalizedScore()` with weights `W_ATTACK = 0.8`, `W_CONTROL = 0.8` (lower is better, balanced across teams).

### Team generator scoring (current)

`calculateNormalizedScore()` currently optimises for:

| Component       | Weight | What it measures                                |
| --------------- | ------ | ----------------------------------------------- |
| ELO delta       | 1.0    | Mean ELO gap between strongest and weakest team |
| ELO spread      | 0.7    | Distribution of skill tiers within each team    |
| Pairing novelty | 1.3    | How fresh the teammate pairings are             |
| Attack delta    | 0.8    | Variance in team attack averages                |
| Control delta   | 0.8    | Variance in team control averages               |

---

## Phase 1: Enhanced Attack / Control Ratings

### 1.1 Collect individual stats per player in `rankings.js → updateRankings()`

For every session, after collecting team-level stats, iterate over all match data and extract individual action counts per player:

```js
// Per match:
const indGoals = merge(match.homeScorers, homeTeam) + merge(match.awayScorers, awayTeam);
const indOffActions =
    merge(match.homeOffensiveActions, homeTeam) + merge(match.awayOffensiveActions, awayTeam);
// ... etc.
```

Accumulate per player into `playerTracker`:

```js
playerData.indGoals += playerGoals;
playerData.offActions += playerOffActions;
playerData.defActions += playerDefActions;
playerData.saveActions += playerSaveActions;
```

Store running per-session averages in `history[date].ratings`:

```js
goalsPerSession:      playerData.indGoals      / playerData.appearances,
offActionsPerSession: playerData.offActions    / playerData.appearances,
defActionsPerSession: playerData.defActions    / playerData.appearances,
saveActionsPerSession: playerData.saveActions  / playerData.appearances,
```

**Note on legacy data:** Sessions played before individual-stats tracking started will contribute 0 to the cumulative sums. This means stats will be slightly understated until enough tracked sessions have accumulated. This self-corrects over time; no special casing required.

### 1.2 Normalise and compute composite ratings in `calculateAttackControlRatings()`

**Step 1 — Carry-forward pass:** Extend existing carry-forward to include the four new per-session averages (same pattern as `goalsForPerSession` / `goalsAgainstPerSession`).

**Step 2 — Bounds per date:** For each date, compute min/max for each of the six metrics using established players (≥35 games):

- `goalsForPerSession`, `goalsAgainstPerSession` (existing)
- `goalsPerSession`, `offActionsPerSession`, `defActionsPerSession`, `saveActionsPerSession` (new)

**Step 3 — Weighted composite ratings:**

```
attacking_composite = (
    3 × norm(goalsPerSession)       +   // Individual goals: biggest signal
    2 × norm(offActionsPerSession)  +   // Offensive contributions
    1 × norm(goalsForPerSession)        // Team goals for: team context
) / 6

control_composite = (
    2 × norm(saveActionsPerSession) +   // Saves: clear defensive contribution
    2 × norm(defActionsPerSession)  +   // Defensive actions
    1 × inv_norm(goalsAgainstPerSession)// Team goals against (inverted)
) / 5
```

Where `inv_norm(x) = (maxGA − x) / range` (lower GA = higher control, as today).

**Graceful degradation:** If a player has no individual stats yet (all four per-session averages are zero or null) the formula falls back to: `attacking = norm(goalsForPerSession)`, `control = inv_norm(goalsAgainstPerSession)`. This preserves existing behaviour for new leagues or players with only legacy data.

**Store in history for transparency:**

```js
r.goalsNorm      = ...;  // normalised individual goals
r.offActionsNorm = ...;  // normalised offensive actions
r.defActionsNorm = ...;  // normalised defensive actions
r.saveActionsNorm= ...;  // normalised saves
r.attacking      = attacking_composite;  // updated composite (was team-GF based)
r.control        = control_composite;   // updated composite (was team-GA based)
```

---

## Phase 2: Player Traits & Internal Team Balance

### 2.1 Trait classification in `rankings.js → calculatePlayerProfiles()`

Called at the end of `updateRankings()`, after `calculateAttackControlRatings()`.

**Traits are independent boolean flags**, each evaluated separately. A player can hold any combination.

```js
const PROFILE_THRESHOLD = 0.55;

playerData.traits = {
    isFinisher: goalsNorm >= PROFILE_THRESHOLD,
    isAttacker: offActionsNorm >= PROFILE_THRESHOLD,
    isDefender: defActionsNorm >= PROFILE_THRESHOLD,
    isShotStopper: saveActionsNorm >= PROFILE_THRESHOLD
};
```

**Derived display label** (for UI only — not used in balance logic):

| Label            | Condition (priority order)      |
| ---------------- | ------------------------------- |
| **Engine**       | Two or more traits are true     |
| **Finisher**     | `isFinisher` only               |
| **Attacker**     | `isAttacker` only               |
| **Defender**     | `isDefender` only               |
| **Shot Stopper** | `isShotStopper` only            |
| **Generalist**   | No traits (all below threshold) |

```js
playerData.playerProfile = deriveLabel(playerData.traits);
```

**Fallback:** Players with no individual stats → all traits false → label `'generalist'`.

**Provisional players** (< GAMES_THRESHOLD ELO games): traits default to all false in the team generator, since their individual stat averages are too thin to be reliable.

### 2.2 Trait data in team generator

**`ProvisionalPlayerData` typedef** — add `traits` field:

```js
/** @property {{ isFinisher: boolean, isAttacker: boolean, isDefender: boolean, isShotStopper: boolean }} traits */
```

**`getProvisionalPlayerData()`** — pass traits through:

```js
traits: isProvisional
    ? { isFinisher: false, isAttacker: false, isDefender: false, isShotStopper: false }
    : (playerData?.traits ?? {
          isFinisher: false,
          isAttacker: false,
          isDefender: false,
          isShotStopper: false
      });
```

### 2.3 Trait balance scoring in `calculateNormalizedScore()`

New method: `calculateTraitBalance(teams)`

**Logic:**

1. For each team, count players holding each relevant trait:
    - `attackCount` = players with `isFinisher` OR `isAttacker` (or both)
    - `defenceCount` = players with `isDefender` OR `isShotStopper` (or both)
    - An engine-type player (e.g. `isAttacker + isDefender`) counts in **both** pools
2. For each pool, compute the range (max − min count) across all teams
3. Normalise each range by dividing by typical team size (e.g. 4–5), clamped to [0,1]
4. Final score = average of the two normalised ranges

Lower = better balanced. Score 0 = all teams have identical trait distribution.

**Integration into `calculateNormalizedScore()`:**

```js
const W_TRAITS = 0.8;  // Roughly equal to attack/control balance weight
...
const traitsNorm = this.calculateTraitBalance(teams);
const totalNorm = (... + traitsNorm * W_TRAITS) / (W_ELO + W_SPREAD + W_PAIR + W_ATTACK + W_CONTROL + W_TRAITS);
```

Return `traitsNorm` in the metrics object.

**When trait data is absent** (new league or all-provisional pool): score returns 0 (neutral).

---

## Architecture Decisions

### Why composite rather than fully replacing team-GF/GA?

Team GF/GA captures the collective context a player consistently operates in. If a player is always on the strongest team, their individual stats may be inflated. Keeping GF/GA as a (lower-weight) component provides an anchor to this team-level signal.

### Why normalise individual stats per date rather than across all history?

Consistent with the existing approach. The player pool and performance distribution changes over the year; per-date normalisation means ratings always reflect relative performance against current peers.

### Why carry-forward for individual stats?

Same reason as existing GF/GA carry-forward: when a player doesn't appear on a given date, we need their most-recent stats to be visible for the attack/control normalisation pass, which processes all dates globally.

### Why `appearances` as denominator for per-session individual stats?

Keeps it simple. Legacy sessions before tracking contribute 0, slightly understating stats, but this self-corrects as more tracked sessions accumulate. Tracking a separate `sessionsWithStats` counter adds complexity for marginal benefit.

### Why profile thresholds at 0.55?

In a symmetrically normalised [0,1] distribution, 0.55 means clearly above average but not extreme. This should capture the top ~35-40% of the distribution. We may need to iterate.

### Why trait-based rather than a single exclusive profile label?

A player who is above-threshold in both offensive and defensive stats (an "engine") should simultaneously satisfy the attack-pool constraint for their team **and** the defence-pool constraint. With a single mutually exclusive label (e.g. "Engine"), they would contribute to neither, making the balance metric blind to them. Traits are independent, so the engine player counts toward both pools. The display label is then a convenience derived from the trait combination.

### Why trait balance weight 0.8?

Roughly equal to `W_ATTACK` and `W_CONTROL` (both 0.8). Profile balance is in the same tier as skill-dimension balance — important, but secondary to ELO balance (1.0) and pairing novelty (1.3).

---

## Files to Modify

| File                              | Changes                                                                                                                                                                    |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/rankings.js`      | Collect individual stats in `updateRankings()`, extend `calculateAttackControlRatings()` with new normalisation and composite formula, add new `calculatePlayerProfiles()` |
| `src/lib/server/teamGenerator.js` | Add `profile` to `ProvisionalPlayerData` typedef, update `getProvisionalPlayerData()`, add `calculateProfileBalance()`, extend `calculateNormalizedScore()`                |

No schema migration needed — new fields are added additively to the JSON files. Existing rankings files without the new fields will work; `attackingRating` / `controlRating` will be recalculated on the next `updateRankings()` call, which happens automatically after every session.

---

## Testing Approach

### Rankings tests (`test/lib/server/rankings.test.js`)

New test groups to add:

**Individual stats extraction:**

- Extracts goals from `homeScorers`/`awayScorers` correctly per player
- Extracts offensive/defensive/save actions correctly per player
- Handles missing action maps (null / undefined) gracefully
- Does not count reserved keys (`__ownGoal__`, `__unassigned__`) as player goals
- Computes correct running averages across multiple sessions
- Legacy sessions (no individual stats) do not break accumulation

**Composite attack/control ratings:**

- With no individual stats → produces same result as current (team GF/GA only)
- With individual stats → weighted composite formula produces expected values
- Players with high individual goals get higher `attackingRating` than teammates on same team
- Players with high saves/defActions get higher `controlRating` than teammates

**Player traits and profile:**

- `calculatePlayerProfiles()` sets independent boolean traits based on normalised stats
- `isFinisher` true when `goalsNorm ≥ 0.55`
- `isAttacker` true when `offActionsNorm ≥ 0.55`
- `isDefender` true when `defActionsNorm ≥ 0.55`
- `isShotStopper` true when `saveActionsNorm ≥ 0.55`
- Multiple traits can be true simultaneously (engine-type player)
- Display label `'engine'` when 2+ traits true, specific label when exactly 1 trait, `'generalist'` when none
- Player with no individual stats → all traits false → label `'generalist'`

### Team generator tests (`test/lib/server/teamGenerator.test.js`)

New test groups:

**Trait balance scoring (`calculateTraitBalance`):**

- All teams with same trait distribution → score = 0
- All finishers on one team → high score
- Balanced distribution (1 finisher per team) → low score
- Engine player (isAttacker + isDefender both true) counts in both attack pool AND defence pool
- Handles teams with all-provisional / no-trait players → returns 0 (neutral)

**End-to-end seeded generation:**

- `traitsNorm` is included in `calculateNormalizedScore()` return object
- Generated teams have more balanced profile distributions than random assignment (statistical test over multiple runs)

---

## Assumptions & Limitations

1. **Individual stats are optional** — the system degrades gracefully when they are absent. Older sessions simply don't contribute to individual stat averages.

2. **5-a-side context** — in this format there is no fixed goalkeeper. "Saves" and "defensive actions" can be made by any player. The Shot Stopper profile therefore refers to a player who frequently makes save-like contributions, not a dedicated keeper.

3. **Small sample size** — with only a few months of data, individual stat normalisation may be noisy for players with few sessions. The existing provisional rating system (linear interpolation for players with < 35 ELO games) will naturally dampen this for new players.

4. **Trait thresholds are tunable** — `PROFILE_THRESHOLD = 0.55` and `W_PROFILE = 0.8` are good starting points. Once implemented, actual trait distributions should be inspected and thresholds iterated. The threshold governs how many players earn each trait; too low gives everyone all traits (no discrimination), too high leaves most players as generalists.

5. **No breaking API changes** — all new fields are additive. Rankings API responses will include new fields (individual stat averages, normalised values, profile). Frontend components consuming ranking data are not required to use these new fields immediately.

6. **Profile balance complements, not replaces, skill balance** — ELO balance remains the primary constraint. Profile balance is a secondary, softer constraint to improve internal team variety.

---

## Implementation Order

1. **Write tests first** for individual stats extraction (Phase 1.1)
2. Implement individual stats collection in `updateRankings()`
3. **Write tests** for composite rating calculation (Phase 1.2)
4. Implement composite `calculateAttackControlRatings()`
5. Run full test suite — verify no regressions
6. **Write tests** for profile classification (Phase 2.1)
7. Implement `calculatePlayerProfiles()`
8. **Write tests** for profile balance scoring (Phase 2.2, 2.3)
9. Implement profile-aware team generator
10. Run full test suite
11. Manual verification: inspect profiles of known players, check generated team compositions
12. Create implementation summary doc in `tasks/`

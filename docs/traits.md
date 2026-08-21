# Player Traits & Badges — As-Built

Documents the trait and badge awarding mechanism on player profiles, as implemented in
`src/lib/server/rankings.js`. Originally reconstructed from the code on 2026-08-21 (the feature
shipped undocumented — see `tasks/202608211227-traits-badges-documentation.md` for the audit
trail), then updated for the tiering change in
`tasks/202608211530-traits-tiering-implementation.md`.

The pre-implementation design in `tasks/202603141200-enhanced-ratings-player-profiles-plan.md`
does **not** describe current behaviour and should not be read as a spec.

Traits are **computed once and persisted** into `rankings-YYYY.json`, not derived on read.

## Pipeline

```
session JSON (games.rounds[][], knockout bracket)
  └─ collectIndividualStatsForSession()      raw per-session counts + `tracked` flags
      └─ per-stat cumulative averages         indGoals / sessionsWithGoals, …
          └─ calculateAttackControlRatings()  min-max norms against the established pool
              └─ calculatePlayerProfiles()    confidence pull → dynamic threshold → traits → badges
                  └─ saveRankingsUnsafe()     persisted as `traits` and `playerProfile`
```

Call order is fixed at `rankings.js:1517-1522` — profiles **must** run after attack/control,
because it consumes the `*Norm` values that step writes.

## Data capture

`collectIndividualStatsForSession()` (`rankings.js:1027-1098`) walks every league round and the
knockout bracket, absorbing eight maps per match: `home/awayScorers`,
`home/awayOffensiveActions`, `home/awayDefensiveActions`, `home/awaySaveActions`.

- Reserved keys `__ownGoal__` and `__unassigned__` are excluded, as are non-positive counts.
- A `tracked` flag is set per stat **type** the first time a non-null map for it is seen. This
  distinguishes "tracked and scored zero" from "not tracked at all" — the flag, not the count,
  drives everything downstream.

## Per-session averages, not totals

`rankings.js:1356-1392`. Each of the four stats carries its **own** session counter, incremented
only when that stat type was tracked in that session:

```
goalsPerSession      = indGoals    / sessionsWithGoals
offActionsPerSession = offActions  / sessionsWithOffActions
defActionsPerSession = defActions  / sessionsWithDefActions
saveActionsPerSession= saveActions / sessionsWithSaveActions        // null when the counter is 0
```

Separate counters exist so a change in what the league records doesn't dilute the averages of
stats that were always recorded. In pirates 2026 this is load-bearing: goals were tracked from
2026-01-03 but offensive/defensive/save actions only from **2026-03-07**, so the first nine
sessions of the season count toward `sessionsWithGoals` and toward nothing else.

Team-level `teamGF`/`teamGA` use plain `appearances` as the denominator instead
(`rankings.js:1374-1376`), since they are always available.

## Normalisation

`calculateAttackControlRatings()` (`rankings.js:1635-1876`) runs three passes over the history.

1. **Carry-forward** (`1652-1681`) — a player's last known per-session averages are copied into
   history entries for sessions they missed, so an absent player keeps a norm rather than
   dropping out.
2. **Bounds** (`1683-1732`) — per session date, min and max of each stat are taken across the
   **established pool**: players with `eloGames.season >= MIN_GAMES_FOR_NORMALIZATION_POOL` (35)
   on that date. A stat with no established values that date gets `null` bounds.
3. **Normalise** (`1734-1875`) — min-max, clamped to `[0,1]`:

```
norm(v, min, max) = clamp01((v − min) / (max − min))      // 0.5 when max === min
```

The value the trait system consumes is the **latest date's** norm, lifted to player level as
`goalsNorm` / `offActionsNorm` / `defActionsNorm` / `saveActionsNorm` (`rankings.js:1871-1874`).
Because every player who has ever appeared receives a history entry on every subsequent date,
"latest" is the same date for everyone, so the four norms are mutually comparable.

The same norms feed the composite balancing ratings (`rankings.js:1817-1818`):

```
attacking = (3·goalsNorm + 2·offActionsNorm + 1·teamGFNorm) / 6
control   = (0.5·saveActionsNorm + 3.5·defActionsNorm + 1.5·teamGAInvNorm) / 5.5
```

## Eligibility

`calculatePlayerProfiles()` (`rankings.js:1118-1217`) gates traits on **two** conditions, both
of which must hold before a stat can award anything:

```
seasonEloGames        >= 35      TRAIT_SEASON_GAMES_THRESHOLD
sessionsWith<Stat>    >= 5       TRAIT_MIN_TRACKED_SESSIONS
```

The first is the league-wide "established" bar — the same 35 games the team generator uses for
provisional ratings (`teamGenerator.js:39`, "~5 sessions"). It reads the **current season's**
count, so a returning player does not import last year's standing. A session is roughly 7–8 ELO
games, so it lands at about five sessions.

The second requires five sessions of **the stat itself**. This matters whenever a league starts
recording a stat mid-season: without it, attendance from before the stat existed would count
toward "proving yourself" at it. Pirates began recording offensive/defensive/save actions on
2026-03-07 while goals ran from January, so the two counts genuinely diverge.

This is a **hard gate, not a ramp**. An earlier version multiplied each norm by
`min(1, seasonEloGames/35)²` before comparing it to the bar; that pull was removed once
eligibility became a hard requirement, because every eligible player has a confidence of
exactly 1 and the multiplication was provably a no-op.

## Bands and tiers

Eligible players are banded per stat against the **live distribution** of that stat, using
nearest-rank percentiles over the eligible pool (`rankings.js:1153-1179`):

```
baseBar  = 50th percentile of eligible norms      BASE_PERCENTILE  = 0.5
eliteBar = 85th percentile of eligible norms      ELITE_PERCENTILE = 0.85
tier     = norm >= eliteBar ? 2 : norm >= baseBar ? 1 : 0
```

Base therefore means "above the median at this", and Elite means "top 15%". Because only
eligible players set the bands, newcomers and barely-measured players cannot drag them around;
and because the bands recompute on every recalculation, they cannot go stale as the league
grows. Scarcity is now consistent across the four traits by construction, where the previous
mean-based bar left them ranging from 15 to 22 holders.

Each player receives both a boolean map and a tier map:

| Trait        | Flag            | Source stat                   |
| ------------ | --------------- | ----------------------------- |
| Finisher     | `isFinisher`    | goals per session             |
| Attacker     | `isAttacker`    | offensive actions per session |
| Defender     | `isDefender`    | defensive actions per session |
| Shot Stopper | `isShotStopper` | save actions per session      |

```js
playerData.traits     = { isFinisher: bool, ... };      // true at base-or-better
playerData.traitTiers = { isFinisher: 0 | 1 | 2, ... }; // 0 none, 1 base, 2 Elite
```

`traits` keeps its original boolean shape deliberately, so the badge lattice and
`teamGenerator.calculateTraitBalance()` consume it unchanged. Only the badge component reads
`traitTiers`.

## Badge lattice

Combo badges are computed from `traits`, i.e. from **base-or-better** — a tier upgrade never
changes which combos a player holds. They are pushed in this order and are **non-exclusive and
additive**, so the sets overlap rather than collapsing to the best one.

| Badge           | Requires                       | Tier   |
| --------------- | ------------------------------ | ------ |
| G.O.A.T.        | all four                       | gold   |
| Complete Player | Attacker + Finisher + Defender | gold   |
| Danger Man      | Finisher + Attacker            | silver |
| Engine          | Defender + Attacker            | silver |
| Sentinel        | Defender + Shot Stopper        | silver |
| Utility Hero    | Finisher + Shot Stopper        | silver |

Two of the six two-trait pairs have **no** badge: Finisher+Defender and Attacker+Shot Stopper.
`test/lib/server/rankings.test.js:2175` asserts the absence of the first as deliberate.

A player holding all four traits therefore renders **ten** badges at once — four bronze trait
badges plus all six combos, since G.O.A.T. does not suppress the others.

## Consumers

- **`src/components/PlayerBadges.svelte`** — renders traits, then silver (2-trait) combos,
  then gold (3+) combos, regardless of the push order above. A trait at tier 2 renders in gold
  with its label prefixed `Elite ` (e.g. "Elite Attacker"); base traits stay bronze. A held
  trait with no tier present falls back to base, so rankings files written before tiering
  still render correctly. Reached from `PlayerHeader.svelte:73` (used by
  `PlayerModal.svelte:112`) and `src/routes/rankings/[player]/+page.svelte:223`.
- **`src/lib/server/teamGenerator.js`** — `calculateTraitBalance()` (`teamGenerator.js:917`)
  spreads trait-holders across teams, weighted `W_TRAITS = 0.8` (`teamGenerator.js:829`).
  Provisional players are forced to zero traits for balancing (`teamGenerator.js:325`),
  independently of what their profile displays.

    **The team generator is deliberately tier-blind.** It reads the `traits` booleans at
    `teamGenerator.js:936` and never touches `traitTiers`, so balancing sees only trait vs
    no-trait and an even spread of holders — an Elite Finisher and a base Finisher are the same
    player to it. This keeps tiering a display concern. `test/lib/server/teamGenerator.test.js`
    (`describe('tier blindness')`) locks it in: identical booleans with different tiers must
    produce an identical `traitsNorm` and an identical composite score.

- The **Ballers Board does not render trait badges.** Its rows link to `/rankings/{player}`,
  where the badges appear.

## Constants

| Constant                           | Value | Source                 |
| ---------------------------------- | ----- | ---------------------- |
| `TRAIT_SEASON_GAMES_THRESHOLD`     | 35    | `rankings.js:1121`     |
| `TRAIT_MIN_TRACKED_SESSIONS`       | 5     | `rankings.js:1123`     |
| `BASE_PERCENTILE`                  | 0.5   | `rankings.js:1125`     |
| `ELITE_PERCENTILE`                 | 0.85  | `rankings.js:1126`     |
| `MIN_GAMES_FOR_NORMALIZATION_POOL` | 35    | `rankings.js:1636`     |
| `W_TRAITS`                         | 0.8   | `teamGenerator.js:829` |

None of these are operator-tunable — unlike momentum, traits have no `info.json → settings`
block.

## Observed behaviour (pirates, 2026 season, 32 sessions)

Measured 2026-08-21 against `data/pirates/rankings-2026.json` (recalculated
2026-08-15T10:07:38Z, 32 sessions); 72 players, 39 established. These figures move as the
season progresses.

| Stat         | Eligible | Base bar | Elite bar | Base | Elite | Total |
| ------------ | -------- | -------- | --------- | ---- | ----- | ----- |
| Goals        | 39       | 0.216    | 0.619     | 14   | 6     | 20    |
| Off actions  | 37       | 0.299    | 0.743     | 13   | 6     | 19    |
| Def actions  | 37       | 0.452    | 0.683     | 13   | 6     | 19    |
| Save actions | 37       | 0.162    | 0.626     | 13   | 6     | 19    |

Badges in issue: Danger Man 16, Engine 11, Complete Player 10, Sentinel 7, Utility Hero 7,
G.O.A.T. 3.

## Characteristics and limitations

Properties of the current rule, recorded neutrally.

1. **Min-max makes a norm outlier-relative.** The minimum is almost always 0, so a norm is
   effectively "fraction of the single best player's rate", and one player's exceptional run
   compresses everyone else. Percentile bands blunt this — the bar is a rank, not a value — but
   the underlying norm still moves when the league's best mover changes.
2. **Carry-forward keeps departed players in the pool.** A player who stopped attending months
   ago retains their last norms and continues to sit inside the eligible pool that sets the
   bands.
3. **Breadth still outranks excellence at the top.** The combo lattice reads base-or-better, so
   four median-level traits earn G.O.A.T. while a single perfect norm earns a tier-2 trait and
   whatever pairs it happens to complete. The Elite tier makes excellence _visible_ without
   making it _outrank_ breadth. The smallest available change would be to require at least one
   Elite trait for `Complete Player` and `G.O.A.T.`
4. **A four-trait player still renders ten badges** — four trait badges plus all six combos,
   because G.O.A.T. does not suppress the others.
5. **Save actions are a role stat.** Keeper duty rotates, so the per-session average measures
   how often a player kept goal as much as how well.
6. **The Ballers Board ranks by season totals**, while traits use per-session averages — the
   board and the badges it links to are ordered by different quantities, so a high-attendance
   player near the top of the board may hold fewer badges than a low-attendance player far
   below them.
7. **Two of the six two-trait pairs have no combo badge**, so some trait pairs display as two
   trait badges and nothing else.
8. **The 35-game bar reads season ELO games, while the team generator's identical bar reads
   all-time `elo.gamesPlayed`.** This is deliberate — traits describe current-season form — but
   it means a returning veteran can be non-provisional for the draw and hold no traits.

## Files

| File                                                                                                      | Role                                                     |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| `src/lib/server/rankings.js`                                                                              | capture, averages, normalisation, trait/badge assignment |
| `src/lib/server/teamGenerator.js`                                                                         | `calculateTraitBalance()`, `W_TRAITS`                    |
| `src/components/PlayerBadges.svelte`                                                                      | badge rendering and tiering                              |
| `src/components/Icons/{DangerMan,Engine,Tower,UtilityHero,Crown,Trophy,Bullseye,Shield,Glove}Icon.svelte` | badge icons                                              |
| `test/lib/server/rankings.test.js:1990-2202`                                                              | `calculatePlayerProfiles` unit tests                     |
| `test/lib/server/teamGenerator.test.js:599-745`                                                           | trait-balance tests                                      |

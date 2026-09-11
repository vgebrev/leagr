# Attack / Control Ratings Rework — Implementation

**Date:** 2026-09-04
**Follows:** `tasks/202608271319-attack-control-ratings-audit.md` (diagnosis; R1–R4 recommended there)

## Overview

Applied the four recommendations from the ratings audit to `calculateAttackControlRatings()`,
plus the two knock-on changes the wider rating spread forces: the team-generator's balance cap
and the display gamma curve.

|                    | before                                       | after                                        |
| ------------------ | -------------------------------------------- | -------------------------------------------- |
| Attack             | `(3·goals + 2·off + 1·teamGF) / 6`           | `(3·goals + 2·off + 0.6·teamGF) / 5.6`       |
| Defence            | `(0.5·saves + 3.5·def + 1.5·teamGA⁻¹) / 5.5` | `(1·saves + 3.5·def + 0.75·teamGA⁻¹) / 5.25` |
| Missing component  | scored 0, weight stays in denominator        | drops out of numerator **and** denominator   |
| Normalisation      | min–max over the established pool            | midrank percentile over the established pool |
| `RATING_DELTA_CAP` | 0.2                                          | 0.26                                         |
| Display            | `pow(0.1 + 0.9·v, 0.45)`                     | `25 + v · 75` (affine floor)                 |

## Architecture decisions

**R1 — renormalised denominator (`rankings.js`).** The old code's comment claimed a missing
component's weight was "redistributed"; it was not — the denominator stayed fixed at 6 / 5.5, so a
player who had never had a stat recorded was scored down for a gap in the data. Replaced with a
`blend()` helper that takes `[weight, value]` pairs and sums weights only for components that exist.

**R2 — percentile normalisation (`rankings.js`).** `norm(value, min, max)` became
`norm(value, pool)`, the midrank percentile of the value within that date's established pool.
The second pass now keeps the pool arrays instead of reducing them to bounds. Rationale: the
individual stats are right-skewed, so under min–max one outlier owned a quarter of the scale and
the median player normalised to ~0.21, while the near-symmetric team stats spread across the full
range. A component's nominal weight therefore did not predict its influence.

Percentile rank is **monotone**, which is what makes this safe: trait tiers and badges are
percentile bands over the same `*Norm` values, so they are invariant under the change. Verified
empirically — see Testing.

**R3 / R4 — reweighting (`rankings.js`).** Saves 0.5 → 1.0, team GA 1.5 → 0.75, team GF 1 → 0.6.
Team terms are deliberately minor: over a season they explain far less of a player than their own
recorded actions, and most of their spread comes from low-appearance players whose team averages
have not regressed to the mean.

**`RATING_DELTA_CAP` 0.2 → 0.26 (`teamGenerator.js`).** Percentile-normalised ratings spread
wider, so the same _quality_ of imbalance now shows up as a larger raw gap. Calibrated against
20 000 random 4×6 splits of the pirates pool by holding constant the share of splits that saturate
the cap (attack wants 0.24, control 0.27 — 0.26 splits the difference). This matters because
`clamp01` flattens the gradient above the cap: leaving it at 0.2 would have raised the saturated
share from 37%/16% to 55%/44% and blunted the balancer rather than tightening it.

**Replaced the gamma display curve with an affine floor (`src/lib/shared/ratingDisplay.js`).**
`gamma = 0.45` over a 0.1 floor existed to stretch min–max norms that bunched near the bottom.
Percentile norms make the raw value meaningful on its own, but showing it raw dropped the
all-player mean from 59/68 to 40/43 and put seven players at 0 — the bottom of a distribution
somebody is genuinely in still reads as a zero. The display now runs from a floor instead:

```
display(v) = 25 + v · 75
```

Affine rather than a curve, for the two reasons that decided it over a milder gamma:

1. **Gaps stay proportional.** Every difference scales by the same factor, so a specialist still
   reads as one. Measured on the established pool: sd 19 under the floor vs 15 under gamma, and
   Xavier (attacker, weak defender) reads 90/45 rather than gamma's 94/62.
2. **It commutes with a weighted mean**, so the component numbers in a rating's tooltip average to
   the rating on its bar. Verified on real players: Mufasa's bar shows 52 and his three Attack
   components weight-average to 52.3. The gamma curve broke that relationship, which is why the
   bar and the tooltip beneath it never agreed.

Both `PlayerRatings.svelte` and `TeamTable.svelte` go through the shared helper, so a profile and a
team card can no longer disagree. The overall badge goes through it too — see below. The floor lands the established mean at 62/62 against the old
display's 64/71 — near parity on feel, with the number now meaning something. `Math.floor` also
became `Math.round`, since under percentile norms nobody reaches exactly 1.0 and truncation was a
systematic half-point penalty.

**The overall badge leans toward a player's stronger side (`displayOverall`).** It was a flat
average of the two bars, which marked a specialist down for the half of the game they don't play.
Jay is the case in point: the second-best attack in the league behind Dan, but averaging his bars
(96 and 37) gives 66 and leaves him fifteenth among established players. It is now:

```
overall = 0.7 · max(attack, defence) + 0.3 · min(attack, defence)
        = mean + 0.2 · |attack - defence|
```

Jay lands on **78**, eighth. Balanced players are untouched — the two forms are identical when the
sides are equal, so Veli stays at 87 — and no badge falls below the average it replaces. The cost
is real and symmetric: mid-table all-rounders slide relative to specialists, Hayden and Gregory by
six to eight places. That was accepted deliberately, because breadth is already rewarded elsewhere:
the all-rounder, complete-player and true-baller badges all require a player to be good at several
things at once, so the badge leaning toward strength complements the traits rather than competing
with them.

A power mean (`((aᵖ + dᵖ)/2)^(1/p)`) gives a similar lift and was rejected on a specific ground:
the linear form is **affine-equivariant**, so it commutes with `displayRatingPercent` and the badge
means the same thing computed from the displayed numbers or the raw ratings. A power mean's shape
depends on where the display floor puts zero, which would entangle `RATING_DISPLAY_FLOOR` with
`OVERALL_STRONG_SIDE_WEIGHT`. Both are single named constants, retunable independently.

## Files modified

| File                                                                              | Change                                                                                                     |
| --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `src/lib/server/rankings.js`                                                      | `norm()` → percentile; pools replace min/max bounds; `blend()` helper; new weights; doc comment            |
| `src/lib/server/teamGenerator.js`                                                 | `RATING_DELTA_CAP` 0.2 → 0.26, with the calibration recorded                                               |
| `src/lib/shared/ratingDisplay.js`                                                 | **new** — the display scale (`RATING_DISPLAY_FLOOR`, `displayRatingPercent`, `displayRatingRounded`)       |
| `src/components/PlayerRatings.svelte`                                             | dropped `applyGammaSpread` and the `gamma` prop; bars, overall badge and tooltip all read the shared scale |
| `src/routes/teams/components/TeamTable.svelte`                                    | dropped `applyGammaSpread`; same shared scale; removed the now-duplicate "Raw n%" title                    |
| `src/components/PlayerHeader.svelte`, `src/routes/rankings/[player]/+page.svelte` | dropped `gamma={0.45}`                                                                                     |
| `docs/traits.md`                                                                  | pipeline, normalisation and composite sections rewritten to the as-built spec                              |
| `test/lib/server/rankings.test.js`                                                | four new cases (below)                                                                                     |

Local analysis tooling in the gitignored `scripts/`: `ratings-compare.mjs` (before/after harness),
`_rankings-old.mjs` (verbatim pre-change snapshot of `rankings.js`, the only source of "before"
numbers once data is recalculated), `recalc-rankings.mjs`, `_alias-hooks.mjs` /
`_alias-register.mjs` (resolve SvelteKit's `$lib` alias for plain `node`).

## Testing

`npm test` — 1194 backend + 241 frontend passing, 2 skipped. Eleven cases in
`test/lib/shared/ratingDisplay.test.js` pin the display scale and the badge, including the
properties the choices rest on: gaps stay proportional, the scale commutes with a weighted mean,
the badge is symmetric, it leaves a balanced player on their average, and it never lands outside
[average, stronger side]. Four cases added to `calculateAttackControlRatings — composite with
individual stats`:

- a never-measured component leaves the denominator with it (asserts the exact `/3.6` arithmetic)
- percentile normalisation puts the median of `1, 2, 3, 4, 50` at 0.5 rather than 0.04
- the Attack weights (`3 / 2 / 0.6` over 5.6)
- the Defence weights (`1 / 3.5 / 0.75` over 5.25)

Verified against real data (pirates 2026, 73 players / 39 established) by replaying both formulas
over the same persisted history. The pre-change replay reproduced the ratings on disk to
**0.00000**, so every diff below is attributable to the formula rather than to input drift.

- **Zero badge churn**: 0 trait flips, 0 profile-label changes — the monotonicity argument holds.
- Order preserved: Spearman(before, after) = **0.976** attack, **0.966** defence; mean rank shift
  1.67 / 2.05 places out of 39.
- Individual share of the spread (covariance decomposition): attack **93.1% → 97.0%**,
  defence **76.5% → 88.2%**.
- Established-pool means: attack 0.330 → 0.499, defence 0.424 → 0.490; sd 0.210 → 0.255 and
  0.165 → 0.225.
- A full `updateRankings(2026)` on local data changed **only** the eight rating/norm fields.
- Spot-checked in the running app: Jay 96 / 37 / **78** (a flat average of those bars would be 66),
  Veli 86 / 87 / **87** — balanced, so the badge change leaves him alone — Dan 97 / 85 / **93** with
  his badges unchanged, and Mufasa 52 / 86 (was 57 / 82, Attack barely distinguishable from
  Defence). The 2026-08-29 team table reads 63/60/62/65 attack and 63/65/58/68 defence, on the same
  scale as the profiles.

## Assumptions and limitations

- **No data migration.** `loadEnhancedRankings()` serves stored ratings as-is, so existing leagues
  keep their old numbers until a full recalculation runs — either automatically when a session is
  next scored, or via the **Update Rankings** action (`POST /api/rankings`). Local pirates data has
  already been recalculated.
- **R1 makes thin-sample players conspicuous.** A player with no individual stats is now rated on
  their team terms alone rather than dragged toward zero. Angelo (1 appearance, 8 season ELO games)
  goes from Defence 0.232 to 0.962 — his one session's team GA, and nothing else. The team
  generator is protected, because `calculateProvisionalRating()` already shrinks unestablished
  players' attack/control toward a weak anchor, but **the profile page is not** and will show him
  96%. The audit called this out as the attendance bias in the team component (finding 6); R1
  exposes it rather than creating it. Worth a follow-up: apply the same confidence pull to the
  displayed rating, or hide the bars until a minimum appearance count. He shows 97 with the
  display floor applied.
- **Saves are still nearly inert.** Doubling the weight moved their share of Defence's spread from
  0.5% to 3.4%. The ceiling is structural — few players are ever in goal, and save counts
  anti-correlate with everything else in the rating.
- **The residual nominal-vs-effective gap is now about correlation, not scale.** After percentile
  normalisation every component has the same marginal distribution, so team GF's 11% nominal /
  3.0% effective gap reflects its weak correlation with goals and offensive actions (which
  correlate 0.878 with each other and so reinforce). This is not a normalisation defect.
- **R5 (recency window) not attempted.** Attack/control remain season-cumulative averages with no
  decay, unlike ELO.

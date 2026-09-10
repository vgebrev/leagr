# Shot Stopper scores saves on rate and volume, and bands Elite at 0.75

Supersedes the saves half of
[`202608241655-shot-stopper-sessions-in-goal-implementation.md`](202608241655-shot-stopper-sessions-in-goal-implementation.md).

## The question that started it

The league's two highest-volume keepers — Chris (131 saves, 55 matches in goal) and Lunathi
(151 saves, 52) — both held only **base** Shot Stopper. Lunathi sat 5th of 25 eligible on 7.19
saves per session in goal, Chris 7th on 6.55, against an Elite bar of 7.308. Lunathi needed
+3 saves; Chris +16.

The brief was to work out how to average saves properly, on the observation that some players
keep goal for several matches in a session while others take one turn — a distortion the other
three stats do not have, because everyone plays 6–7 of a session's 7–8 matches.

## What the data actually said

The observation was right, and worse than suspected. `corr(saves per session in goal, matches
in goal per session) = 0.964`. The badge was a workload measure wearing a rate's clothes: Kat's
12.14 saves per session was 4.86 matches × 2.50 saves; Lunathi's 7.19 was 2.48 × 2.90.

**But the obvious fix is void.** Three independent tests on pirates 2026 agree that per-match
save rate carries no player signal:

| test                                                       | result                                                               |
| ---------------------------------------------------------- | -------------------------------------------------------------------- |
| variance decomposition, 24 keepers with ≥8 matches in goal | ICC **0.05** — true between-player sd 0.074 against an observed 0.33 |
| 400 random half-splits, ≥8 matches in goal per half        | r_half **−0.10** (saves per session: **+0.53**)                      |
| permutation, 458 unambiguous single-keeper matches         | **p = 0.17**                                                         |

Every established keeper makes ≈2.4 saves per match kept. Save% (70.8% league-wide) is likewise
indistinguishable from chance (p = 0.13). The only per-match quantity with real spread is goals
conceded (p = 0.046) — team quality, not keeper skill.

Shipping "saves ÷ matches in goal" would have handed Elite Shot Stopper to whoever got the
luckiest fortnight, and it would have put Offie (5 matches in goal) in the top four.

**What does have signal** is how often a player takes the gloves (ICC 0.77) and how much keeping
they have done. So the metric is built from those.

**A second finding decided the divisor.** Across 400 half-splits, saves ÷ sessions **attended**
is far more reliable (r_full **0.877**) than saves ÷ sessions **in goal** (**0.746**). The August
rule fixed a real bug — an outfield week cost Lunathi Elite by 0.023 on 2026-08-22 — but it did
so by discarding how often a player keeps goal at all and retaining only intensity-when-keeping,
which is the noisier half. The volume term is what lets the better divisor back in: an outfield
week now moves half the norm instead of all of it.

## The rule

```
saveActionsPerSession = saveActions / sessionsWithSaveActions     // null unless sessionsInGoal > 0
saveActionsNorm       = mean( percentile(saveActionsPerSession), percentile(saveActions) )
```

Both halves are midrank percentiles over the same established pool the other stats normalise
against, and both are persisted per date as `rateNorm` / `volumeNorm` beside the combined value.
An entry with no volume recorded falls back to the rate half alone rather than being pulled to
the middle.

Two counters, deliberately asymmetric:

- **`sessionsWithSaveActions`** (reinstated, with exactly its pre-August meaning) — sessions
  attended while the league recorded saves. This is the **divisor**.
- **`sessionsInGoal`** — sessions the player recorded a save. This is the **eligibility gate**
  (≥5), unchanged. Attendance proves you were measured; only time in goal proves the role.

The rate stays `null` for a player who has never kept goal even though their divisor is now
non-zero, preserving the existing no-phantom-zeros rule.

### Elite bands became per-trait

`TRAIT_DEFS` entries may carry an `elitePercentile`, resolved by `eliteBandFor(traitKey)`. Only
Shot Stopper sets one, at **0.75**, and the reason is pool size rather than generosity: its
eligible pool is 25 where the outfield pools are 39–41, so a flat 85th percentile awarded 4 Elite
Shot Stoppers against 7 Finishers, 6 Attackers and 6 Defenders. The trait was structurally
scarcer than its neighbours for a reason unrelated to the standard.

The awarding rule and every surface that explains a badge both read `eliteBandFor()`, so a
per-trait band cannot be stated one way and applied another.

## Effect on pirates 2026

Verified by recalculating twice from the same session files — once with the pre-change code, once
with the new — because the checked-in rankings file was already stale against `develop`. Against
that clean baseline the change moves **only the save path**:

| quantity           | result                                      |
| ------------------ | ------------------------------------------- |
| `attackingRating`  | max delta **0.00000** — byte-identical      |
| `controlRating`    | mean \|delta\| 0.0157, max 0.079            |
| trait tiers        | 4 players, all `isShotStopper` base → Elite |
| `playerProfile`    | 1 player                                    |
| other three traits | Elite counts 7 / 6 / 6, unchanged           |

Elite Shot Stoppers 4 → 8: **Tinashe, Kat, Lunathi, Chris, Prosper, Dave, Elvis, Irry**. Total
Shot Stopper holders is 14 either way — nobody gained or lost the trait, four were re-graded.
Eight rather than the seven the band nominally admits because Elvis and Irry tie exactly on the
bar at 0.800, and the comparison is `>=`.

- **Chris**: rate 5.70, rateNorm 0.787, volumeNorm 0.963, norm **0.875** — 4th, with 0.075 of
  headroom rather than scraping the last slot.
- **Lunathi**: rate 5.81, norm **0.900** — 3rd, and he picks up **Guardian** (Elite Defender +
  Elite Shot Stopper, Gold archetype, superseding Sentinel).

`RATING_DELTA_CAP = 0.26` needs no retune: re-running the 20 000-random-split calibration from
the ratings rework moves the control saturation share 18.5% → 18.7%.

## Files

| File                                           | Change                                                                                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/rankings.js`                   | `sessionsWithSaveActions` reinstated as the divisor; `total` on the history record and its carry-forward; `saveTotal` pool; two-half `saveActionsNorm`; per-trait Elite band |
| `src/lib/shared/badges.js`                     | `elitePercentile` on `TRAIT_DEFS`, `eliteBandFor()`, Shot Stopper's stat wording                                                                                             |
| `src/routes/help/badges/+page.svelte`          | per-trait band paragraph; corrected the "never totalled" claim in the intro                                                                                                  |
| `docs/traits.md`                               | saves section rewritten with the evidence; eligibility, bands, constants, observed-behaviour and limitations updated                                                         |
| `test/lib/server/rankings.shotStopper.test.js` | rewritten for the new semantics, 6 → 8 cases                                                                                                                                 |
| `test/lib/server/rankings.test.js`             | two-half norm arithmetic, rate-only fallback, per-trait band                                                                                                                 |
| `test/lib/shared/badges.test.js`               | `eliteBandFor` and per-trait popover wording                                                                                                                                 |
| `test/components/PlayerBadges.svelte.test.js`  | Elite band example moved to Finisher; new Shot Stopper case                                                                                                                  |

## Testing

`npm test` green — **1226 backend + 242 frontend**, 2 skipped. `npm run lint` clean.

The tests are integration-first where the point is what a real session file does to the counters.
Notable cases: an outfield week dilutes the rate half but not the volume half (the 2026-08-22
scenario, now costing a place rather than a badge); a cumulative total carries forward through a
missed session; a player who has never kept goal still gets a null rate and null norm despite a
non-zero divisor; Shot Stopper awards 6 Elite on a twenty-player ladder where Finisher awards 4.

Verified in the running app at `/rankings/Chris` (Elite Shot Stopper) and `/rankings/Lunathi`
(Elite Shot Stopper + Guardian, Sentinel correctly superseded), and on `/help/badges`, which
renders "Top 25%" for Shot Stopper against "Top 15%" for the rest.

## Assumptions and limitations

- **The volume half rewards attendance**, by design — it is what makes the league's highest-volume
  keepers visible. A keeper who joins mid-season is behind on that half for the rest of the year;
  the season reset bounds it.
- **"In goal" is still proxied by "recorded ≥1 save"**, since session files carry no keeper field.
  A shutout keeper stays invisible, and rotation within a session credits any player who made one
  save with a full session in goal. An explicit per-match keeper field would fix both, and would
  make the matches-in-goal form of this metric available — it ranks the same players (Spearman
  0.965) on cleaner inputs.
- **Keeper workload now feeds the Defence rating.** Keeping goal often is not itself defending.
  This was the chosen scope, on the grounds that the audit's "saves are nearly inert" finding
  (3.4% of Defence spread) was a symptom of the old input being noise. The weight is a single
  named constant (1 of 5.25) and retunable if team balance looks off.
- **`scripts/traits-report.mjs` is now stale** and marked as such in its header. Its `simulate()`
  models one scalar rate per stat divided by sessions in goal, banded at a single percentile, so
  its saves self-checks fail; the A/B/D options it compares were superseded by this decision. The
  other three stats still reproduce. Left alone deliberately, as `show-player-stats.mjs` was.
- **No data migration.** `loadEnhancedRankings()` serves stored ratings as-is, so other leagues
  keep their old numbers until a recalculation runs — automatically when a session is next
  scored, or via **Update Rankings** (`POST /api/rankings`). Local pirates data is recalculated.

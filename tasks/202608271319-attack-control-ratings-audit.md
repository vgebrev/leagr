# Attack / Control Ratings — Relevance Audit

Diagnostic report on how each player's Attack and Defence ratings are calculated, how much
of each rating comes from team performance versus individual stats, and what to change.

**Deliverable:** published Artifact — <https://claude.ai/code/artifact/d0941863-a160-400d-b1fd-693472874b90>
**Scope:** pirates 2026 (73 players, 39 established, 33 session dates through 2026-08-22).
**No production code was changed.** The two new files are read-only analysis tooling.

## Why this was asked

The composite formula in `calculateAttackControlRatings()` (`src/lib/server/rankings.js:1644`)
shipped in `24fc13d` on 2026-03-21 — two weeks after pirates began recording offensive,
defensive and save actions on 2026-03-07. The weights were chosen against roughly two sessions
of individual-stat data and had never been revisited against the 24 sessions now available.

The hypothesis under test: with richer stats now collected, is the individual component
underweighted?

## Findings

**The hypothesis is mostly wrong, and the real problem is elsewhere.**

1. **Individual stats already dominate.** Covariance-share decomposition of each rating's
   variance over the established pool: Attack is 92.8% individual (goals 52.8%, offensive
   actions 40.1%, team GF only 7.2%). Defence is 77.6% individual (defensive actions 76.1%,
   saves 1.5%, team GA 22.4%).

2. **But team inputs inflate the number without informing it.** Team results supply ~28% of
   Attack's and ~29% of Defence's _value_ while explaining 7% and 22% of the _spread_. They
   contribute level, not differentiation. Two established players (Caesar's Attack, Pat's
   Defence) are entirely team-derived because every one of their own stats normalises to zero.

3. **Neither rating predicts a session.** Using the leak-free draw-time snapshots in
   `drawHistory.initialPots[].players[]` across 99 team-sessions since 2026-03-07:
   `corr(team mean Attack, goals scored) = 0.005`; `corr(team mean Defence, goals conceded) = −0.196`;
   ELO manages `0.173` against goals scored under identical conditions. Within-session Kendall τ
   is indistinguishable from zero for every measure (s.e. ≈ 0.09), so this is "not demonstrated",
   not "disproven" — the balancer's own equalisation compresses the spread the test needs.

4. **`?? 0` on a missing norm is a bug, not a redistribution** (`rankings.js:1826-1827`). A
   missing input contributes zero while its weight stays in the denominator, so an unmeasured
   stat scores as failure at it. 13 of 73 players are affected; renormalising the denominator
   moves Angelo +0.564 Defence, Batandwa +0.191. Pat — established, 37 season games — sits at
   0.021 Defence purely from this.

5. **Min–max normalisation is the dominant distortion.** Individual stats are right-skewed
   (goals/session 0.22–4.52, median 1.11 → median normalises to 0.21) while team stats are
   near-symmetric (team GF 7.17–10.81 → median 0.44). Per unit of weight the team inputs
   therefore deliver _more_ dispersion than the nominal weights imply. This is also why
   `PlayerRatings.svelte` needs `gamma = 0.45`: raw Attack averages 0.268.

6. **Secondary observations.** `corr(goalsNorm, offActionsNorm) = 0.878` — Attack's two
   individual inputs are largely one construct. Team inputs are attendance-biased
   (`corr(appearances, |teamGANorm − 0.5|) = −0.54`). Ratings are season-cumulative with no
   decay, unlike ELO.

## The de-risking result

Trait tiers are **nearest-rank percentiles over the same `*Norm` values**, so any change that
preserves player order leaves every tier untouched. Simulated across all five options:
**zero badges change hands.** Weight and normalisation changes are contained to the ratings
and the team balancer.

## Recommendations (simulated, not applied)

|     | Change                                        | Attack mean   | ρ vs today  | Individual weight |
| --- | --------------------------------------------- | ------------- | ----------- | ----------------- |
| R1  | Renormalise denominator over available inputs | 0.268 → 0.274 | 0.994       | 83% / 73%         |
| R2  | Percentile normalisation instead of min–max   | 0.268 → 0.404 | 0.969       | 83% / 73%         |
| R3  | Defence: saves 0.5→1.0, team GA 1.5→0.75      | —             | 0.919 (Def) | 83% / 86%         |
| R4  | Attack: team GF 1→0.6                         | 0.268 → 0.266 | 0.985       | 89% / 73%         |
| —   | All four combined (**recommended**)           | 0.268 → 0.402 | 0.954       | 89% / 86%         |

R1 is a prerequisite: tuning weights before it means tuning against an artefact.

**Knock-on to handle if applied:** wider ratings widen team-average gaps. On the rosters
actually drawn this season the mean Defence delta goes 0.099 → 0.132, so `RATING_DELTA_CAP`
(`teamGenerator.js:835`, currently 0.2) becomes ~33% stricter and should rise to about 0.27,
or the balancer will over-weight attack/defence balance against ELO and pairing novelty.

**Not recommended yet:** a recency window replacing the season-cumulative average. It is where
the predictive-validity evidence points, but it is a much larger change.

## Files

`scripts/` is gitignored (`.gitignore:38`), so both files are local analysis tooling that lives
alongside `scripts/traits-report.mjs` rather than being committed. This document is the
checkable record.

- `scripts/ratings-report.mjs` — read-only offline recomputation and simulator. Mirrors
  `calculateAttackControlRatings()` including all three passes, imports `BASE_PERCENTILE` /
  `ELITE_PERCENTILE` from `$lib/shared/badges.js` rather than copying them. Follows the pattern
  of `scripts/traits-report.mjs`.
  Usage: `node scripts/ratings-report.mjs [leagueId] [year] [outFile]`; set `DUMP_MODEL=<path>`
  to also write the raw model JSON.
- `scripts/ratings-report-template.mjs` — renders the model as an Artifact-ready HTML body.

## Verification

The script refuses to emit a report unless four self-checks pass, so a drift between the mirror
and `rankings.js` fails loudly rather than producing a plausible wrong report:

1. Reproduced norms match the persisted `*Norm` values (max drift 0.00059 — stored-rounding only).
2. The composite rebuilt from persisted norms matches the persisted rating (max drift 0.00091),
   and rebuilt from recomputed rates matches to 0.00052.
3. Variance shares sum to 1 per rating (residual < 1e-3, pure 3dp rounding).
4. The simulator's no-change baseline reproduces the shipped ratings, and rebuilt trait tiers
   match every persisted `traitTiers` value.

`npm test` — 1179 backend + 241 frontend passing; no production code touched.
`npm run lint` — clean.

## Assumptions and limitations

- The predictive-validity test applies a session's draw-time ratings to that session's results.
  It is leak-free but underpowered: 4 teams per session, 25 sessions, τ s.e. ≈ 0.09.
- Team-balance impact applies _today's_ ratings to _past_ rosters. It answers whether
  `RATING_DELTA_CAP` stays calibrated, not what would have been drawn.
- Normalisation bounds are reproduced from player-level season totals at the latest date rather
  than replayed per date; verified equivalent to within stored rounding (check 1).
- `data/pirates` is the only league with real data; `unclaimed1` and `smoke-reunion-test` have none.

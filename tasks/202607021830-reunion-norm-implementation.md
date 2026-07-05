# Reunion Norm — Dynamic Pairing Novelty for Overdue Pairs

**Date:** 2026-07-02

## Overview

The pot-seeding structure plus the ELO-spread objective systematically starve certain
player pairings: two players in the same pot share a team at only ~1/7 odds under a fair
draw (vs ~1/4 cross-pot), and the balance objective further prefers complementary
(high+low) picks within a pot. For permanently ELO-adjacent players (e.g. the pot-0
top seeds Dan & Veli: 1 pairing in 12 months, 0 in 2026 over 19 co-attendances) this
compounds into a statistically significant no-pairing scenario.

This change adds a **reunion norm**: the generator detects statistically starved
("overdue") pairs and softly rewards draws that put at least one of them on the same
team, while all existing hard constraints (pairing limit, hard ELO delta cap) still apply.

## How it works

1. **Overdue detection** (`teammateHistory.js`): a pair is overdue when they never shared
   a team in the detection window despite co-attending so often that zero pairings is
   improbable. Per co-attended session the null probability of sharing a team is
   `Σ s_j(s_j−1) / N(N−1)` (pot-blind by design — pot bias is part of what's being
   corrected). Pair qualifies when the product of "not paired" probabilities < alpha.
    - Window: **15 sessions**, alpha: **0.1** (set in `teamGenerationContext.js`).
      At current attendance this flags 2 pairs: Lunathi & Morena (P=0.042), Dan & Veli (P=0.086).
2. **Reunion norm** (`teamGenerator.js`): `calculateReunionScoreNormalized` returns 0 when
   at least one attending overdue pair shares a team (or none attend), 1 when overdue
   pairs attend but all stay split. Weighted `W_REUNION = 0.4` in
   `calculateNormalizedScore`, active **only when an overdue pair attends** — scores are
   bit-identical to previous behaviour otherwise.
3. **Rotation**: satisfying any one pair is enough; reunited pairs gain a pairing and drop
   out of the overdue set on the next draw, so the backlog drains week by week.

## Files modified

- `src/lib/server/teammateHistory.js` — added `computeOverduePairs` (pure) and
  `findOverduePairs` (loads sessions, honours `sessionLimit`/`alpha`/`beforeDate`).
- `src/lib/server/teamGenerator.js` — `overduePairs` state + `setOverduePairs` fluent
  setter; `hasAttendingOverduePairs`; `calculateReunionScoreNormalized`; `reunionNorm`
  in `calculateNormalizedScore` (W=0.4, conditional); reunion outcome in `logDrawInfo`.
- `src/lib/server/teamGenerationContext.js` — builds `overduePairs` alongside teammate
  history (seeded draws only, `beforeDate` = session date to avoid redraw contamination).
- `src/routes/api/teams/+server.js`, `src/routes/api/teams/auto-assign/+server.js` —
  pass `.setOverduePairs(overduePairs)`.

## Testing

- `test/lib/server/teammateHistory.test.js` — 9 tests: significance math, alpha
  handling, paired exclusion, sorting, degenerate inputs, sessionLimit/file skipping.
- `test/lib/server/teamGenerator.reunion.test.js` — 10 tests: setter, reunion score
  cases (absent/split/together/multiple), calculateNormalizedScore integration incl.
  bit-identical baseline when no overdue pairs.
- `test/manual/reunionNorm.smoke.test.js` — env-gated smoke test on real data
  (`SMOKE=1 npx vitest run --config vitest.config.js test/manual/reunionNorm.smoke.test.js`).
  Result replaying 2026-06-27 (20 draws): **19/20 reunions satisfied vs 1/20 baseline**;
  avg eloDelta 21.2 vs 15.3 baseline (hard limit 86); Dan & Veli reunited in 4/20 draws
  head-to-head with Lunathi & Morena in the set.
- Full suite: 821 backend + 77 frontend tests pass.

## Related analysis tooling (same session)

- `test/manual/analyze-teammate-history.js` — rewritten: per-session hard-constraint
  pressure (rebuilds history with `beforeDate` as the generator saw it) + HTML report
  (`teammate-pairing-report.html`).
- `test/manual/analyze-pairing-bias.js` — ELO/pot bias detection: actual pairings vs
  fully-random and pot-respecting null models, rank-gap fingerprint, HTML report
  (`pairing-bias-report.html`).

## Refinement (2026-07-03)

Two issues surfaced in manual draw testing (Dan & Veli fired ~1/20):

1. **Calendar-window evidence erosion**: a missed session (injury) pushed old
   co-attendances out of the 15-session window, dropping a chronic pair below alpha.
   Fixed by counting evidence per pair over their own **most recent co-attendances**
   (`coAttendanceLimit: 15`), bounded by a **40-session** staleness lookback, alpha
   back to **0.05**. Absences neither add nor erode debt. A pairing older than the
   pair's recent co-attendance window no longer clears the debt.
2. **Binary "any pair satisfies"**: the cheapest reunion always won the head-to-head.
   Replaced with **weighted fractional credit**: each attending overdue pair
   contributes weight `-ln(probNone)`; score = `1 − satisfiedWeight/totalWeight`.
   Reuniting all pairs scores 0; the most starved pair wins tiebreaks.

Current overdue list (before 2026-07-04): Dan & Veli (P=0.025), Lunathi & Morena
(P=0.026), Prosper & Wayne (P=0.041), Brent & Veli (P=0.048).

Smoke on the 2026-07-04 set (20 draws): Dan & Veli reunited **9/20** (was 4/20
binary, ~1/20 observed pre-fix), Lunathi & Morena 18/20, both pairs together in 7
draws; avg eloDelta 21.6, max 44.4 (cap 86).

**Note:** an apparent 2026-06-27 file discrepancy during testing turned out to be a
stale local dev edit (Veli added locally); the live data legitimately has no Veli on
06-27 due to injury — that very absence is what dropped Dan & Veli below alpha under
the old calendar-window detection, motivating the per-pair co-attendance window.

## Assumptions & limitations

- Alpha 0.1 / 15 sessions is tuned to current attendance patterns (~13+ co-attendances
  needed at 0.05; regulars who miss weeks land ~0.06–0.1). Revisit if the list grows
  beyond ~3 pairs.
- The norm is soft: if no balanced reunion draw exists under the hard ELO cap that week,
  the reunion just doesn't happen and is retried next week.
- `logDrawInfo` reports reunion satisfaction from pre-swap-optimizer metrics; the swap
  optimizer can only improve it (it uses the same score).

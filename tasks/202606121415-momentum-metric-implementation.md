# Momentum ("Form") Metric Implementation

Implements the ADR in `tasks/202606091200-ADR-momentum-metric.md`. Full as-built
documentation (signal math, substrates, badge rules, config, API shape, deploy note) lives in
**`docs/momentum.md`** — this file records the implementation summary per the standard
workflow.

## Overview

- Signed (−1..1) self-relative momentum per player on two boards: Champions Hall (placement
  substrate) and Ballers Board (contribution substrate), rendered as a **Form** tab next to
  each existing board.
- MACD-style fast/slow EMA divergence, scaled by own MAD (league-pooled fallback below
  `minSessions`), calendar-time staleness cooling, tanh squash, cold-start damping with
  provisional treatment.
- Streak badges layered on top: Double/League/Cup/Silverware + Wooden Spoon (Champions, with
  prestige subsumption), and all five Stars of the Day categories (Ballers). Strict
  consecutive streaks, ≥ 2, breaking only on a below-threshold _observed_ session.
- Display-only: no changes to team generation, balancing or elo computation.

## Key architecture decisions

1. **No new store** — momentum is recomputed at render time in the two board GET endpoints
   from `history` in `rankings-YYYY.json` (itself rebuilt-from-sessions derived data).
   Staleness depends on "now", so persisting EMA state would be stale by render anyway.
2. **One additive data field** — raw per-session `stats` in history entries (rankings.js);
   running averages already stored can't be reliably differenced back. Backfill = existing
   POST `/api/rankings` rebuild.
3. **Team count N derived, not stored** — max unique `leaguePosition` per date across players
   (verified unique via `getStandings` tie-breaking), distinct team names as fallback.
4. **Gain constant 1.5** on the EMA divergence, calibrated empirically against the real
   pirates 2026 season (gain 3 saturated half the active board). One comeback week reads
   ~0.6; a sustained run saturates.
5. **Tracking-regime rule for Ballers** — the substrate uses only the stat types tracked in
   the latest session, over sessions that tracked all of them. Found via real-data smoke
   test: goals-only tracking before March made the post-March full-tracking volume read as
   league-wide heat.
6. **Momentum only for the current year** — yearly-reset convention; past years/`all` omit it
   and the Form tab hides.

## Files

See the table in `docs/momentum.md`. New: `momentum.js`, `MomentumBoard/MomentumBar`
components, two icons, `MomentumSettings` settings section, 65-case test file. Modified:
rankings.js (additive), defaults/types, two API endpoints, two board pages, settings page.

## Testing

- `test/lib/server/momentum.test.js`: 63 tests including the ADR worked comeback example
  (4 last places then 0.875 → strongly positive, tops the board), champion-stays-flat,
  staleness, cold start, MAD fallback, streak/subsumption scenarios, tie handling, legacy
  entries without stats.
- Full suite: 782 backend + 77 frontend tests pass; lint and production build pass;
  svelte-check error count below the pre-change baseline (no new type errors).

## Assumptions / limitations

- Ballers streak ties count as wins for all tied players (in-day game-sequence tie-break not
  reconstructable from per-session totals).
- January cold start: handled by damping + league-fallback `k`; no cross-year EMA carry-over.
- Rankings rebuild (POST `/api/rankings`) needed once per league post-deploy to backfill the
  `stats` field; pre-tracking sessions are skipped as Ballers observations.

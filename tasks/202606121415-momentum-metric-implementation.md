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
- Streaks layered on top: Champions render the actual trailing trophy run (per-session
  columns, doubles stacked) + an independent Wooden Spoon; Ballers render the five Stars of the
  Day categories as independent per-award rows. Strict consecutive streaks, ≥ 2, breaking only
  on a below-threshold _observed_ session. (See the 2026-06-18 follow-up below — this replaced
  the original prestige-subsumption badge model.)
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

## Follow-up — Form board refinement (2026-06-18)

Post-pilot polish of the Form tab UX; see `docs/momentum.md` for the as-built detail.

1. **Streak visual redesign.** Dropped the abstract "silverware = any trophy" badge and the
   prestige-subsumption logic. Champions now show the literal trailing run as one column per
   session (a double stacks crown over trophy, columns vertically centred); Ballers show each
   active award as its own row of repeated icons (supports genuine concurrency, e.g. MVP +
   Brick Wall). Runs draw literal icons up to `STREAK_CAP` (6), then collapse to `icon ×N` —
   single icon for Ballers, **per-type** (👑 ×league, 🏆 ×cup) for Champions so the trophy
   distinction survives. Server change: `championsTrophyStreak()` emits
   `trophyStreak: [{league, cup}, …]` + `woodenSpoonStreak`, replacing `selectChampionsBadges`.
2. **Audience filtering.** Provisional (<5 sessions) players are always hidden from the Form
   board (absorbs the old provisional pill); a default-on **"Regular players only"** toggle
   (≥2 observed sessions in the last 2 months, client-side from `series`) mirrors the Rankings
   active filter.
3. **Presentation.** Form board is now a transparent, panel-less table matching the main board
   tables (tab content panel set `bg-transparent dark:bg-transparent`); compact tab padding;
   Streak column auto-width with the Form/bar column absorbing remaining space.
4. **Shallow-routing tabs.** Tab selection lives in history state (`pushState('', { formTab })`
   with `page.state`, like the team/player modals) so back/forward toggles the Form tab;
   `App.PageState.formTab` added in `src/app.d.ts`.

Tests: `momentum.test.js` now 62 cases — the badge-subsumption suite was replaced by
`championsTrophyStreak` sequence tests and the new `trophyStreak`/`woodenSpoonStreak` board
assertions. The streak/filter/routing UI changes are presentation-only (no component tests).

# Balance-Aware Auto-Assign

## Overview

Adds balance-aware auto-assignment for the common "someone cancelled / joined after the
draw" scenario, replacing manual swap-and-randomise with a one-tap action that keeps teams
balanced and evenly sized.

Three entry points, all driven by the team balance scorer already used for draws:

1. **Per-player "Auto-assign"** — new item in the waiting/unassigned player action menu.
   Places that player into the best team. Equal team sizes take precedence over absolute
   balance: only the smallest eligible teams are considered, then the one giving the best
   balance score wins (ELO delta breaks ties).
2. **Per-team "Auto-assign"** — repurposed the old empty-slot "Auto-assign first available"
   (which just grabbed the first candidate). It now picks the best-balanced available/waiting
   player for that team.
3. **"Auto-Assign All"** — admin-only button on the Teams page. Distributes candidates
   **waiting-list first, then unassigned** across teams up to the player cap, filling the
   smallest team each step.

## Architecture Decisions

- **Reuse the draw scorer.** All three modes call `TeamGenerator.calculateNormalizedScore`
  (ELO balance, pairing novelty, attack/defence, traits), so auto-assign stays consistent
  with how draws are judged. New planning methods are pure (no I/O) and operate on player-name
  arrays, with `null` slots stripped before scoring.
- **Equal-sizing before balance.** `findBestTeamForPlayer` restricts candidates to the teams
  with the fewest current players (counting non-null slots) that are still below
  `maxPlayersPerTeam`, then scores only those.
- **Greedy bulk planning.** `planAutoAssignAll` walks the ordered candidate list, placing each
  into the current best/smallest team, honouring the player cap and max-per-team. Scoring range
  is computed once from the full involved pool for consistency.
- **One new endpoint, three modes.** `POST /api/teams/auto-assign` branches on the body:
  `{ playerName }` → best team (player mode), `{ teamName }` → best player (team mode),
  `{}` → bulk all (admin-gated via `locals.isAdmin`). Mirrors the existing draw endpoint's
  validation (league, date, competition-not-ended).
- **Atomic application.** Bulk assignment uses a new `PlayerManager.assignManyToTeams` that
  applies every `movePlayerToTeam` inside a single `executeTransaction` (mutex + atomic
  `setMany`), so the batch succeeds or fails as a whole and respects the cap/promotion rules.
- **Shared context extraction.** Rankings + previous-year rankings (avatar-merged) + teammate
  history loading was duplicated; extracted into `buildTeamGenerationContext` and reused by both
  `POST /api/teams` and the new endpoint.

## Files Modified

- `src/lib/server/teamGenerator.js` — extracted `sortEstablishedPlayers` / `prepareAnchors`
  (refactored out of `generateSeededTeams`); added `stripEmptySlots`, `poolEloMetrics`,
  `resolveScoringRange`, `findBestTeamForPlayer`, `findBestPlayerForTeam`, `planAutoAssignAll`.
- `src/lib/server/teamGenerationContext.js` — **new** shared context loader.
- `src/routes/api/teams/+server.js` — refactored to use `buildTeamGenerationContext`.
- `src/routes/api/teams/auto-assign/+server.js` — **new** endpoint (player/team/all modes).
- `src/lib/server/playerManager.js` — added `assignManyToTeams` (atomic multi-assign).
- `src/lib/client/services/teams.svelte.js` — added `autoAssignPlayer`, `autoAssignToTeam`,
  `autoAssignAll` (+ shared private helpers). The old client-side "first available" shortcut is
  retired in favour of the balance-aware server path.
- `src/routes/teams/components/TeamTable.svelte` — "Auto-assign" item in the player menu;
  empty-slot action repurposed to balance-aware; new `onAutoAssign` / `onAutoAssignToTeam` props.
- `src/routes/teams/components/TeamsGrid.svelte` — threads the new props through.
- `src/routes/teams/+page.svelte` — wires handlers; admin-only "Auto-Assign All" button.

## Testing

- `test/lib/server/teamGenerator.autoAssign.test.js` — **new** (9 cases): min-size-before-balance,
  best-balance among equal teams, null-slot counting, max-capacity null return, best-player-for-team,
  even distribution, cap + waiting-first ordering, stop-at-max.
- `test/lib/server/playerManager.test.js` — added `assignManyToTeams` cases (atomic single save,
  waiting-list promotion, whole-batch rejection on invalid assignment).
- Full backend suite (801 passing) + lint + production build verified green.

## Assumptions / Limitations

- Per-player and per-team modes follow existing manual-assign gating (client `canModifyList`,
  no server ownership enforcement). Only the bulk "all" mode is server-enforced admin-only.
- Greedy (not globally optimal) bulk placement — consistent with the iterative draw algorithm
  and fast enough for session-sized pools.
- "Auto-Assign All" pulls waiting-list players ahead of unassigned (product decision: people who
  have been queuing get first claim on open slots).

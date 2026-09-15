# Fix: every team player also listed under "Unassigned Players"

## Overview

Manual regression testing after the `npm run check` cleanup
(`202609140947-typecheck-clean-implementation.md`) found the Teams page listing every
drawn player a second time under **Unassigned Players**. Reproduced on pirates
`2026-09-12`: all 24 available players were assigned across four teams, and all 24 also
appeared as unassigned.

The API response was correct. `/api/teams` returns the full `players.available` list by
design — the client is what subtracts the players already in a team, and that subtraction
had stopped matching.

## Root cause

`getAllDataWithElo()` enriches every roster slot, so a team the client holds is
`Record<string, Array<PlayerWithElo | null>>` — objects, not names. The client's `teams`
field was annotated `TeamsData` (`Array<string | null>`), which is the _stored_ shape, not
the served one.

With that annotation, `player.name` in the unassigned derivation was a type error (the
non-string branch of the ternary narrows to `never`), and commit `f556f40` cleared it by
collapsing the ternary:

```js
const playerName = typeof player === 'string' ? player : player; // was: player.name || player
```

So the "assigned" set filled with player _objects_ while the filter tested against player
_names_ — nothing ever matched, and every available player fell through as unassigned. The
type was wrong first; the type error was then resolved in the direction the (wrong) type
implied.

Commit `900ec1a` made the same substitution in `TeamTable.svelte`, from the same wrong
`allTeams?: TeamsData` annotation, pushing roster objects into the `string[]` used for the
rename modal's duplicate-name check. That one is fixed here too — it is the same bug, and
it would have silently allowed a rename onto a teammate's name.

## Files modified

| File                                            | Change                                                                                                                                                                                                                                  |
| ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/shared/domain.d.ts`                    | New `EnhancedTeamsData` — teams as the client receives them, with `PlayerWithElo` in each slot                                                                                                                                          |
| `src/lib/client/services/teams.svelte.js`       | `teams` retyped to `EnhancedTeamsData`; unassigned derivation matches on `player.name`; `removePlayer`'s team auto-detect uses `roster.some((p) => p?.name === name)` instead of `roster.includes(name)` (same object-vs-name mismatch) |
| `src/routes/teams/components/TeamTable.svelte`  | `allTeams` retyped; `allPlayers` collects `player.name`                                                                                                                                                                                 |
| `test/lib/client/services/teams.svelte.test.js` | Regression tests + fixtures corrected to the shape the API actually returns                                                                                                                                                             |

The `$state(new Set())` inside the derivation went with it. It was there to silence
`svelte/prefer-svelte-reactivity`, and reactive state does not belong inside a `$derived`;
the assigned names are now a plain array, which the rule does not flag.

## Why the suite did not catch it

Every team fixture in `teams.svelte.test.js` used bare-name rosters
(`'Team A': ['Alice', 'Bob']`), so the collapsed ternary still produced a name and every
assertion passed. The fixtures now build rosters through a small `roster()` helper that
emits `{ name, elo }` objects, matching `getAllDataWithElo()`.

Two tests also stubbed `unassignedPlayers` on the shared `teamsService` singleton with
`Object.defineProperty` and never restored it, so the stub leaked into every later test in
the file. Both stubs were redundant (the derivation already yields `[]` with no available
players) and are removed.

## Testing

- New `unassignedPlayers` describe block: enriched rosters exclude assigned players; an
  undrawn session still lists everyone. The first test fails on the old code with exactly
  the reported symptom (`['Alice','Bob','Charlie','Dave']` where `['Dave']` was expected).
- `npm test` — 1351 passed + 1 skipped (backend), 323 passed (frontend).
- `npm run check:ci` — 2281 files, 0 errors, 0 warnings. `npm run lint` clean.
- Verified in the running app via headless Chrome (CDP), both directions:
    - `2026-09-12` (all 24 assigned) — four team tables, no Unassigned section.
    - `2026-05-23` (Thabo unassigned) — Unassigned Players lists exactly Thabo.

## Limitations

- `TeamsData` remains correct for the stored shape and for `/api/games`, which serves raw
  session teams; only the teams-page path is `EnhancedTeamsData`.
- The `TeamTable` duplicate-name fix has no component test — the component pulls in the
  settings store, Flowbite and the avatar endpoints, and no TeamTable test harness exists
  yet. It is covered by type correctness and manual use of the rename modal.

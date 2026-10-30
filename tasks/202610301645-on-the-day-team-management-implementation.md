# On-the-day team management by players

## Overview

Low turnout often means players have to be shuffled between teams on the day, and with no
admin on site that meant messaging an admin to do it remotely. Player menus on the Teams page
are now relaxed so anyone present can manage the teams:

| Item                 | Who can use it               |
| -------------------- | ---------------------------- |
| Move to [team]       | Everyone (after teams drawn) |
| Auto-assign (lists)  | Everyone (unchanged on API)  |
| No-show (team rows)  | Everyone                     |
| Rename / Remove      | Player owner or admin        |
| Move to waiting list | Player owner or admin        |

"Move to [team]" now appears on team-row menus too (moving a player between teams), not just
on the Unassigned / Waiting List menus.

## Architecture decisions

- **Per-item permissions, not per-menu.** The dropdown used to be disabled wholesale for
  non-owners. It is now enabled whenever the list is modifiable and at least one item is
  usable; restricted items are shown but disabled (`PlayerAction.disabled`), so it stays clear
  the action exists.
- **Team-to-team moves reuse `POST /api/teams/players`.** `assignPlayerToTeam` (formerly
  `fillEmptySlotWithPlayer`) takes the player off the old team and then places them via
  `PlayerState.movePlayerToTeam`, in one transaction. `movePlayerToTeam` itself
  still rejects assigned players, so auto-assign and `assignManyToTeams` keep their guard. The
  endpoint never enforced ownership for assignment, so only the UI was holding this back.
- **`no-show` is a first-class action in `removePlayerFromTeam`.** It removes completely like
  `remove` but skips `#ensureOwnerOrAdminSync`. The DELETE endpoint passes it through instead
  of rewriting it to `remove`; when the league has discipline disabled (no No-show item in the
  UI) it falls back to `remove` so a hand-crafted request cannot use it to bypass ownership.
- **Moves respect the league's team-size limits.** A team-to-team move is rejected if it
  would take the old team below `minPlayersPerTeam`, and `movePlayerToTeam` rejects a team
  already at `maxPlayersPerTeam`. The menus mirror both rules: no "Move to [team]" items when
  leaving would breach the minimum, and teams at the maximum aren't offered.
- **No more empty slots.** Removals (Remove, No-show, Move to waiting list, from either page)
  used to replace the player with `null`, leaving an "Empty" row with its own fill-this-team
  menu. Rosters now hold players only:
    - every removal drops the entry instead of nulling it, and assignment always appends;
    - stored sessions may still contain nulls, so a module-level `withoutEmptySlots` strips them
      in the `PlayerState` constructor (the next save of any transaction writes the roster back
      clean) and in `getTeamsWithElo` / `getAllDataWithElo`, so the client never sees one;
    - `EnhancedTeamsData` is now `Record<string, PlayerWithElo[]>`; `TeamsData` keeps `| null`
      because it describes what is on disk;
    - the "Empty" row's menu (per-team Auto-assign plus a player picker) is gone, along with
      `teamsService.autoAssignToTeam` and the `onAutoAssignToTeam` prop chain. The list menus'
      per-player Auto-assign and "Move to [team]" cover it. The auto-assign API's `teamName`
      mode is kept but no longer used by the UI.
    - The draw replay still shows "Empty" placeholders: it pre-sizes each team and fills them
      bottom-up as part of the animation, independent of stored data.
- **Disabled items are muted** (`opacity-50`, not-allowed cursor, no hover highlight) in
  `PlayerActionsDropdown`, matching a disabled menu trigger. Flowbite's `DropdownItem` sets the
  `disabled` attribute but has no disabled styling of its own.
- **No-show is confirmed in a modal** before it fires. It is open to everyone and hard to undo:
  a suspended player needs an admin to re-register.
- **Move to waiting list stays restricted** — it frees a spot, which is the prank the
  ownership model exists to prevent. No-show stays on team rows only.

## Files modified

- `src/lib/server/playerManager.js` — `removePlayerFromTeam` accepts `'no-show'` (no ownership
  check); `assignPlayerToTeam` (renamed) moves already-assigned players between teams;
  `withoutEmptySlots`; removals drop roster entries; null handling removed.
- `src/routes/api/teams/auto-assign/+server.js` — follows the rename.
- `src/lib/shared/domain.d.ts` — `EnhancedTeamsData` has no null entries.
- `src/lib/client/services/teams.svelte.js`, `src/components/TeamModal.svelte` — null filters
  removed; `autoAssignToTeam` removed.
- `src/routes/teams/+page.svelte` — `onAutoAssignToTeam` wiring removed.
- `src/routes/api/teams/players/+server.js` — DELETE passes `no-show` through (or `remove`
  when discipline is disabled).
- `src/routes/teams/components/TeamTable.svelte` — `canManage`, `moveActions`, `anyEnabled`
  helpers; team rows gain "Move to [team]"; list items relabelled "Move to [team]"; restricted
  items disabled per item; No-show confirmation modal; Empty-row menu removed.
- `src/components/PlayerActionsDropdown.svelte` — muted styling for disabled items.
- `src/routes/teams/components/TeamsGrid.svelte` — team tables receive `allTeams` so they can
  list move targets; `onAutoAssignToTeam` removed.

## Testing

- `test/lib/server/playerManager.test.js` — "on-the-day team management by non-owners": move
  between teams, assign an unowned waiting player, same-team and full-team rejections (no
  save), min-size breach on the old team, no-show by a non-owner, remove / move-to-waiting
  still refused.
- `test/lib/server/playerState.test.js` — removals drop entries; the constructor strips stored
  nulls; fixtures are null-free.
- `test/lib/server/playerManagerIntegration.test.js` — a session file with null slots is
  written back clean on its next save; fixtures are null-free.
- `test/lib/server/rankings.yearBoundary.test.js` — a stored null never reaches the client.
- `test/lib/client/services/teams.svelte.test.js` — fixtures are null-free.
- `test/routes/teams/components/TeamTable.svelte.test.js` (new) — menu contents and enabled
  state for non-owner, owner, admin, locked list, and lists; No-show confirm and cancel; uses
  `PlayerActionsDropdownStub.svelte` to render items flat instead of driving Flowbite's popover.

## Limitations

- Only moves are checked against the minimum. Move to waiting list, Remove and No-show can
  still take a team below it, as before (an absentee is gone whether or not the team is valid).
- Anyone with the league access code can now move players between teams or mark them as
  no-shows. Accepted trade-off; no audit trail of who did it.
- Not verified in a running browser; covered by component and manager tests.

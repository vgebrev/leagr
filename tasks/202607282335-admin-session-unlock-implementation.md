# Admin "Unlock Session" — post-session data fixes in-app

**Date:** 2026-07-28

## Overview

Sessions become read-only once the competition end time passes. In the 2026-07-25 session a player
dropped out of a team but wasn't removed before the cut-off, and the only remaining fix was
hand-editing `data/pirates/2026-07-25.json` on the server.

This adds an **admin-only, explicitly-toggled unlock** so post-session corrections can be made
through the app: team membership, player list, league scores and scorers, the match page, and
knockout.

Scope decisions:

- The bypass applies to the **competition-end** gate only. The registration-**open** gate still
  applies to everyone, admins included.
- The unlock is **explicit**. A closed session stays read-only for an admin until they actively
  unlock it, and a page reload re-locks.
- Coverage is every surface the competition-end gate touches (all 10 server checks + their UI).

## Architecture decisions

### 1. The toggle is enforced end-to-end, not cosmetic

The client sends an `x-admin-unlock` header only while the toggle is on. Without the header the
server behaves exactly as before, so a stale admin tab cannot silently mutate a closed session. Being
an admin is necessary but not sufficient.

### 2. The header carries the unlocked date, not a boolean

`getAuthHeaders()` in the api-client is global — every request from the tab gets the same headers, and
a boolean would mean "unlock whatever date this request happens to target", leaking to cross-date
fetches. All gated endpoints already validate a `date` query param, so the server compares the header
date to the request date and the header becomes self-scoping. A tab unlocked for `2026-07-25` cannot
modify `2026-07-18`.

### 3. Unlock state is in-memory only

`sessionUnlock.unlockedDate` is a module `$state` singleton with no persistence. A reload, a new tab,
or picking a different date in the DateSelector (which does a full page navigation) all re-lock. This
also means the `x-admin-unlock` header cannot outlive the tab.

### 4. `teamsService.isLocked()` is a method, not a `$derived`

`test/lib/client/services/teams.svelte.test.js` stubs `isCompetitionEnded` with
`Object.defineProperty`, installing an accessor with no reactive signal behind it. A memoised derived
reading it would go stale in those tests; a method re-reads at call time.

### 5. `canModifyList` decomposed so the open gate can't leak

`playersService.canModifyList` previously conflated both ends of the registration window. It is now
`isRegistrationOpen && (!isCompetitionEnded || unlocked)`, keeping the open gate outside the unlock
disjunction. Behaviour when locked is unchanged across all four branches (window enabled/disabled ×
`currentDate` set/null), including the `isDateInPast` fallback.

## Files modified

### New

- `src/lib/client/services/sessionUnlock.svelte.js` — `sessionUnlock` singleton (`unlockedDate`,
  `isUnlocked`, `unlock`, `lock`) plus `isSessionLocked(date, settings)`, the canonical client-side
  read-only predicate.
- `src/components/SessionUnlockBanner.svelte` — admin-only banner; "Unlock to edit" when locked, a
  persistent warning + "Re-lock" when unlocked.
- `test/lib/client/services/sessionUnlock.svelte.test.js`

### Server

- `src/lib/shared/validation.js` — `validateCompetitionOperationsAllowed(dateString, settings,
adminUnlockDate = null)`; returns valid on an ended competition iff `adminUnlockDate ===
dateString`. The default keeps every existing 2-arg call working.
- `src/hooks.server.js` — parses `x-admin-unlock` into `locals.adminUnlockDate` (admin-only, must
  match `^\d{4}-\d{2}-\d{2}$`); adds `X-ADMIN-UNLOCK` to the CORS preflight allow-list.
- `src/app.d.ts` — `adminUnlockDate?: string | null` on `Locals`.
- 10 call sites now pass `locals.adminUnlockDate`: `api/players` (POST, DELETE, PATCH rename, PATCH
  move), `api/teams` (POST), `api/teams/players` (DELETE, POST), `api/teams/auto-assign` (POST),
  `api/games` (POST), `api/games/knockout` (POST).

### Client

- `src/lib/client/services/api-client.svelte.js` — injects `x-admin-unlock` when an admin code and an
  unlocked date are both present; exports `hasAdminCode()` for a _reactive_ admin-presence check.
- `src/lib/client/services/players.svelte.js` — `isRegistrationOpen` / `isCompetitionEnded` /
  `canModifyList` decomposition.
- `src/lib/client/services/teams.svelte.js` — `isLocked()` method; used by `canGenerateTeams` and the
  six write guards.
- `src/routes/+layout.svelte` — mounts `SessionUnlockBanner` for `/players`, `/teams`, `/games`,
  `/games/match`, `/knockout`.
- `src/routes/games/+page.svelte`, `src/routes/games/match/+page.svelte`,
  `src/routes/knockout/+page.svelte` — `isCompetitionEnded(...)` → `isSessionLocked(...)`, local
  renamed `sessionLocked`.
- `src/routes/teams/+page.svelte` — `canAutoAssignAll` uses `teamsService.isLocked()`.
- `src/routes/players/+page.svelte` + `components/RegistrationAlerts.svelte` — new `unlocked` prop
  suppresses the "can't add players after…" alert while unlocked.
- `src/routes/table/+page.svelte` — deliberately **unchanged**; its `isCompetitionEnded` call drives
  the winner celebration and must not react to an unlock.

## Testing

`npm test` → 903 backend + 158 frontend tests pass. `npm run lint` and `npm run build` clean.

New coverage:

- `validateCompetitionOperationsAllowed` — previously untested. Covers not-ended, ended without
  unlock, ended with a matching unlock, ended with a **different** unlock date (the scoping
  guarantee), the legacy 2-arg call, missing arguments, and the disabled-window fallback.
- `isCompetitionEnded` — previously untested, and the whole feature keys off it. Covers the enabled
  window either side of `endTime`, `endDayOffset`, custom end times, and the `isDateInPast` fallback.
- `sessionUnlock` — unlock/lock/date-mismatch and `isSessionLocked` across ended × unlocked.
- `playersService.canModifyList` — the real derived (not the suite's blanket mock), including
  **"stays closed before registration opens even when an admin unlocks"**, which pins the open gate.
- `teamsService` — `generateTeams` and `removePlayer` reach the API on an ended-but-unlocked session,
  and stay blocked when the unlock is for a different date.

Manual verification against the closed `2026-07-25` pirates session on a local dev server (session
file backed up and restored afterwards). `DELETE /api/teams/players` unassigning a player from a
team:

| Request                                   | Result                                                       |
| ----------------------------------------- | ------------------------------------------------------------ |
| no admin, no unlock                       | blocked — "Competition has ended. No modifications allowed." |
| admin, no unlock header                   | blocked (same)                                               |
| admin, unlock for `2026-07-18`            | blocked (same)                                               |
| non-admin, unlock header for `2026-07-25` | blocked (same)                                               |
| admin + unlock for `2026-07-25`           | **200** — player unassigned, persisted to the session file   |

## Assumptions and limitations

- **Rankings do not recalculate automatically.** `POST /api/rankings` is manual (the "Update Rankings"
  button on `/rankings`) and is not gated by competition-end, so a post-session fix leaves rankings
  stale until re-run. The unlocked banner says so explicitly.
- **No-show recording under unlock** can retroactively trip a suspension threshold. That is close to
  the intended use case; `recordNoShow` is idempotent per date and `DELETE /api/discipline` undoes it.
- **Team regeneration on an unlocked session** wipes teams and draw history for a completed session.
  Mitigated by the existing `canRegenerateTeams` setting and the persistent warning banner. A confirm
  dialog on the generate button while unlocked would be a reasonable follow-up.
- **The registration-open gate is client-only** — `validateCompetitionOperationsAllowed` never checked
  it server-side. This change preserves the client gate and neither widens nor closes that
  pre-existing hole.
- **Pre-existing bug surfaced during verification:** several endpoints call `return error(400, ...)`
  _inside_ a `try` block. SvelteKit's `error()` throws, so the endpoint's own `catch` swallows it and
  returns a generic 500 (e.g. `api/teams/players` responds "Failed to remove player from team" with
  status 500 instead of the competition-ended message). Not introduced here and not fixed here, but it
  means a locked-session rejection reads as a server error to the user.
- **`hooks.server.js` header parsing is not directly unit-tested** — `test/hooks.server.test.js`
  re-implements hook logic rather than importing it. The date regex matches the already-tested
  `validateDateParameter`, and the semantics are covered by the validator tests.
- The five components doing `Boolean(getStoredAdminCode(leagueId))` were left as-is per the
  minimal-change principle. `hasAdminCode()` is a one-line reactive drop-in for a follow-up.

# Team Draw Window + Admin Guard — Implementation Plan

**Date:** 2026-04-18  
**Status:** Plan (not yet implemented)

## Overview

Two new settings to prevent early team draws from spoiling the "dopamine hit" moment:

1. **Team draw opens** — a new time control (day offset + time) within `registrationWindow` that gates when the team draw button becomes functional. Default: 1 day before at 16:00.
2. **Team draw requires admin** — a boolean flag that causes the API to reject draws from non-admins. The button stays enabled; a notification is shown when a non-admin attempts the draw. Default: `false`.

---

## Settings Shape Changes

### `registrationWindow` (nested, existing object)

Add two fields:

```js
teamDrawDayOffset: -1,   // days before competition day (negative = before)
teamDrawTime: '16:00'    // time on that day when draw opens
```

These are only enforced when `registrationWindow.enabled` is `true`.

### Top-level `LeagueSettings`

Add one field:

```js
teamDrawRequiresAdmin: false;
```

Add `teamDrawRequiresAdmin` to `LEAGUE_ONLY_SETTINGS` in `defaults.js`.

---

## Files to Change

### 1. `src/lib/shared/types.js`

- Add `teamDrawDayOffset?: number` and `teamDrawTime?: string` to `RegistrationWindow` typedef.
- Add `teamDrawRequiresAdmin?: boolean` to `LeagueSettings` typedef.

### 2. `src/lib/shared/defaults.js`

- Add `teamDrawDayOffset: -1` and `teamDrawTime: '16:00'` inside `registrationWindow`.
- Add `teamDrawRequiresAdmin: false` to `defaultSettings`.
- Add `'teamDrawRequiresAdmin'` to `LEAGUE_ONLY_SETTINGS`.

### 3. `src/lib/shared/helpers.js`

Add a new exported function:

```js
export function isTeamDrawOpen(dateString, settings) {
    if (!dateString) return true;
    if (!settings?.registrationWindow?.enabled) return true; // no time controls = always open

    const dayOffset = settings.registrationWindow.teamDrawDayOffset ?? -1;
    const time = settings.registrationWindow.teamDrawTime ?? '16:00';
    const [hours, minutes] = time.split(':').map(Number);

    const drawOpenDate = new Date(dateString);
    drawOpenDate.setDate(drawOpenDate.getDate() + dayOffset);
    drawOpenDate.setHours(hours, minutes, 0, 0);

    return new Date() >= drawOpenDate;
}
```

### 4. `src/lib/shared/validation.js`

Add a new exported function after `validateCompetitionOperationsAllowed`:

```js
export function validateTeamDrawAllowed(dateString, settings, isAdmin) {
    if (settings?.teamDrawRequiresAdmin && !isAdmin) {
        return { isValid: false, error: 'Team draw requires admin privileges.' };
    }
    if (!isTeamDrawOpen(dateString, settings)) {
        return { isValid: false, error: 'Team draw has not opened yet.' };
    }
    return { isValid: true };
}
```

Import `isTeamDrawOpen` from helpers at the top of the file.

### 5. `src/routes/api/teams/+server.js` (POST handler)

After the existing `validateCompetitionOperationsAllowed` check (line ~113), add:

```js
const drawValidation = validateTeamDrawAllowed(
    dateValidation.date,
    gameData.settings,
    locals.isAdmin
);
if (!drawValidation.isValid) {
    // 401 (not 403) to avoid client-side logout redirect, matching settings API precedent
    return error(401, drawValidation.error);
}
```

Import `validateTeamDrawAllowed` in the imports at the top.

### 6. `src/routes/settings/components/CompetitionTimeControls.svelte`

Inside the `{#if leagueSettings.registrationWindow.enabled}` block, add the "Team draw opens" row **between** "Registration opens" and "Competition ends", reflecting the chronological order of events: registration open → team draw → competition ends.

```svelte
<div class="flex items-center gap-1">
    <span class="text-right">Team draw opens</span>
    <Input
        value={teamDrawDaysBeforeUI}
        onchange={(e) => onUpdateTeamDrawDayOffset(e.target?.value)}
        type="number"
        step={1}
        min={0}
        class="!w-16 shrink-0 !bg-gray-50 dark:!bg-gray-800"
        placeholder="1" />
    <span>days before, at</span>
    <Input
        bind:value={leagueSettings.registrationWindow.teamDrawTime}
        type="time"
        onchange={onSave}
        class="!w-22 shrink-0 !bg-gray-50 dark:!bg-gray-800"
        placeholder="16:00" />
</div>
```

Add a `$derived` for `teamDrawDaysBeforeUI`:

```js
let teamDrawDaysBeforeUI = $derived.by(() =>
    Math.abs(leagueSettings.registrationWindow.teamDrawDayOffset ?? 1)
);
```

Add `onUpdateTeamDrawDayOffset` to the props interface and destructuring.

Update the description text below to mention the draw window too.

### 7. `src/routes/settings/components/BehaviorToggles.svelte`

Add a new toggle at the end of the list:

```svelte
<Toggle
    classes={{ input: 'leagr-toggle-input' }}
    bind:checked={leagueSettings.teamDrawRequiresAdmin}
    onchange={onSave}>
    Require admin to draw teams
</Toggle>
```

Update the typedef comment at the top to document the new prop.

### 8. `src/routes/settings/+page.svelte`

- Pass `onUpdateTeamDrawDayOffset` callback to `<CompetitionTimeControls>`, following the same pattern as `onUpdateStartDayOffset` / `onUpdateEndDayOffset` (negating the value before storing).

---

## Behaviour Details

### Team draw window

- Only enforced when `registrationWindow.enabled` is `true`.
- Uses `teamDrawDayOffset` (default -1, i.e. 1 day before) and `teamDrawTime` (default 16:00).
- Before the window opens: API returns 401 "Team draw has not opened yet." → toast notification shown.
- After competition ends: existing `validateCompetitionOperationsAllowed` still blocks draws.

### Admin guard

- If `teamDrawRequiresAdmin` is `true`: non-admin draws rejected with 401 "Team draw requires admin privileges."
- The Generate Teams button is **never disabled** due to this setting (unlike `canRegenerateTeams`).
- The notification comes naturally from the existing error handler in `teamsService.generateTeams()`.

### No client-side guard needed

The `teamsService.generateTeams()` already has an error callback that calls `setNotification(err.message, 'error')`. The API error message propagates directly to the toast — no additional client-side logic is needed for the admin or draw-window checks.

---

## Testing

### New unit tests (mirror existing pattern in `test/` directory)

**`test/shared/helpers.test.js`** (or existing helpers test file):

- `isTeamDrawOpen` returns `true` when time controls disabled
- `isTeamDrawOpen` returns `true` when current time is after draw open time
- `isTeamDrawOpen` returns `false` when current time is before draw open time
- Defaults to offset -1 / time 16:00 when fields are absent

**`test/shared/validation.test.js`** (or existing validation test file):

- `validateTeamDrawAllowed` blocks non-admin when `teamDrawRequiresAdmin: true`
- `validateTeamDrawAllowed` allows admin even when `teamDrawRequiresAdmin: true`
- `validateTeamDrawAllowed` blocks when draw window not yet open
- `validateTeamDrawAllowed` allows when draw window is open and no admin requirement

**`test/api/teams.test.js`** (or equivalent):

- POST `/api/teams` returns 401 when draw window not open
- POST `/api/teams` returns 401 when `teamDrawRequiresAdmin: true` and no admin code
- POST `/api/teams` succeeds when admin code provided and `teamDrawRequiresAdmin: true`

---

## Assumptions & Limitations

- The draw window check (`isTeamDrawOpen`) shares the same `registrationWindow.enabled` toggle — there is no separate enable/disable for just the draw window. If time controls are off, the draw is always open.
- `teamDrawRequiresAdmin` has no effect on the client UI (button stays enabled); the guard is purely API-level, surfaced via notification.
- The 401 response code is used (not 403) because `handleAuthError` in the api-client only triggers the logout/redirect flow on 403 — 401 just propagates the error message to the notification toast.
- No changes to `DAY_LEVEL_SETTINGS` — draw window and admin guard are league-level only.

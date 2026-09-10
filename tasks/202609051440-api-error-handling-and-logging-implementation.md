# API Error Handling & Catch-All Error Logging

## Overview

A goalscorer edit on the 2026-09-05 knockout semi-final (blue outlaws vs white fighters)
returned `500` with nothing in the logs beyond the status line, and the session data had to
be repaired by hand on the server. Three separate defects combined to produce that outcome;
all three are addressed here.

### 1. The 500 was really a 400

In SvelteKit 2, `error()` **throws** rather than returns — the shipped types say so
(`export function error(status, body): never`, with the note _"Make sure you're not catching
the thrown error, which would prevent SvelteKit from handling it"_).

Every `return error(400, ...)` written **inside a `try` block** was therefore caught by that
route's own `catch`, failed the `instanceof KnockoutError` test, and fell through to
`return error(500, 'Internal server error…')`. The real message —
_"Penalty scores can only be set when main score is a draw"_ — never reached the client.

This affected **20 call sites across 7 route files**. Two routes (`teams/+server.js`,
`teams/auto-assign/+server.js`) had already been patched locally with an `isHttpError`
guard, and `rankings/[player]/+server.js` used an equivalent `err.status` check — evidence
the bug had been hit before and fixed symptomatically rather than systemically.

### 2. The logging gap

There was no `handleError` hook at all. Routes reported errors with `console.error`
(42 call sites) which only reaches stdout, never `logs/app.log`; only 5 sites used the
logger. The request-line log recorded `response.status` and nothing else. `resolve(event)`
was also un-wrapped, so a throw escaping the route produced no log line whatsoever.

### 3. Why no edit order worked

Adding a goalscorer bumps the score by the goal delta but never cleared a recorded shootout.
From 2-2 (pens 0-2): adding Offie gives 2-3 with penalties still set → rejected; removing
Cwenga first gives 2-1, also not a draw → rejected. **Both orderings passed through an
invalid intermediate state**, so the edit was impossible through the UI regardless of the
status code. `handleScoreChange` already cleared stale penalties correctly; the two scorer
paths never got the same treatment.

## Architecture decisions

**A single `toApiError` helper rather than a guard line per catch.** The repeated
`console.error` → `instanceof XError` → `error(500, …)` tail appeared in 16 near-identical
blocks. Centralising it removes the whole class of bug rather than the one instance, and
gives one place to change error policy later. It generalises the pattern already proven in
`teams/+server.js`.

**Unexpected errors are re-thrown, not converted in the route.** `toApiError` ends with
`throw err` rather than `error(500, fallback)` so genuine failures reach `handleError` and
get logged exactly once, with a stack and a correlation id. The route's client-facing
message is carried along on the error as `apiFallbackMessage`, so the caller still gets a
route-specific message instead of SvelteKit's bare "Internal Error".

**`handleError` for unexpected errors only.** SvelteKit deliberately does not route
`error()` HttpErrors through `handleError` — those are an intended response, not a failure.
Expected 4xx are recorded on the request line (now tagged `REJECTED`); unexpected 5xx get a
full `[ERROR]` entry plus a `FAILED` request line.

**Penalties are normalised, not rejected.** A shootout only means anything on a draw, but
rejecting a non-draw stranded legitimate scorer edits. The server now drops a stale shootout
instead of 400-ing, with the client clearing it too so the invariant holds on both sides.

## Files modified

**New**

- `src/lib/server/apiError.js` — `toApiError(err, fallbackMessage, context)`: re-throws
  HttpErrors, maps `statusCode`-bearing domain errors, annotates and re-throws the rest.

**Error handling**

- `src/routes/api/games/knockout/+server.js` — both catches migrated; penalty checks hoisted
  out of the `if (teams …)` block (they never depended on rosters, and were silently skipped
  when no teams file existed); the non-draw rejection replaced with normalisation.
- `games/`, `players/`, `teams/players/`, `discipline/`, `champions/[player]/`,
  `rankings/[player]/`, `teams/`, `teams/auto-assign/` `+server.js` — 17 catch blocks
  collapsed to `return toApiError(...)`; now-unused error-class and `isHttpError` imports removed.

**Logging**

- `src/hooks.server.js` — added the `handleError` export (correlation id, league, clientId,
  error name/message, route context, full stack); wrapped `resolve()` so a throw still
  produces a request line; logged the previously-silent OPTIONS short-circuit; tagged 4xx
  `REJECTED` and 5xx `FAILED`; added `sanitizeBodyForLog` + `redactSecrets`.
- `src/lib/server/logger.js` — `formatMessage` now unwraps `Error` instances.
  `JSON.stringify(new Error('x'))` is `'{}'`, so passing an Error previously logged nothing;
  `handleError` would have written an empty object without this.

**Penalty/scorer trap**

- `src/components/MatchCard.svelte` — `handleScorersUpdate` clears stale penalties.
- `src/lib/client/services/games.svelte.js` — `applyPlayerAction` does the same for the
  match-tracker path (a separate code path from MatchCard).

## Security fix (found while auditing logging)

`logs/app.log` held **139 lines with plaintext league and admin codes**, written by the DEBUG
body logger (138 `authenticate`, 54 `authenticate-admin`, plus reset/forgot flows). Request
bodies are now parsed and filtered against a key denylist — `accessCode`, `adminCode`,
`newAccessCode`, `password`, `resetCode`, `secret`, `token`, matched case-insensitively and
recursively — with values replaced by `[redacted]`. A body that fails to parse is logged as
`[unparseable body omitted]` rather than raw, since its shape is unknown.

`logs/` is gitignored, so this never reached the repository.

## Testing

`npm test` — **1218 backend + 241 frontend passing**, 24 new cases:

- `test/lib/server/apiError.test.js` (6) — HttpError pass-through, 4xx preservation, domain
  error mapping, unexpected re-throw, annotation, non-Error throws.
- `test/routes/api/games/knockout.test.js` (9) — replays the incident payload verbatim.
  **Verified as genuine regression tests: 8 of the 9 fail against the pre-fix route.**
- `test/hooks.server.test.js` (+9) — body redaction (nested, cased, unparseable) and
  `handleError` (correlation id, stack, context, fallback message).

### End-to-end verification

Ran against `npm run dev` on a future-dated scratch session (2026-09-05 is locked, so
`validateCompetitionOperationsAllowed` short-circuits any replay against the real date).
Dev landed on port 5174, which needs an `ALLOWED_ORIGIN` override to match.

| Request                                | Before                      | After                                                        |
| -------------------------------------- | --------------------------- | ------------------------------------------------------------ |
| The incident payload verbatim          | `500 Internal server error` | `200`, shootout dropped                                      |
| Remove Cwenga → intended 2-2 end state | —                           | `200`                                                        |
| Half-set shootout                      | `500`                       | `400 Both home and away penalty scores must be set together` |
| Unknown scorer                         | `500`                       | `400 Scorer validation failed: … Ghost is not on this team`  |
| Unknown operation                      | `500`                       | `400 Invalid operation…`                                     |

An induced `TypeError` produced a `500` carrying `{"message":"Failed to do the thing",
"errorId":"fa1c13e1-…"}` and a matching `[ERROR]` entry in `app.log` with the full stack and
the faulting `file:line`, correlated to a `500 FAILED` request line. An `authenticate` call
logged `{"accessCode":"[redacted]"}`.

## Assumptions & limitations

- `data/pirates/2026-09-05.json` was already repaired by hand; nothing here touches existing data.
- **Rotated log files still contain the plaintext codes** — redaction only affects new writes.
  Scrubbing them on the server is a manual step, and rotating the exposed league/admin codes
  is worth considering.
- `advanceWinners` (`knockoutManager.js:161-214`) only ever writes winners forward and never
  clears an already-advanced team when a result is edited back to a draw. Real latent bug,
  deliberately out of scope — flagged, not fixed.
- `handleError` returns `errorId` to the client. That is intentional (it lets a user quote the
  id from a support message) and leaks nothing, but it does change the 500 response shape.

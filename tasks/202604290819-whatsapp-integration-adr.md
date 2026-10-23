# ADR: WhatsApp Notification Integration via Baileys

**Date:** 2026-04-29 (revised 2026-10-08)
**Status:** Proposed
**Deciders:** Veli Gebrev

> **Revision 2026-10-08:** Re-assessed Baileys maintenance status (see [Library Health](#library-health-assessed-2026-10-08)),
> added an explicit channel boundary ([Module Boundaries](#module-boundaries)) so the integration library can be
> swapped without touching callers, moved notification hooks out of `playerManager`, and added operational
> hardening (exact version pin, runtime WA Web version fetch, session-invalidation status, container smoke test).

---

## Context

Leagr currently communicates with players only through the app UI and email (access code recovery via Mailgun). Many social football groups coordinate primarily via WhatsApp. Adding outbound WhatsApp notifications would close the loop between app events and the group chat players already use — without requiring any behaviour change from them.

The three primary use cases, in priority order:

1. **Draw replay video** — automated recording of the team draw animation, mixed with a soundtrack, sent as a video message to the group
2. **Registration open** — notify the group when a new game is opened for registration
3. **Player unregistered** — notify the group when a player removes themselves from a game (gives others a chance to fill the spot)

---

## Decision

Integrate WhatsApp outbound notifications using **Baileys** (WhiskeySockets/Baileys), a WebSocket-based Node.js library that interfaces with WhatsApp Web. The deploying operator pairs their own dedicated WhatsApp number — the app is agnostic about which number is used. Notifications are outbound-only for v1. League admins configure their target group by name; JID resolution is handled internally by the service.

Baileys is confined to a single channel adapter module behind a small, library-agnostic interface (see [Module Boundaries](#module-boundaries)). The rest of the app never imports Baileys or handles WhatsApp-specific identifiers, so the library can be replaced by changing one file.

---

## Alternatives Considered

### WhatsApp Business API (Meta Cloud API)

Official, ToS-compliant, production-grade. Rejected because it requires Meta business verification, has per-message costs at scale, and adds significant setup overhead for what is a hobbyist/community app. May be worth revisiting if Leagr ever goes commercial.

_Update 2026-10-08:_ Meta has since added a [Groups API](https://developers.facebook.com/documentation/business-messaging/whatsapp/groups/groups-messaging/) to the Cloud API, but it requires an Official Business Account (blue checkmark) and caps groups at **8 participants**, with no endpoint to add members directly. This rules it out for session groups of 24+ players regardless of cost. Revisit only if the participant cap is lifted.

### Telegram Bot

Simpler API, no ToS risk. Rejected because the target user base is already organised in WhatsApp groups and won't migrate.

### Baileys (chosen)

Unofficial reverse-engineered client. Free, Node-native, no per-message cost, works with existing WhatsApp groups. ToS risk is real but acceptable for a private community tool using a dedicated number for genuine group notifications only.

---

## Library Health (assessed 2026-10-08)

Baileys remains the de facto Node library for this (≈11.3k stars, MIT, not archived), but maintenance is bursty and concentrated in one primary maintainer:

- **Releases:** `7.0.0-rc.9` (2025-11) → six-month gap → `rc10`–`rc13` (2026-05) → `rc14` (2026-07-29). npm `latest` points at `7.0.0-rc14`; `6.7.24` is tagged `legacy`.
- **Merges:** nothing merged to `master` or `develop` since 2026-08-05. PRs continue to be opened and updated, and the automated WhatsApp Web version bump (#2844, opened 2026-10-04) is waiting for review.
- **Known issues relevant to us:**
    - Pairing-code (phone number) linking broken since 2026-08 (#2764, #2759, #2832). **QR pairing still works** — the pairing script uses QR only.
    - Ban reports (#2800, #2805) concern cold-messaging unknown numbers and verified business (blue checkmark) accounts. Neither applies to a dedicated ordinary number posting to groups it is a member of.
    - 7.x LID-migration bugs mostly affect status broadcasts and 1:1 retries (#2794, #2781), not group text/video sends.

**Conclusion:** still appropriate, on the condition that it is pinned exactly, contained behind the channel adapter, and not trusted to bump its own WhatsApp Web version (see [Operational Hardening](#operational-hardening)). Fallback if the project stalls: [whatsapp-web.js](https://github.com/pedroslopez/whatsapp-web.js) (Puppeteer-based, heavier, but Chromium is already a Phase 5 dependency). Its activity was not assessed. Only the adapter changes.

---

## Consequences

**Positive:**

- Zero friction for players — notifications arrive in the group they already use
- Draw replay video replaces a manual, time-consuming weekly task
- Registration open and player unregistered notifications reduce admin burden
- Any operator deploying Leagr pairs their own WhatsApp number — no dependency on a centralised account
- Auth state is fully self-contained in the operator's data directory

**Negative / Risks:**

- Baileys is a reverse-engineered unofficial client; WhatsApp ToS prohibits unofficial clients. Using a dedicated number (not a personal number) and limiting to genuine group notifications mitigates practical ban risk.
- Baileys is community-maintained with bursty releases (see [Library Health](#library-health-assessed-2026-10-08)); breaking changes are possible when WhatsApp updates its Web protocol. Contained by the channel adapter boundary.
- A paired session can be invalidated at any time (logout from phone, WhatsApp-side reset). This requires an operator to re-run the pairing script, so it must be visible, not silent.
- Group rename after configuration causes silent send failure (mitigated by logging; fix is re-saving the setting).
- Draw replay video adds Playwright + ffmpeg as server dependencies (~200MB for Playwright/Chromium).

---

## Environment Variables

| Variable                   | Required | Default               | Purpose                                                                                                                                          |
| -------------------------- | -------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `WHATSAPP_ENABLED`         | No       | `false`               | Master on/off switch — disables the service entirely when false                                                                                  |
| `WHATSAPP_AUTH_PATH`       | No       | `data/whatsapp-auth/` | Path to Baileys auth state directory                                                                                                             |
| `WHATSAPP_DEV_DESTINATION` | No       | —                     | E.164 number (e.g. `27821234567`) — when set, all messages route here instead of the resolved group JID. Logs a warning on each redirected send. |

When `WHATSAPP_DEV_DESTINATION` is set, the send helper substitutes the resolved group JID with `{number}@s.whatsapp.net` before sending. This provides real end-to-end delivery to a private number without touching any group, and requires no changes to notification logic.

---

## Architecture

### Module Boundaries

Notification logic is split into a channel-agnostic orchestrator and a single channel adapter. This is the seam that makes the integration library replaceable.

```
API routes (games, players, teams)
    │  notify(leagueId, event, payload)
    ▼
src/lib/server/notifications.js          ← channel-agnostic
    • reads league notification config + per-event toggles
    • formats the message for the event
    • calls channel.send(target, message)
    • never throws to the caller: logs and swallows failures
    │
    ▼
src/lib/server/whatsapp.js               ← the ONLY module that imports baileys
    • send(target, message)   target = configured group name; message = { text } | { video, caption }
    • getStatus()             → 'disconnected' | 'connecting' | 'connected' | 'qr-pending' | 'logged-out'
    • listTargets()           → string[] of group names
    • owns socket, auth state, reconnect, group-name → JID cache
```

Rules:

1. **Only `whatsapp.js` imports `baileys`.** JIDs, Baileys message shapes, and socket events never cross its boundary. Callers pass group _names_ and the neutral `{ text } | { video, caption }` message shape.
2. **Events fire from API routes, never from server managers.** `playerManager` and friends stay free of network side-effects, so their tests need no notification mocks.
3. **`notify()` is fire-and-forget.** A notification failure must never fail or delay the API response that triggered it.
4. **One channel, not a plugin system.** There's no registry or provider abstraction. A second channel, if ever needed, implements the same three functions and `notifications.js` picks between them. Until then, `notifications.js` imports `whatsapp.js` directly.
5. **Formatting lives in `notifications.js`.** WhatsApp's `*bold*` markup is the only formatting dialect for now. If a second channel appears, formatting moves to the adapter.

**Naming trade-off:** config (`info.json` → `whatsapp`), env vars (`WHATSAPP_*`), and the validation endpoint keep WhatsApp-specific names. The boundary targets swapping the _library_ (Baileys → another WhatsApp client), which leaves those names valid. Swapping the _channel_ (e.g. Telegram) would require an `info.json` migration. This is accepted, because the user base is committed to WhatsApp (see Alternatives).

### Session Model

One Baileys WebSocket session per deployment, authenticated against whichever WhatsApp number the operator has paired. The session is shared across all leagues — each league only differs by its target group JID, resolved internally from the configured group name.

### Group Resolution

On connect (and reconnect), `whatsapp.js` fetches all groups the paired number is a member of and builds an in-memory `Map<groupName, JID>`. `send()` resolves the target group name at send time. Failures (not found, duplicate name) are returned to `notifications.js`, which logs them with league context.

### Notification Flow

```
API route handles a request (draw saved / game opened / player removed)
    → notify(leagueId, eventType, payload)            [notifications.js, not awaited]
    → load league config; return early if disabled or event toggle off
    → format message for event type → { text } | { video, caption }
    → whatsapp.send(groupName, message)               [whatsapp.js]
        → resolve JID from cache → sock.sendMessage(...)
    → log result
```

For draw replay video, the flow is extended — see Phase 5 below.

### Pairing

`node scripts/whatsapp-pair.js` — one-time operator task:

1. Starts a temporary Baileys connection using the production auth state path
2. If no existing session: renders QR code in terminal, waits for scan. **QR only.** Pairing-code (phone number) linking has been broken upstream since 2026-08 (Baileys #2764).
3. On successful connection: prints account number and lists all group names
4. Exits cleanly

Re-run whenever `getStatus()` reports `logged-out` (see below).

### Operational Hardening

- **Exact version pin.** Install `baileys@7.0.0-rc14` with no `^`/`~` range. Releases are release candidates with breaking changes between them. Upgrade deliberately, re-running the container smoke test.
- **Don't rely on the bundled WhatsApp Web version.** Baileys hard-codes the WA Web revision it advertises, and the upstream auto-bump PRs can sit unmerged for weeks (#2844). On connect, fetch the current version at runtime (`fetchLatestBaileysVersion()` or its v7 equivalent; confirm the API exists in rc14). Fall back to the bundled default if the fetch fails.
- **Make session invalidation visible.** A disconnect with reason `loggedOut` (401) means the session is dead and reconnecting won't help. Stop the reconnect loop, set status to `logged-out`, and log at `error`. The settings page shows this state with a "re-run the pairing script" hint. Other disconnect reasons (e.g. 515 restart-required, connection lost) reconnect with backoff.
- **Container smoke test.** v7 depends on `whatsapp-rust-bridge`. Before building on it, confirm it loads in the production image (distroless runtime, glibc prod-deps stage). This mirrors the `sharp` libc constraint, and unit tests will not catch it.

---

## League Settings

Each league's `info.json` gains a `whatsapp` config block:

```json
{
    "whatsapp": {
        "enabled": true,
        "groupName": "Saturday 5s ⚽",
        "groupValidated": true,
        "notifications": {
            "drawReplay": true,
            "registrationOpen": true,
            "playerUnregistered": true
        }
    }
}
```

Per-notification toggles allow admins to opt out of specific message types without disabling WhatsApp entirely.

### Group Name Validation

On save (and on blur of the group name field), the settings page calls `POST /api/whatsapp/validate-group`:

- **No match** → "Group not found. Make sure the Leagr number has been added to the group and the name matches exactly."
- **Multiple matches** → "Multiple groups with this name exist. Rename one to make it unique."
- **Valid** → green indicator, saves `groupValidated: true`

---

## Notification Message Formats

### Registration Open

```
📋 *Registration is open for Saturday, 10 May*
Register here: https://leagr.app/yourleague
```

### Player Unregistered

```
⚠️ *A spot has opened up for Saturday, 10 May*
[PlayerName] has unregistered. Register here: https://leagr.app/yourleague
```

### Draw Replay (video message)

Video file with caption:

```
🎲 *The draw for Saturday, 10 May is done!*
```

---

## Implementation Plan

### Phase 1 — Core Service & Pairing

- [ ] Install `baileys@7.0.0-rc14` (exact pin) and `qrcode-terminal` dependencies
- [ ] Container smoke test: build the production image and confirm `baileys` (incl. `whatsapp-rust-bridge`) imports and a socket can be constructed. Do this before writing further code.
- [ ] Create `src/lib/server/whatsapp.js`, the channel adapter and the only module importing `baileys`
    - Baileys socket initialisation with auth state persistence
    - Runtime WA Web version fetch on connect, with fallback to bundled default
    - Reconnect handling with backoff; stop and set `logged-out` on `loggedOut` disconnect
    - In-memory group name→JID cache with rebuild on reconnect
    - `send(groupName, message)` with `message` = `{ text } | { video, caption }`. Resolves the JID internally and returns a discriminated result (`{ ok: true } | { ok: false, reason: 'not-connected' | 'group-not-found' | 'group-ambiguous' | 'send-failed' }`).
    - `getStatus()`: `disconnected` / `connecting` / `connected` / `qr-pending` / `logged-out`
    - `listTargets()`: group display names (for validation endpoint)
- [ ] Create `src/lib/server/notifications.js`, the channel-agnostic orchestrator
    - `notify(leagueId, eventType, payload)`: config/toggle check → format → `whatsapp.send()` → log. Never throws.
    - Message formatting helpers per event type
    - Unit-test with `whatsapp.js` mocked. No Baileys in these tests.
- [ ] Initialise the adapter in `src/hooks.server.js` (no-op when `WHATSAPP_ENABLED` is false)
- [ ] Create `scripts/whatsapp-pair.js` — QR display + group list output
- [ ] Add `data/whatsapp-auth/` to `.gitignore`
- [ ] Add `WHATSAPP_ENABLED`, `WHATSAPP_AUTH_PATH`, and `WHATSAPP_DEV_DESTINATION` env vars

### Phase 2 — Admin API Endpoints

- [ ] `GET /api/whatsapp/status`: connection status from `whatsapp.getStatus()`, for settings page display
- [ ] `POST /api/whatsapp/validate-group`: group name validation against `whatsapp.listTargets()` (admin-code protected)

### Phase 3 — League Settings UI

- [ ] Add WhatsApp section to league settings page
    - Enable/disable toggle
    - Group name text field with validate-on-blur + validate-on-save
    - Validation status indicator (not found / duplicate / valid)
    - Connection status badge (shows whether the global WA service is connected). `logged-out` shows a distinct warning telling the operator to re-run `scripts/whatsapp-pair.js`.
    - Per-notification-type toggles: Draw Replay, Registration Open, Player Unregistered
- [ ] Update settings save/load logic to include `whatsapp` config block
- [ ] Update settings validation in `$lib/shared/validation.js`

### Phase 4 — Text Notification Hooks

All hooks are a single non-awaited `notify(...)` call in the **API route handler**, made after the underlying operation has succeeded. Server managers (`playerManager` etc.) are not modified.

- [ ] **Registration open**: in the games API POST handler, call `notify(leagueId, 'registrationOpen', ...)` when `status` transitions to `open`
- [ ] **Player unregistered**: in the `/api/players` removal handler, call `notify(leagueId, 'playerUnregistered', ...)` after `playerManager` reports a successful explicit self-removal (not on game deletion or admin cleanup)
- [ ] Route tests assert `notify` is called (mocked) with the right event, and is not called on failure paths

### Phase 5 — Draw Replay Video

The draw replay pipeline produces an MP4 video of the animated team draw, mixed with a royalty-free soundtrack, sent as a WhatsApp video message.

#### 5a — Draw Replay Route

- [ ] Create `/draw-replay?leagueId=X&drawId=Y` — a deterministic, self-contained SvelteKit page
    - Accepts draw result via query params or a signed token (no auth required — only accessible with a valid drawId)
    - Plays the draw animation from start to finish at a fixed, predictable pace (no user interaction needed)
    - Emits a custom DOM event (`drawComplete`) or sets a sentinel element when animation finishes
    - Renders correctly in headless Chromium (verify fonts, Tailwind, Flowbite all load)

#### 5b — Recording Pipeline

- [ ] Install `playwright` and `fluent-ffmpeg` (+ system `ffmpeg`) dependencies
- [ ] Create `src/lib/server/drawRecorder.js`
    - Launch headless Chromium via Playwright
    - Navigate to `/draw-replay?leagueId=X&drawId=Y`
    - Start `page.screencast()` to capture WebM
    - Wait for `drawComplete` event (with a reasonable timeout)
    - Stop screencast, save WebM to temp file
    - Pick a random track from `assets/draw-music/` (see 5c)
    - Mix audio into video via ffmpeg: `ffmpeg -i replay.webm -i track.mp3 -c:v copy -c:a aac -shortest output.mp4`
    - Return path to final MP4

#### 5c — Soundtrack Library

- [ ] Curate 10–15 upbeat/energetic royalty-free tracks from [Free Music Archive](https://freemusicarchive.org) or [Mixkit](https://mixkit.co/free-music/)
- [ ] Store in `assets/draw-music/` — committed to the repo
- [ ] Verify licenses (CC0 preferred; CC-BY acceptable — no attribution needed in a private group message)
- [ ] `drawRecorder.js` picks a track at random per draw

#### 5d — Integration

- [ ] Hook `drawRecorder.js` into the draw API POST handler (after draw is saved)
    - Run asynchronously — don't block the API response
    - On completion, call `notify(leagueId, 'drawReplay', { videoPath })`
    - Clean up temp files after send
- [ ] `notifications.js` formats the `drawReplay` event into the neutral message shape:
    ```js
    whatsapp.send(groupName, {
        video: await fs.promises.readFile(videoPath),
        caption: `🎲 *The draw for ${formattedDate} is done!*`
    });
    ```
- [ ] `whatsapp.js` maps `{ video, caption }` onto the Baileys payload (`{ video, caption, mimetype: 'video/mp4' }`). The Baileys shape stays inside the adapter.

#### 5e — Hardening

- [ ] Graceful failure — if recording or send fails, log the error but don't crash the draw flow
- [ ] Add `drawReplayTimeout` config (default 120s) to handle unexpectedly long animations
- [ ] Docker: ensure `ffmpeg` is available in the container image

### Phase 6 — Hardening & Docs

- [ ] Structured logging for all WA events (connect, disconnect with reason, logged-out, send success, send failure, group not found)
- [ ] Update `CLAUDE.md` with notification conventions: only `whatsapp.js` imports `baileys`, notify from routes not managers, `notify()` never throws
- [ ] Update `README.md` env vars section with all three `WHATSAPP_*` variables
- [ ] Write `tasks/202604XXXXXX-whatsapp-integration-implementation.md`

---

## Out of Scope (v1)

- Inbound message handling / bot commands
- Per-player direct message notifications
- Rich card formatting (images, formatted cards beyond video) — plain text + video only
- AI-generated per-draw soundtrack (Mubert API etc.) — curated local library is sufficient for v1
- WhatsApp Business API migration path

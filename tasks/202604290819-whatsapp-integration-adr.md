# ADR: WhatsApp Notification Integration via Baileys

**Date:** 2026-04-29
**Status:** Proposed
**Deciders:** Veli Gebrev

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

---

## Alternatives Considered

### WhatsApp Business API (Meta Cloud API)

Official, ToS-compliant, production-grade. Rejected because it requires Meta business verification, has per-message costs at scale, and adds significant setup overhead for what is a hobbyist/community app. May be worth revisiting if Leagr ever goes commercial.

### Telegram Bot

Simpler API, no ToS risk. Rejected because the target user base is already organised in WhatsApp groups and won't migrate.

### Baileys (chosen)

Unofficial reverse-engineered client. Free, Node-native, no per-message cost, works with existing WhatsApp groups. ToS risk is real but acceptable for a private community tool using a dedicated number for genuine group notifications only.

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
- Baileys is community-maintained; breaking changes are possible when WhatsApp updates its Web protocol.
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

### Session Model

One Baileys WebSocket session per deployment, authenticated against whichever WhatsApp number the operator has paired. The session is shared across all leagues — each league only differs by its target group JID, resolved internally from the configured group name.

### Group Resolution

On connect (and reconnect), the service fetches all groups the paired number is a member of and builds an in-memory `Map<groupName, JID>`. `sendLeagueNotification()` resolves the league's configured group name at send time. Failures (not found, duplicate name) are logged with league context.

### Notification Flow

```
App event fires (draw complete / game created / player removed)
    → sendLeagueNotification(leagueId, eventType, payload)
    → resolve group JID from league config
    → format message for event type
    → sock.sendMessage(jid, messagePayload)
    → log result
```

For draw replay video, the flow is extended — see Phase 4 below.

### Pairing

`node scripts/whatsapp-pair.js` — one-time operator task:

1. Starts a temporary Baileys connection using the production auth state path
2. If no existing session: renders QR code in terminal, waits for scan
3. On successful connection: prints account number and lists all group names
4. Exits cleanly

Re-run if the session is ever invalidated.

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

- [ ] Install `baileys` and `qrcode-terminal` dependencies
- [ ] Create `src/lib/server/whatsapp.js`
    - Baileys socket initialisation with auth state persistence
    - Reconnect handling
    - In-memory group name→JID cache with rebuild on reconnect
    - `sendLeagueNotification(leagueId, eventType, payload)` — resolves group, formats message, sends
    - `getConnectionStatus()` — returns connected / disconnected / qr-pending
    - `getGroupNames()` — returns list of group display names (for validation endpoint)
- [ ] Initialise service in `src/hooks.server.js`
- [ ] Create `scripts/whatsapp-pair.js` — QR display + group list output
- [ ] Add `data/whatsapp-auth/` to `.gitignore`
- [ ] Add `WHATSAPP_ENABLED`, `WHATSAPP_AUTH_PATH`, and `WHATSAPP_DEV_DESTINATION` env vars

### Phase 2 — Admin API Endpoints

- [ ] `GET /api/whatsapp/status` — connection status, for settings page display
- [ ] `POST /api/whatsapp/validate-group` — group name validation (admin-code protected)

### Phase 3 — League Settings UI

- [ ] Add WhatsApp section to league settings page
    - Enable/disable toggle
    - Group name text field with validate-on-blur + validate-on-save
    - Validation status indicator (not found / duplicate / valid)
    - Connection status badge (shows whether the global WA service is connected)
    - Per-notification-type toggles: Draw Replay, Registration Open, Player Unregistered
- [ ] Update settings save/load logic to include `whatsapp` config block
- [ ] Update settings validation in `$lib/shared/validation.js`

### Phase 4 — Text Notification Hooks

- [ ] **Registration open** — hook into games API POST handler; send when `status` transitions to `open`
- [ ] **Player unregistered** — hook into playerManager removal logic; send on explicit player removal (not on game deletion)
- [ ] Message formatting helpers for each event type
- [ ] Ensure notifications respect the per-type toggle in league config

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
    - On completion, call `sendLeagueNotification(leagueId, 'drawReplay', { videoPath })`
    - Clean up temp files after send
- [ ] Update `sendLeagueNotification` to handle `drawReplay` event type:
    ```js
    await sock.sendMessage(jid, {
        video: fs.readFileSync(videoPath),
        caption: `🎲 *The draw for ${formattedDate} is done!*`,
        mimetype: 'video/mp4'
    });
    ```

#### 5e — Hardening

- [ ] Graceful failure — if recording or send fails, log the error but don't crash the draw flow
- [ ] Add `drawReplayTimeout` config (default 120s) to handle unexpectedly long animations
- [ ] Docker: ensure `ffmpeg` is available in the container image

### Phase 6 — Hardening & Docs

- [ ] Structured logging for all WA events (connect, disconnect, send success, send failure, group not found)
- [ ] Update `CLAUDE.md` with WhatsApp service conventions
- [ ] Update `README.md` env vars section with all three `WHATSAPP_*` variables
- [ ] Write `tasks/202604XXXXXX-whatsapp-integration-implementation.md`

---

## Out of Scope (v1)

- Inbound message handling / bot commands
- Per-player direct message notifications
- Rich card formatting (images, formatted cards beyond video) — plain text + video only
- AI-generated per-draw soundtrack (Mubert API etc.) — curated local library is sufficient for v1
- WhatsApp Business API migration path

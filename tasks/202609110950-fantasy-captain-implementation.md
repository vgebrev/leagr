# Weekly Fantasy — the captain's armband

Follows `202609110920-fantasy-pick-screen-rework-implementation.md`, which made the pitch the
pick screen. The pitch is now also where the armband is given: one pick in a squad can be made
captain, and their points count twice in the squad's total.

## The rule

- A squad may nominate one **captain**, who must be one of its own picks.
- At settlement the captain's session points are added a second time. Nothing else changes:
  the captain costs what they cost, and the budget is untouched.
- A captain who did not play, or who withdrew from the session, scores nothing — doubled,
  which is still nothing. There is no refund and no substitute.

## Architecture decisions

**The captain is optional on the server, automatic on the client.** `saveEntry` accepts
`captain: string | null` and only insists that a named captain is one of the squad's players.
That keeps every squad entered before this feature valid — they simply double nobody — and
keeps the server's contract to one rule. The pick screen then makes sure nobody loses free
points by not noticing the feature exists: the **priciest pick wears the armband by default**,
and it passes to the next-priciest by itself when that player is taken off the pitch. Both are
`$derived`, so there is no effect to keep in sync:

```js
let defaultCaptain = $derived(/* highest-priced pick */);
let captain = $derived(captainPick && picks.includes(captainPick) ? captainPick : defaultCaptain);
```

A manager's own choice (`captainPick`) wins whenever it is still on the pitch; otherwise the
default answers. A squad can never carry a captain it has not picked, so the client can never
present the server with the one thing it rejects.

**Doubling is scored on the server and shown on the tile.** The squad total the leaderboard
ranks on comes from `#scoreSquad`, which counts the captain twice. The pitch has to agree with
it or the numbers stop adding up, so `FantasySquadPreview` doubles the captain's `points` stat
for display — in one place, for both the pick screen and the leaderboard modal, rather than in
each page that builds a stats map. An unsettled session has nothing to double: a null stays
`—` rather than becoming `0`.

**The badge is the control.** The armband is a small circle on the tile, mirroring the remove
✕ on the opposite corner: gold with a dark `C` for the captain, muted for a player who could
wear it instead. Where the caller passes `oncaptain` every filled tile's badge is a button —
including the captain's, so a mis-tap is undoable — and where it does not, only the captain's
badge renders, as a static `role="img"` label. That is what makes the leaderboard modal show
whose armband it is without offering to move it, from the same component.

**The armband is `TeamFormation`'s to draw, not to interpret.** The pitch knows a tile can wear
an armband; it does not know what one is worth. Doubling lives in the fantasy layer, which is
why the teams page can keep using the same component without inheriting a fantasy rule.

## Files modified

| File                                                | Change                                                                                                                               |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/server/fantasyManager.js`                  | `captain` on the entry typedef and the stored record; validated in `saveEntry`; `#scoreSquad` counts it twice; `#present` exposes it |
| `src/routes/api/fantasy/+server.js`                 | `captain` read from the POST body and passed to `saveEntry`                                                                          |
| `src/components/TeamFormation.svelte`               | `captain` / `oncaptain` props and the armband badge (button when movable, static label when not)                                     |
| `src/components/FantasySquadPreview.svelte`         | passes both through; doubles the captain's displayed points                                                                          |
| `src/components/FantasyTeamModal.svelte`            | `captain` passed through to the preview                                                                                              |
| `src/routes/fantasy/components/SquadSummary.svelte` | `captain` / `oncaptain` passed through                                                                                               |
| `src/routes/fantasy/team/+page.svelte`              | captain state, the default-and-handover rule, and sends `captain` on save                                                            |
| `src/routes/fantasy/+page.svelte`                   | the selected squad's captain into the modal                                                                                          |

What the armband is worth is written down in the `Fantasy Info` panel on the leaderboard, added
by `202609111030-fantasy-info-and-hidden-squads-implementation.md`.

## Testing

`test/lib/server/fantasyManager.test.js` — a captain recorded from the squad and stored; a
captain outside the squad rejected; a squad left captainless; the captain's points doubled in
the total; a captain who did not play doubling nothing.

`test/components/TeamFormation.svelte.test.js` — the badge on the captain and nobody else; the
armband movable from any filled tile when `oncaptain` is given (and the captain's own badge
still a button); never on an empty slot; nothing at all on a captainless read-only squad.

`test/routes/fantasy/SquadSummary.svelte.test.js` — the badge and the handler through the
summary; the captain's tile showing doubled points, and an unsettled one still showing `—`.

`test/routes/fantasy/team.svelte.test.js` — the priciest pick nominated and then moved; the
armband handed on when the captain is removed; `captain` in the saved body; a saved captain
restored from the payload; and a closed window showing the armband without offering to move it.

Verified visually the way the rest of this screen was: a jsdom render dumped to HTML, wrapped
in the built stylesheet and screenshotted in headless Chrome at 500×860 — gold `C` on the
captain, muted `C` on the other pick, neither on an empty slot, remove ✕ still on the opposite
corner, and the tile totals (48 + 9) adding up to the meter's 57.

`npm run lint` clean; 1331 backend and 299 frontend tests pass.

## Limitations

- **One armband, no vice-captain.** If the captain does not play, the squad simply loses the
  doubling. A vice-captain who inherits it would need a rule for "did not play" that the
  scorer does not currently have.
- **The default is a price heuristic, not a projection.** The priciest pick is usually the
  highest expected scorer, because that is what price is built from, but a manager who leaves
  the default in place is trusting the market rather than the fixture.
- **Nothing stops the armband moving after kick-off in an admin-unlocked session**, for the
  same reason nothing stops a pick changing there: an unlock reopens editing wholesale.

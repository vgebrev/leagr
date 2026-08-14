# Match timer: per-match clocks and a pause during last play

_2026-08-13 — game timer iteration 3. Decisions recorded in `tasks/202607252052-ADR-game-timer.md` §4, §12–13._

## Overview

Two defects reported from live Saturday use, plus one signal change:

1. **Navigating between matches destroyed a running clock.** Page refreshes and leaving the Match Centre were fine, but the next/previous buttons at the foot of the page reset the timer. `localStorage` held exactly one clock record, and `attach()` hard-reset on a match-key mismatch and then overwrote that record — so navigating back could not recover the clock. Referencing the match that just finished is an ordinary mid-session thing to do; it should not cost the clock.
2. **No pause during last play.** End Play replaced the primary button as soon as the last play phase began, so an injury in the final minute could only be handled by ending the match — even though `pause()` works perfectly in that phase.
3. **The restart whistle was confusing** on the pitch, being indistinguishable from a kick-off or from last play opening. Resuming after a pause is now silent.

The rule now: **a clock is only ever reset by the referee.**

## Architecture decisions

- **One stored clock per match.** `leagr:matchTimer` is a map keyed by `${date}:${competition}:${round}:${match}` rather than a single record. `attach()` restores the incoming match's clock if it has one, otherwise binds fresh from league settings. Wall-clock anchoring (ADR §2) already made restoration exact, so nothing about the clock model changed.
- **Storage stays bounded** by dropping entries older than 12 hours and capping the map at 12, most recent first, with the match being played never evicted. Pruning is by age rather than by date prefix, so opening an old session's Match Centre cannot wipe the clocks of the session in progress. Records in the previous single-clock format are migrated on read.
- **Rejected: one clock, labelled.** Keeping a single live clock that navigation never rebinds models the referee more literally and would keep whistling while you view another match, but it shows another match's clock on the page you are on — inviting mis-taps and needing a "free this clock" affordance that per-match storage does not.
- **`detach()` no longer stops a live clock.** Leaving the Match Centre for the standings keeps it ticking and audible; only `destroy()` is a hard teardown.
- **End Play became a second button** rather than a takeover of the primary, so no control changes meaning under the referee's thumb mid-match. It also fixes a dead end where a clock paused in regulation, then shortened past its elapsed time, showed End Play with no way to resume. Separated from the primary by weight (outline vs solid) rather than by hue; a red button was tried and dropped as too alarming for the ordinary way a last play ends.
- **Three announced moments, not four** (ADR §4): kick-off, last play opening, and the end of the match. `resume()` no longer whistles — the blast carried no information the players needed and could not be told apart from the other two short signals. It keeps its short vibrate as tap confirmation for whoever is holding the phone.

**Accepted consequence:** a clock left running on another match is not ticking, so full time sounds late, on return — the restore path fires one long whistle and parks it at Full Time. The reading itself is never wrong.

## Files modified

| Path                                                           | Change                                                                                                                                                                                                      |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/client/services/matchTimer.svelte.js`                 | `#readAll`/`#readSnapshot(matchKey)`/`#persist`/`#prune` for the keyed map with v1 migration; `attach()` restores rather than resets; `detach()` returns early while live, `destroy()` is the hard teardown |
| `src/routes/games/match/components/MatchTimer.svelte`          | Primary is always Start/Pause/Resume; `showEndPlay` renders an outline End Play button left of it in both the collapsed row and the expanded controls                                                       |
| `src/routes/games/match/+page.svelte`                          | Comment only — the attach/detach contract is unchanged                                                                                                                                                      |
| `test/lib/client/services/matchTimer.svelte.test.js`           | 11 new cases (below)                                                                                                                                                                                        |
| `test/routes/games/match/components/MatchTimer.svelte.test.js` | New — which controls the panel offers per phase                                                                                                                                                             |
| `tasks/202607252052-ADR-game-timer.md`                         | §7 and §9 amended, §12–13 added, limitation 7 added                                                                                                                                                         |

## Testing

Tests were written before the implementation. The existing `attach` and persistence suites still hold unchanged — moving to a match with no stored clock still yields an idle clock at the league default — so the service work is additive: returning to a running clock, returning to a paused clock with its duration override, the catch-up long whistle when play ran out while away, independent storage keys, age pruning, the 12-entry cap, v1 migration, and `detach()` leaving a live clock ticking. Component tests cover regulation (Pause only), last play (End Play + Pause), paused-in-last-play (Resume + End Play) and the collapsed row.

`npm test` → 924 backend + 186 frontend passing. `npm run lint` clean.

**End-to-end**, driven through headless Chrome over CDP against a future-dated scratch session (the Match Centre is write-locked on past dates), all ten checks passed: the clock survives next + previous and keeps running; each match stores its own clock; a duration override survives navigation; a paused clock returns paused at the same reading; the clock keeps running while another page is on screen; last play offers End Play and Pause together; pausing there still offers Resume and End Play; End Play ends the match at Full Time. The panel was also screenshotted at 390 px to confirm both buttons fit the collapsed row.

## Assumptions and limitations

- The 12-hour / 12-entry storage bounds are judgement, not measurement: a session is a few hours and a dozen matches, so both are comfortably above a session and below anything that would bloat `localStorage`.
- A clock parked on another match stays silent until you return (see above). This was the accepted trade of per-match clocks over a single labelled clock.
- The whistle remains unheard by ear (`whistle.js` is tuned by measurement), and vibration and the wake lock still need a real Android device.

# Fantasy: an info panel, hidden squads, and a tighter squad lock

## Overview

Three refinements to the weekly fantasy game, all on the leaderboard side of it:

1. **`Fantasy Info` accordion** on `/fantasy`, mirroring the rankings page's `Ranking Info`:
   what a squad costs, what the captain is worth, and what every stat pays.
2. **Other managers' squads are hidden** until editing locks — the picks are cut out of the
   payload, not just out of the page.
3. **The squad lock now answers to any recorded score**, not only the opening fixture's.

## 1. The info panel

`src/routes/fantasy/components/FantasyInfoPanel.svelte`, collapsed by default, placed under
the _My Squad / Pick a Squad_ button so the leaderboard stays the first thing on the page.

It reads the rules off the session payload rather than restating them, because two of them
move:

- **The scoring weights are league-tunable** (`settings.fantasy.scoring`, merged over
  `DEFAULT_FANTASY_CONFIG` by `resolveFantasyConfig`). A hard-coded copy would go quietly
  wrong the first time a league tuned one.
- **Only the stats in the current tracking regime are paid for at all**
  (`trackedStatRegime`). A league that records goals only should not be told that saves are
  worth 0.7 — it does not pay for saves.

So `#present` now emits `scoring` (the resolved weights) and `statTypes` (the regime), and
the panel renders a row per tracked stat type and nothing for the rest. The frozen board
carries its own `regime`, so a settled session keeps explaining itself by the rules it was
actually judged under.

The two multipliers the panel _does_ own are the rankings constants it converts from:
a league point is 3 for a win and 1 for a draw, a knockout win is 4. `matchPoint: 0.5`
therefore reads as "1.5pts for a win, 0.5pts for a draw" rather than as a multiplier
nobody can apply in their head. It also says plainly that the ranking bonus for where your
team finishes does **not** pay — the one place the fantasy rules and the rankings page
visibly differ.

## 2. Hidden squads

A squad is the whole game; a manager who can read someone else's before the deadline can
copy it. Until editing locks, every squad but your own arrives as a name, an owner, a cost
and a rank — `players`, `captain` and `withdrawnPlayers` are stripped in `#present`.

**Cut server-side, not hidden client-side.** The API is the easier read of the two, so a
page-level veil would be no protection at all. The manager's own entry and `myEntry` are
never touched.

**Tied to the edit lock, not to a clock.** `squadsRevealed = window.state === 'closed'`, so
the reveal is exactly the moment picking stops. The consequence is deliberate: an admin
unlock hands the session back to its managers, and the squads go back under wraps with it —
whatever can still be edited can still be copied.

Cost and rank stay visible. They are what makes it a leaderboard, and neither tells you who
is in the squad.

On the page, a row that cannot be opened is not a button: no `cursor-pointer`, no
`pushState`. The shallow-routing `$effect` carries the same guard, because a back-button
history entry can outlive the reveal it was made under. A line under the table says why.

## 3. The squad lock

`hasFirstMatchStarted` → **`hasSessionStarted`** (`src/lib/shared/helpers.js`).

The old helper looked only at the first playable match of round 1. Scores are entered from
the match tracker in whatever order the admin opens matches, so a second-round result could
be written down while the fantasy window stayed open — and a squad edited after that is no
less late. The new helper is true when any match in any round, or any knockout tie, has a
score. Byes are skipped (they carry no score and can never be played) and a sheet of nulls
is a schedule, not a result, so the normal path is unchanged.

Both call sites move together — the window gate in `FantasyManager.getWindowState` and the
freeze hook in `POST /api/games` — so the market is still pinned by the same score that
closes the window. The lock message becomes _"The session has kicked off. Squads are
locked."_

Confirmed by test, which was the third part of the request: once a score is recorded,
`saveEntry` and `deleteEntry` both refuse with a 400 and the squad as entered is what
stands. `readOnly` on the pick screen already follows `windowState`, so the form disables
itself at the same moment.

## Files modified

| File                                                    | Change                                                                                                                                                   |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/shared/helpers.js`                             | `hasFirstMatchStarted` → `hasSessionStarted`: any recorded score, any round, plus the knockout bracket                                                   |
| `src/lib/server/fantasyManager.js`                      | `squadsRevealed` in the payload; other managers' picks stripped in `#present`; `scoring` + `statTypes` published; new helper wired into `getWindowState` |
| `src/routes/api/games/+server.js`                       | Freeze hook uses `hasSessionStarted`                                                                                                                     |
| `src/routes/fantasy/components/FantasyInfoPanel.svelte` | **New** — the collapsed rules panel                                                                                                                      |
| `src/routes/fantasy/+page.svelte`                       | Renders the panel; rows only open when the squad is revealed; the effect guard; the "hidden until kick-off" line                                         |

## Testing

`test/lib/shared/helpers.test.js` — a `hasSessionStarted` suite: a blank sheet, a goalless
draw as a played match, byes ignored, a score recorded out of order, a knockout result.

`test/lib/server/fantasyManager.test.js` — another manager's picks absent from the payload
(asserted on the one pick only they made, so a leak is identifiable), the leaderboard still
readable, your own squad always whole, everything revealed once a match is scored, hidden
again for an admin-unlocked session, the scoring rules published, the window closing on an
out-of-order score, and the lock itself: no editing or withdrawing once a score exists.

`test/routes/fantasy/FantasyInfoPanel.svelte.test.js` — collapsed until asked, pays at the
league's own weights, converts the fractions into countable points, lists only tracked
stats, states the week's squad size and budget.

`test/routes/fantasy/leaderboard.svelte.test.js` — **new** page suite: the panel is there,
another manager's row does not open, your own does, the reason is on the page, and every
row opens once revealed.

Verified in headless Chrome against the built stylesheet, light and dark: the collapsed
strip, the expanded rules, and the leaderboard with and without the hint line.

## Assumptions and limitations

- **Cost is not concealed.** It leaks how close a rival is to the budget ceiling and nothing
  else. Hiding it would leave a leaderboard with one number on it.
- **The reveal is all-or-nothing per session.** There is no "show squads once you have
  entered your own", which would be the other reasonable rule and a different game.
- **An admin unlock re-hides squads that were already visible.** Managers who looked before
  the unlock still know what they saw; the rule keeps the invariant simple rather than
  pretending otherwise.
- **The panel explains the captain rule, but only on the leaderboard.** The pick screen
  shows the armband without a sentence about what it is worth.

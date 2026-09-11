# Fantasy: a withdrawn pick is marked on the tile

## Overview

A pick who leaves the session used to be named in a line of text under the pitch —
_"Withdrawn, scoring nothing: Bruno"_ — while their tile carried on showing a price and a
points total as if nothing had happened. The squad is what a manager is looking at, so the
tile is where it has to be said. The line is gone; the tile now says it:

- **The avatar and the name plate fade back** (`opacity-50`). A player who is not playing
  recedes; the accent belongs to the marker, which is the part with something to say.
- **The price-and-points chip is replaced** by an exclamation icon and the word `Withdrawn`,
  in the league's primary colour. A price and a points total are both answers to questions
  that no longer apply to that player, and showing them invited arithmetic that no longer
  adds up.

## Architecture decisions

**The pitch draws it; the caller decides what it means.** `TeamFormation` takes
`withdrawnPlayers` the same way it takes `captain`: a list of names it marks, with no
opinion about what withdrawing is or what it costs. `FantasySquadPreview` passes the
fantasy payload's `withdrawnPlayers` straight through, so the leaderboard modal and the
pick screen get the same marking from one place and cannot drift.

**The marker keeps the chip's shape.** It reuses the inline stats chip's box —
`bg-black/50`, same padding, same text size — so a squad with a withdrawal is the same
pitch with one tile changed rather than a pitch that reflows. On the pick screen nothing
moves under the manager's finger when a player drops out.

**Muted, not recoloured.** A tile painted in the accent competes with the marker and reads
as an alert about the whole player; fading it reads as what it is — someone who is out of
the picture. It also leaves the tile's colour meaning what it means everywhere else on the
pitch, so nothing new has to be learned to read one.

**The corner badges hang off the avatar, not off the tile.** The armband and the remove
control used to be positioned against the wrapper holding the avatar, the name and the stats
line — so their corners moved with whichever of those was widest, and no two tiles agreed on
where a badge lived. They now sit in a `pointer-events-none` layer that is the avatar's own
box (`h-10 w-10 sm:h-20 sm:w-20`, centred with `left-1/2 -translate-x-1/2`) inside a
positioning context wrapped around the avatar and name. A long name or a wide stats line
cannot push them anywhere. The corner offset is a breakpoint pair (`-top-3 sm:-top-1`, and
the matching left/right): a 20px badge set 4px off the corner grazes the 80px avatar but
sinks halfway into the 40px one below `sm`, so the small size stands it further out and both
end up just touching. The badges take `pointer-events-auto` so the tile underneath still
takes its own clicks, and they stay outside both the player-page link and the avatar's own
button, which cannot contain another button.

**It applies to both stat layouts.** The marker is rendered ahead of the stats block
regardless of `statsLayout`, so if the teams page ever marks a no-show it gets the same
treatment rather than a second implementation.

**The armband stays on a withdrawn captain.** The tile tells the truth about the squad as
entered; the doubling of nothing is still nothing, and on the pick screen the manager can
move the armband off them.

## Files modified

| File                                        | Change                                                                                                                                                                                                    |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/TeamFormation.svelte`       | `withdrawnPlayers` prop; the tile snippet takes an `isWithdrawn` flag and fades the avatar and name plate; the `Withdrawn` marker in the stats' place; the corner badges moved onto an avatar-sized layer |
| `src/components/FantasySquadPreview.svelte` | Passes `withdrawnPlayers` to the pitch; the text line under it is gone                                                                                                                                    |

## Testing

`test/components/TeamFormation.svelte.test.js` — a `withdrawn players` suite: the marker
replaces the stats and carries an icon, the avatar and plate are faded rather than coloured
while the marker keeps the accent, everybody still playing is untouched, a withdrawn pick
with no stats at all is still marked (a player dropped from the market has no price to
show), and nothing is marked when nobody has withdrawn. In the `captain` suite, a test that
the badges live on the avatar's own layer at both breakpoints.

`test/routes/fantasy/SquadSummary.svelte.test.js` — the pick screen marks the withdrawal on
the pitch, carries no note beneath it, drops that pick's price and points, and leaves the
other tiles' numbers alone.

Verified in headless Chrome against the built stylesheet: the editable pitch, the read-only
one, and dark mode.

## Assumptions and limitations

- **A withdrawn player with a photo keeps their photo**, faded rather than desaturated —
  `opacity` on the tile, no filter on the image itself.
- **Nothing distinguishes "dropped from the market" from "flagged withdrawn on a frozen
  board"**; both are the same thing to a manager, and the server already collapses them.

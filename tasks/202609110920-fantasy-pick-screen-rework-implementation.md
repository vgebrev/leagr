# Weekly Fantasy — the pitch is the pick screen

Follows `202609101740-fantasy-live-market-implementation.md`, which left the screen's shape
untouched. This is the shape change: the squad is no longer a summary above a list, it is the
screen, and the market is a sheet over it.

## The problem with the old shape

The pick screen was a stack: name → budget meter → a row of chips for the squad → a **Preview**
button that opened the same modal the leaderboard uses → the market table. Three consequences:

- The squad you were assembling was only ever visible on demand, behind a button.
- Every pick resized the page. Chips wrapped onto a second line, the preview appeared and
  disappeared, and the market table moved under the thumb mid-tap.
- The modal and the pick screen were two different renderings of one thing, free to drift.

## The new shape

1. **The squad is a pitch, always on screen**, at a fixed size: one place per squad slot, an
   unfilled one drawn as a dashed circle labelled **Empty**. Nothing on the page moves as
   players go in and out — the only thing that changes is what is standing in a slot.
2. **The market is a bottom sheet**, opened by tapping any slot, filled or empty, and closed
   by the pick that completes the squad. Picking is something that happens _to a slot_.
3. **A pick is taken back on the pitch**, from a small ✕ on its tile — the market row still
   toggles, but the squad no longer has to be edited from the list it was picked out of.
4. One component draws the squad for both screens (`FantasySquadPreview`), so the leaderboard's
   modal and the pick screen cannot disagree.

## Architecture decisions

**The pitch grew slots and handlers rather than a fantasy fork.** `TeamFormation` already drew
players in a formation for real teams; it now also understands a player with no name (an empty
slot) and two optional handlers, `onselect` and `onremove`. Without them it is exactly the
read-only pitch the teams page and the leaderboard modal have always had, which is what keeps
the two views from drifting. A fantasy-only copy of the pitch would have drifted within a week.

**A tile cannot be a button.** The obvious way to make a tile tappable — wrap it in a
`<button>` — is broken HTML: `Avatar` renders a button of its own, and the HTML parser closes
the outer button when it meets the inner one, taking the tile's layout with it. It survives
client-side rendering, where Svelte builds the DOM programmatically across component
boundaries, and collapses the moment the same markup is parsed as HTML. The tap target is an
absolutely positioned overlay button instead, a sibling of the tile. `test/components/
TeamFormation.svelte.test.js` pins it (`container.querySelector('button button')` is null).

**The height cap on the sheet has to be important.** Flowbite's drawer theme carries
`max-h-none`, which Tailwind emits _after_ `max-h-[85vh]` — a plain cap loses and a long market
runs off the bottom of the screen. `max-h-[85vh]!` wins; the list scrolls inside it.

**Unsettled points read `—`, not `0`.** Per-player points are `null` until the session is
settled. Behind a Preview button a `0pts` was harmless; permanently on screen it reads as a
score. The leaderboard modal shows the same for an unsettled squad.

**The meter keeps the numbers the pitch gives up.** The inline preview drops the totals line it
shows in the modal (`showTotals={false}`), so cost is stated once, by the budget meter; the
settled squad score, which then has nowhere else to go, sits at the right of the meter's second
row and only appears once there is one.

## Files

| File                                                | Role                                                                                                                                           |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/components/FantasySquadPreview.svelte`         | **New.** The squad on the pitch, shared by the modal and the pick screen. `slots` pads to a full squad; `onselect`/`onremove` make it editable |
| `src/components/TeamFormation.svelte`               | Empty slots, `statsLayout="inline"` (one line, `$12m \| 62.5pts`, no icons), overlay select button, remove control                             |
| `src/components/FantasyTeamModal.svelte`            | Reduced to a header plus `FantasySquadPreview`                                                                                                 |
| `src/routes/fantasy/components/SquadSummary.svelte` | Chips and the Preview button are gone; it is the budget meter (`$36m / $40m`) plus the inline pitch                                            |
| `src/routes/fantasy/team/+page.svelte`              | Saving moved under the name input; price-fluctuation paragraph dropped; market moved into a `Drawer` opened from a slot                        |
| `src/routes/fantasy/+page.svelte`                   | Passes `points: null` for an unsettled squad instead of `0`                                                                                    |
| `test/setup.svelte.js`                              | **`HTMLDialogElement` polyfill.** jsdom ships the class with none of its methods, so any Flowbite `<dialog>` threw on mount                    |

Extended by `202609110950-fantasy-captain-implementation.md`, which puts a captain's armband
on the same tiles.

## Testing

`npm test` — 1326 backend, 286 frontend, all passing.

The `showModal` polyfill is why a drawer can be tested at all: before it, rendering any
Flowbite `Modal` or `Drawer` in jsdom threw `dlg.showModal is not a function`, which is why the
repo had no `FantasyTeamModal` test. The team-page suite now opens the market the way a manager
does — clicking a slot — and covers the sheet closing on the last pick, a pick taken back from
the pitch, and a closed window offering no remove control but still opening the market to read.

Visual verification: the components' real rendered HTML (dumped from jsdom) wrapped in the
built stylesheet and screenshotted in headless Chrome at 500×1200 and 1200×900 — empty pitch,
two picks with three slots left, and the sheet over both a short and a 24-player market. That
is what caught the nested-button bug, which every jsdom test had happily passed.

## Limitations

- **The pitch is 1.5× its own width tall.** On a phone the squad is now most of a screen, and
  the meter above it is all that shares the page. No shorter aspect or collapse is offered yet.
- **The sheet's close button sits at the far edge on a wide screen**, away from the centred
  content column, because the drawer is full-width and only its contents are in the page column.
- **Swapping a player is two steps** — remove, then pick — rather than picking a replacement
  straight into an occupied slot.

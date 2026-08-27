# Badges Help Page — Implementation

**Date:** 2026-08-26

## Overview

A new `/help/badges` route documenting the badge lattice to players: every badge in the
catalogue rendered as the **actual badge**, its requirement, its grade, what it replaces, and
the rules that decide who gets one.

The page is a rendering of `src/lib/shared/badges.js`, not a second copy of it. Every badge,
label, requirement string, grade and supersession link is read from the catalogue at render
time, so a lattice change shows up on the help page without anyone editing it.

## Architecture decisions

### 1. The chip was extracted, not reimplemented

The brief was "the actual badge as it appears in PlayerBadges". Restating the visual grammar
(icons, shapes, edge gradients, inks) on the help page would have created exactly the drift the
lattice module exists to prevent — a catalogue that shows badges unlike the ones players wear.

`src/components/BadgeChip.svelte` now owns the whole visual grammar, and both consumers render
it:

- `PlayerBadges.svelte` — earned badges, with popovers. Passes `interactive`.
- `help/badges/+page.svelte` — the catalogue. Plain, non-focusable chips.

`interactive` exists because a popover trigger needs `tabindex`/`role="button"` and a listing
does not — a page of 20 tab stops that do nothing is worse than none. It is implemented as two
markup branches rather than conditional attributes: Svelte can only verify that `tabindex` and
`role` agree when both are literals, and a dynamic pair trips `a11y_no_noninteractive_tabindex`.

### 2. Two constants moved into the shared lattice

`TRAIT_SEASON_GAMES_THRESHOLD` (35) and `TRAIT_MIN_TRACKED_SESSIONS` (5) were locals inside
`calculatePlayerProfiles()`. The help page states both to a reader, and a restated constant is a
constant that drifts, so they moved to `badges.js` alongside `BASE_PERCENTILE` /
`ELITE_PERCENTILE` — which were already shared for the same reason — and `rankings.js` now
imports them. No behavioural change: same values, same comparisons.

### 3. `explainBadge()` moved out of the component

`PlayerBadges` had a private `explain()` that phrased a trait badge as its band and stat ("Top
55% for goals per session") rather than as its own name, because `requirementLabel('finisher')`
is just "Finisher". The help page needs the same sentence, so the function moved to `badges.js`
and both call it. It now reads `requiresEliteTraits(badge)` instead of testing for a gold tier —
equivalent for every badge in the catalogue, but it asks the question it actually means.

### 4. No entry point yet

Asked and answered at plan time: route only. Nothing links to `/help/badges` — no nav item, no
link from the badge popovers. It sits under the standard league auth like every other page.

> **Superseded 2026-08-27.** A `/help` index and a nav entry were added the next day; see
> `202608271005-help-index-and-archetype-icons-implementation.md`. The badge popovers still do
> not link out.

## Files modified

| File                                     | Change                                                                                             |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/components/BadgeChip.svelte`        | **New.** One badge, rendered — icons, shapes, edges, inks, `interactive` flag. Extracted verbatim. |
| `src/components/PlayerBadges.svelte`     | Reduced to badge derivation + popovers; renders `BadgeChip`. ~120 lines → ~50.                     |
| `src/lib/shared/badges.js`               | Added the two eligibility constants, `bandPercent()` and `explainBadge()`.                         |
| `src/lib/server/rankings.js`             | Imports the eligibility constants instead of declaring them.                                       |
| `src/routes/help/badges/+page.svelte`    | **New.** The page.                                                                                 |
| `test/routes/help/badges.svelte.test.js` | **New.** 10 tests.                                                                                 |

## Page structure

1. **How traits are earned** — the four traits with their source stats, the two eligibility
   gates, and where the bands sit. Every number interpolated from the shared constants.
2. **Reading a badge** — shape = how many traits, colour = how hard, with a real chip per
   material.
3. **The catalogue** — three sections (Traits, Archetypes, Versatility & Mastery), every badge
   with its chip, requirement, grade and what it replaces. Superseded badges are listed too; the
   page documents the lattice, not one player's view of it.

    A section declares a list of `categories`, not one, because the lattice's Breadth/Mastery
    split is an implementation detail: a reader sees four badges answering the same question
    ("how many, and how good?"), and the grade line already says which is which. One shared grid
    also means one shared badge column across all four.

    That section sets `groupByShape`, which sorts it by `SHAPE_ORDER` then `TIER_ORDER` so each
    silhouette's two badges sit together — All-Rounder above Complete Player (notched, crown),
    True Baller above G.O.A.T. (faceted, trophy) — instead of both base badges above both Elite
    ones. The requirement text then escalates within each shape: "Any 3+" → "Any 3+ Elite", then
    "All 4" → "All 4 Elite". It is opt-in per section because Traits and Archetypes are authored
    in base-then-Elite pairs already, and the same sort would pull those pairs apart. Sorting
    rather than listing ids keeps it drift-safe: a badge added to these categories later still
    appears, placed by its own shape and tier.

4. **Why you don't see them all at once** — supersession, in a player's terms.

### List layout

All three lists are `dl` grids of `grid-cols-[max-content_1fr]`, with `dt` (badge) and `dd`
(description) as **direct children of the grid** rather than rows of their own. Two consequences,
both wanted:

- The first column sizes to the widest badge across the whole list, so descriptions line up down
  it with no magic number — nothing to retune when a badge is renamed.
- A description that needs two lines wraps **inside its own column** instead of dropping under
  the badge. On a 425px phone (the target viewport) that is the difference between a readable
  list and a stack of orphaned captions.

Rows are centred (`items-center`), so a badge sits mid-height against a description of any
length. Each `dt` is itself a flex box: as a plain block it sits the inline-flex chip on a text
baseline, and the descender space below it threw the centring off by 2px — measured, not
guessed.

`dl` rather than `ul` because term → description is the shape of the content, and because
`dt`/`dd` are already the grid's children: keeping `li` would have required `display: contents`
on it, which costs the list its a11y semantics in several engines.

## Testing

`test/routes/help/badges.svelte.test.js` asserts against the catalogue rather than against a
hardcoded list, so adding a badge to `BADGE_DEFS` without adding it to the page fails the suite:

- every badge in `BADGE_DEFS` appears, superseded ones included
- a listed chip is the real one (diamond edge + faceted silhouette on G.O.A.T.)
- listed badges are not focusable controls (no `role="button"`, no `tabindex`)
- trait badges explain themselves by stat and band; combinations by component traits
- supersession is named, including the two G.O.A.T. hides
- the stated gates match the constants the server bands on
- every description is a `dd` adjacent to its badge's `dt` inside a two-column grid — jsdom has
  no layout, so this guards the structure that produces the side-by-side layout
- the multi-trait badges appear grouped by silhouette, each shape's base badge above its Elite
  one

Full suite: 1179 backend + 233 frontend passing. The existing 37 `PlayerBadges` tests passed
unchanged through the extraction, which is the evidence that the chip moved verbatim.

## Visual verification

Rendered against `pirates` at 390px, 800px and full height (headless Chromium). Three fixes came
out of it, none of which the tests would have caught:

- The `·` separator lost its leading space — Svelte collapses whitespace either side of a block
  tag, so the grade and the supersession ran together as "Rare Trait· replaces Finisher". Built
  as one string now.
- Long labels wrapped inside the chip. The notched and faceted silhouettes cut their corners at a
  fixed pixel depth, so a two-line badge takes the same bite out of a taller box and stops
  reading as the same shape. `whitespace-nowrap` on the label, in `BadgeChip`, so earned badges
  get the fix too.
- A chip placed directly in a grid cell stretched to its column, pulling the edge gradient out
  past the label. Wrapped, the way the catalogue rows already do it.

### Narrow viewports

The list layout above was driven by the 425px target. Plain `--window-size` captures cannot
verify it: headless clips the right edge below ~500px on **every** page in this app, including
untouched ones, so a description can look cut off when it is not. Measured instead over CDP with
`Emulation.setDeviceMetricsOverride`, which sets a real layout viewport
(`scratchpad/measure.mjs`). At both 425px and 360px: `document.scrollWidth` equals the viewport
(no horizontal overflow), no element's `scrollWidth` exceeds its `clientWidth`, every `dd`'s left
edge sits at or past its `dt`'s right edge (nothing stacked), and the worst chip-to-description
vertical centre offset across all 28 rows is 0px.

## Assumptions and limitations

- **The percentages are league-wide, not personal.** The page says "Top 55%" because that is
  what the constant means; it cannot tell a reader where they personally sit, and does not try.
- **The two unrecognised trait pairs are mentioned but not named.** "Six pairs are possible;
  four are recognised" — Attacker + Shot Stopper and Defender + Finisher are deliberately absent
  from the lattice, and naming them on a help page would read as a promise to add them.
- **The page assumes the page background.** `BadgeChip`'s inner layer paints
  `bg-gray-50 dark:bg-gray-800` rather than inheriting, which is what makes the outlined variant
  work; the `glass` sections it sits on are close enough that this is invisible, but a badge on a
  differently-coloured panel would show a seam. Pre-existing, inherited with the extraction.

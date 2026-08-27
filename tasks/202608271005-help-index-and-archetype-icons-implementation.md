# Help Index and Archetype Icons — Implementation

**Date:** 2026-08-27

## Overview

Two independent changes to the traits/badges work:

1. A `/help` index listing everything under it (today: Badges), reachable from the nav menu.
   This reverses the "route only" decision recorded in
   `202608260955-badges-help-page-implementation.md` — `/help/badges` had no entry point.
2. Powerhouse, Guardian and Maverick took their own icons, finishing the archetype icon
   migration that Sniper started.

## Architecture decisions

### The index is hand-written, and a test holds it to the filesystem

A help topic needs a name and a sentence that a router cannot supply, so `TOPICS` is declared in
`src/routes/help/+page.svelte` rather than discovered from `src/routes/help/*`. That is a list
which can silently go stale, so the test reads the directory and asserts the two agree in both
directions: a new `/help/*` route with no card fails, and so does a card pointing at a route
that no longer exists.

Routes are stored as literals and passed to `resolve()` at the `href` rather than pre-resolved
in the array. Two reasons, both mechanical: `svelte/no-navigation-without-resolve` looks for the
call at the navigation site, and SvelteKit's typed routes only narrow a literal — so a dead link
fails the build instead of 404ing in a browser. The array is a `/** @type {const} */` assertion
so the literal survives into the `{#each}`.

### Topic cards carry no icon

The card started with Flowbite's `AwardSolid` medal. That glyph is already the Rankings tab in
`BottomNavBar`, and a glyph in this app is an identity — the same rule the badge lattice follows,
where an icon is shared only where the _name_ is shared. Reusing it would have made the help
card read as a link to rankings. Rather than reach for a second-choice glyph, the topic list has
no icon column at all; a topic gets one when a glyph exists that means only that topic. The
chevron stays, since it is a direction affordance rather than an identity.

### The nav item carries no date

Every other league item in the menu appends `?date=`. Help explains rules that do not vary by
session, so it links to a bare `/help`. It still sits inside the `{#if leagueInfo}` block: the
pages it links to are behind league auth, and the root domain (which renders the menu with no
league) has nothing to explain.

### All four archetype upgrades now have their own glyph

`docs/traits.md` recorded the archetype block as mid-migration: icon = identity, identity
follows the _name_, and archetype upgrades are named as separate identities (Danger Man →
Sniper, not "Elite Danger Man"). Supersession means a player never wears both members of a pair
at once, so a shared glyph bought a side-by-side reading the UI never renders while spending a
channel that helps scan a row. Sniper took its own icon first; this finishes the other three:

| Badge      | Was               | Now                 |
| ---------- | ----------------- | ------------------- |
| Powerhouse | `EngineIcon`      | `DumbbellIcon`      |
| Guardian   | `TowerIcon`       | `SpartanHelmetIcon` |
| Maverick   | `UtilityHeroIcon` | `CowboyHatIcon`     |

The three base archetypes keep the icons they had, so `EngineIcon`, `TowerIcon` and
`UtilityHeroIcon` are now single-badge glyphs rather than shared ones.

Nothing else changes: the icon is the only channel touched, and shape/material still come from
the lattice. Because `BadgeChip` is shared, the change lands on player profiles and the badges
help page from one edit.

## Files modified

| File                                            | Change                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------- |
| `src/routes/help/+page.svelte`                  | **New.** The help index — one card per topic, the whole card a link.       |
| `src/routes/components/NavMenu.svelte`          | Added the Help item after Settings, inside the league block.               |
| `src/components/Icons/DumbbellIcon.svelte`      | **New.** Font Awesome 7.3.1 dumbbell.                                      |
| `src/components/Icons/CowboyHatIcon.svelte`     | **New.** Font Awesome 7.3.1 cowboy hat.                                    |
| `src/components/Icons/SpartanHelmetIcon.svelte` | **New.** Spartan helmet, normalised to the repo's icon convention.         |
| `src/components/BadgeChip.svelte`               | Repointed the three Elite archetypes; updated the identity comment.        |
| `docs/traits.md`                                | Icon table rewritten; the "mid-migration" paragraph now records it closed. |
| `test/routes/help/index.svelte.test.js`         | **New.** 3 tests.                                                          |
| `test/routes/components/NavMenu.svelte.test.js` | Help item present, links to `/help`, absent without a league.              |
| `test/components/PlayerBadges.svelte.test.js`   | The Sniper icon test generalised to all four archetype pairs, plus a       |
|                                                 | uniqueness test across all eight archetype glyphs.                         |
| `tasks/202608260955-…-implementation.md`        | Section 4 ("No entry point yet") marked superseded.                        |

## Icon convention

The two Font Awesome sources went in verbatim, keeping the licence comment, with the wrapper
matched to `CrosshairIcon`: `class` prop defaulting to `w-5 h-5`, `fill="currentColor"`,
`aria-hidden="true"`, `{...restProps}`. The spartan helmet arrived with `fill="#000000"` and
fixed `width`/`height` attributes; those were dropped so it inherits the tier ink like every
other badge glyph, and its `viewBox="0 0 14 14"` was kept as authored.

## Testing

- **Help index** (3): links to `/help/badges`; the card list matches the directory listing of
  `src/routes/help` exactly (both directions); the card describes the topic rather than only
  naming it.
- **NavMenu** (3 touched): Help appears once opened, links to `/help` with no date, and is
  absent on the root domain alongside Share/News/Settings.
- **PlayerBadges** (icons): the single "Sniper has its own icon" case became a table over all
  four base→Elite archetype pairs, plus a new test that all eight archetype glyphs are
  pairwise distinct — being different from your own base badge is not enough if the four Elite
  glyphs collide with each other.

Full suite: 1179 backend + 241 frontend passing. Lint and prettier clean.

## Visual verification

Rendered against `pirates` at a real 425px layout viewport over CDP
(`Emulation.setDeviceMetricsOverride`), the same method the badges page was measured with:

- `/help` — no horizontal overflow, the card wraps to two lines and stays inside the viewport.
- Nav menu opened via `Input.dispatchMouseEvent` — Help sits between Settings and the theme
  toggle, and Flowbite marks it active on `/help`.
- `/help/badges` — all three new glyphs are legible at the chip's 16px. The dumbbell is squat
  (its Font Awesome artwork spans only the middle 60% of the box vertically) but reads clearly;
  the helmet and hat fill their boxes.

## Assumptions and limitations

- **The index has one entry.** A single-card list is deliberate: the page exists so the nav item
  has somewhere to point that does not have to be re-aimed when a second topic lands.
- **No glyph identifies Badges on the index.** See above — the card is title and sentence only
  until an unclaimed glyph exists for it.
- **The badge popovers still do not link to the help page.** That half of the original "route
  only" decision stands.
- **The dumbbell is the least legible of the three at 16px** — the widest, shortest artwork in
  the icon set. If a fourth wide glyph is ever added, this is the one to re-check it against.

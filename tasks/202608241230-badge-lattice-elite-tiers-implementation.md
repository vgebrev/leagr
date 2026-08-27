# Badge Lattice, Elite Tiers & Visual Grammar — Implementation

Implements [`202608241055-adr-badge-lattice-and-elite-badge-tiers.md`](202608241055-adr-badge-lattice-and-elite-badge-tiers.md)
(Accepted), plus a tap-to-explore interaction on the rendered badges.

Follows the tiering change ([`202608211530`](202608211530-traits-tiering-implementation.md))
and the transparency report ([`202608240958`](202608240958-traits-transparency-report.md)).
The as-built spec is [`docs/traits.md`](../docs/traits.md), rewritten alongside this work.

## Overview

Elite traits already existed and were persisted, but the badge lattice was tier-blind — a
7-line `if` chain reading `traits` booleans and emitting display-name strings, with every
badge rendered as the same Flowbite `rounded-sm` chip. `docs/traits.md` recorded the
consequence directly: "four median-level traits earn G.O.A.T. while a single perfect norm
earns a tier-2 trait and whatever pairs it happens to complete."

Three things changed.

1. **The lattice reads tiers.** Twenty badges across four categories, with Elite qualification
   earning badges of its own (Elite traits, Elite archetypes) and Diamond reserved for breadth
   _at_ Elite level.
2. **Shape and material became independent semantic channels.** `shape = badge.category`,
   `material = badge.tier`, neither derived from the other.
3. **Badges became explorable.** Tapping one lights the rest of its lattice and mutes the rest.

## Architecture decisions

**A shared module, not a server one.** `src/lib/shared/badges.js` is the single source of
truth, imported by `rankings.js` (awarding), `PlayerBadges.svelte` (presentation) and
`scripts/traits-report.mjs` (verification). The report generator previously duplicated the
lattice verbatim and would have drifted; it now imports it.

**Base and Elite traits are two catalogue entries linked by `supersedes`**, not one entry with
a tier field. Trait badges then flow through the same qualify/supersede pipeline as everything
else, and the old ``label = `Elite ${label}` `` string-prefix hack disappears. Becoming Elite
changes the material, never the shape.

**Qualification is persisted; supersession is not.** `playerProfile` stores the full qualified
set as ids, without supersession, per the ADR's requirement that presentation choices must not
destroy qualification data. `displayBadges()` applies supersession at render time. Trait
badges are omitted from persistence because `traitTiers` already describes them exactly.

**The component derives from tiers, not from `playerProfile`.** This is the load-bearing
back-compat decision. Existing rankings files hold badge names whose _meaning has changed_ — a
2026 file's `"G.O.A.T."` means four **base** traits, which is now True Baller. Rendering that
string as Diamond Faceted would be a lie. Deriving from the persisted `traits`/`traitTiers`
(present on all 66 players in `rankings-2025.json` and all 73 in `rankings-2026.json`) renders
every existing file under today's rules with no migration and no recalculation required.

**Filled badges, not outlined.** `clip-path` clips borders, rings, outlines and shadows alike,
so a notched or faceted outline would need a two-layer element faking a border against the card
surface. Tinted fills cut cleanly and the silhouette reads at chip size, which is what the
ADR's accessibility argument depends on. Emphasis for the selected badge therefore lives inside
the fill (`font-semibold` + `brightness-110`) rather than in a ring.

**One symmetric rule drives highlighting.** Two badges are related when either one's
contributing traits contain the other's. Tapping True Baller lights everything beneath it;
tapping Attacker lights everything built on it. Both directions the interaction needs fall out
of the same predicate, and the test suite asserts the symmetry.

**Every badge family shares one icon.** The silhouette says which family a badge belongs to;
the material says how prestigious it is. Elite archetypes take their base archetype's icon
(Sniper reuses `DangerManIcon`), and the Breadth badges take their Mastery counterparts':
`CrownIcon` for All-Rounder → Complete Player (both "3+"), `TrophyIcon` for True Baller →
G.O.A.T. (both "all 4"). The pairing is by **requirement**, not tier, so the Diamond badge
reads as the Elite upgrade of the Gold one. No new icons were needed.

## Product consequence

The ADR repurposes two existing badges, which moves real holders. Measured against
`data/pirates/rankings-2026.json`:

| Badge           | Before | After |
| --------------- | ------ | ----- |
| Danger Man      | 16     | 11    |
| Sniper          | —      | 5     |
| Engine          | 11     | 8     |
| Powerhouse      | —      | 3     |
| Sentinel        | 7      | 7     |
| Utility Hero    | 6      | 6     |
| Guardian        | —      | 0     |
| Maverick        | —      | 0     |
| All-Rounder     | —      | 12    |
| True Baller     | —      | 3     |
| Complete Player | 10     | 2     |
| G.O.A.T.        | 3      | **0** |

Lunathi, Morena and Veli move G.O.A.T. → True Baller. Nobody holds G.O.A.T. any more, and
Guardian/Maverick have no holders because they need two simultaneous Elite tiers on the
keeper-side pairs. This was raised and confirmed before implementation: it is the lattice
working as designed, with the pinnacle now genuinely scarce.

**Trait tiers themselves did not move.** Verified: running the new `calculatePlayerProfiles()`
over the persisted rankings leaves `traitTiers` byte-identical for all 73 players. Only the
badges derived from them changed.

## Files modified

| File                                          | Change                                                                     |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `src/lib/shared/badges.js`                    | **new** — catalogue, qualification, supersession, highlight relation       |
| `src/lib/server/rankings.js`                  | badge `if` chain → `qualifiedBadges(traitTiers)`; awarding maths untouched |
| `src/components/PlayerBadges.svelte`          | rewritten: derives from tiers, visual grammar, tap-to-highlight            |
| `src/components/PlayerHeader.svelte`          | dropped the now-unused `playerProfile` prop                                |
| `src/routes/rankings/[player]/+page.svelte`   | same                                                                       |
| `src/app.css`                                 | four `.badge-*` shape utilities in `@layer utilities`                      |
| `src/lib/server/teamGenerator.js`             | typedef fix only: `{string} playerProfile` → `{string[]}`                  |
| `test/lib/shared/badges.test.js`              | **new** — 216 tests                                                        |
| `test/components/PlayerBadges.svelte.test.js` | **new** — 24 tests                                                         |
| `test/lib/server/rankings.test.js`            | lattice assertions rewritten for ids and tiers                             |
| `docs/traits.md`                              | lattice, visual grammar, consumers, counts, limitations, files             |
| `scripts/traits-report.mjs`                   | imports the shared lattice instead of duplicating it (gitignored)          |

## Testing

**`test/lib/shared/badges.test.js` (217 tests)** exercises the lattice exhaustively over all
**81** tier combinations (3⁴), asserting in both directions that a badge is awarded exactly
when its requirement holds. Plus: catalogue matches the ADR's 20 rows; category and tier are
independent (three categories share Gold; archetypes span two tiers); supersession within each
family; the two deliberately unsupported pairs; `contributingTraits` for count-based badges;
and `relatedBadgeIds` symmetry.

**`test/components/PlayerBadges.svelte.test.js` (26 tests)** asserts shape and material classes
per category/tier, that three Gold badges carry three different silhouettes, that each family
shares one icon across its two tiers, the tap-highlight behaviour in both directions, re-tap
and Escape clearing, and that a stale `playerProfile` is ignored in favour of the tiers.

**`test/lib/server/rankings.test.js`** — the badge assertions were rewritten. One test inverted
by design: `'a base-tier player earns the same combos as an Elite one'` is now
`'an Elite player earns strictly more than a base one'`. That guarantee was the pre-ADR
behaviour and is exactly what this change removes.

**`test/lib/server/teamGenerator.test.js`** passes unchanged, which is the point — tier
blindness is the invariant this work must not break.

Suite: **1158 backend + 212 frontend, all passing** (from 937 + 186). `npm run lint` clean.
`npm run check` reports no new errors for either new file.

## Verification beyond tests

- **`node scripts/traits-report.mjs`** — the generator refuses to emit unless it reproduces
  what the application persisted. All six self-checks pass with the shared lattice wired in,
  which independently confirms the awarding rule still matches the stored data.
- **Server path, non-destructively** — ran `calculatePlayerProfiles()` over a clone of the
  persisted rankings: `traitTiers` unchanged for all 73 players, `playerProfile` now ids.
- **Driven in a real browser over CDP** at `pirates.leagr.local:5173`, both render sites
  (`/rankings/[player]` and the PlayerModal via `/news`), both themes:
    - all four silhouettes visually distinct at real chip size;
    - tap True Baller → nothing muted (all nine others contribute);
    - tap Attacker → Danger Man, Engine, All-Rounder, True Baller lit; Finisher, Shot Stopper,
      Elite Defender, Sentinel, Utility Hero muted;
    - Escape clears; no console errors or exceptions on any page checked.
- **Contrast measured on composited pixels** (Tailwind 4 emits `oklch()`, so the colours were
  rasterised through a canvas rather than parsed): bronze 7.00 dark / 5.81 light, silver
  7.75 / 8.03, gold 6.95 / 5.57, diamond above 8 in both. Lowest is 5.57 — clear of WCAG AA.

## Assumptions and limitations

- **No data migration is performed.** The UI derives from tiers, so nothing needs
  recalculating for correctness. Persisted `playerProfile` keeps old-vocabulary strings until
  the next rankings recalculation, which happens routinely; nothing reads it for display.
- **Two supersessions are deliberately absent.** True Baller does not supersede All-Rounder,
  so both breadth badges show and the step from "three areas" to "all four" stays visible; and
  G.O.A.T. does not suppress True Baller, since they are different silhouettes making
  different statements. Eleven badges is the ceiling (three or more Elite traits); four base
  traits render ten. That is deliberate — the contributing badges have to be on screen for
  tap-to-highlight to mean anything.
- **Guardian and Maverick have no holders and may never**, since both require two simultaneous
  Elite tiers involving Shot Stopper, a rotating role stat whose denominator counts sessions
  attended rather than sessions in goal (see `202608240958`). Worth revisiting if that report's
  Option D is ever adopted.
- **`scripts/` is gitignored**, so the generator change is untracked by repo convention.
- `../reports/goals-for-against-2026.html` was already failing `npm run lint` before this work and still
  is — untouched.

## Revisions after first implementation

Two decisions were walked back once the result was on screen:

1. **True Baller no longer supersedes All-Rounder.** Both breadth badges now show. This is
   presentation-only — the server already persisted the full qualification set, so
   `playerProfile` output is byte-identical either way. Displayed All-Rounder count goes
   9 → 12 and the ceiling 10 → 11.
2. **The Breadth badges inherit the Mastery icons** rather than carrying bespoke ones, pairing
   them by requirement (All-Rounder/Complete Player = "3+", True Baller/G.O.A.T. = "all 4").
   `AllRounderIcon.svelte` and `TrueBallerIcon.svelte` were deleted.

## Revision 2 — shape by requirement, and a gradient edge

Two further changes once the badges were on screen:

3. **Shape moved from category to requirement for the multi-trait badges.** "Any 3+" is now
   notched (All-Rounder, Complete Player) and "all four" is faceted (True Baller, G.O.A.T.),
   at either tier. `shape` became an explicit property on every badge definition rather than
   a lookup on `category` — which is closer to the ADR's actual principle (declare independent
   channels, don't derive them) even though it departs from its literal `shape = category`
   wording. `category` survives as the grouping and render-order key.

    The result: Diamond spans two silhouettes and notched spans two tiers. Shape now answers
    _how broad_, material answers _at what level_, and the pairs that share an icon
    (All-Rounder/Complete Player, True Baller/G.O.A.T.) also share a silhouette — so the
    Diamond badge reads unmistakably as the Elite version of the Gold one.

4. **Every badge gained a 2px gradient edge.** Each badge is now two nested elements: the
   outer carries the shape plus a light-to-deep diagonal gradient, the inner carries the same
   shape inset by 2px plus an opaque fill.

    Two constraints drove the structure. `clip-path` clips borders, rings, outlines and
    shadows alike, so a clipped shape cannot carry a real border — the edge has to be a layer
    behind. And the fills had to move from translucent tints to opaque shades, because the
    edge gradient sits directly behind the inner element and a translucent fill would let it
    bleed through the whole badge instead of showing only as a rim.

    The `*-inner` clip-path corners are tuned rather than copied: insetting the outer polygon
    by 2px while keeping its corner value leaves the diagonal edge about 1.4px against 2px on
    the straight edges, so the corner is shifted in to compensate.

    Contrast **improved** as a side effect of the opaque fills — 11.9–12.5 in dark (was ~7)
    and 6.4–8.8 in light (was ~5.6), all re-measured on composited pixels.

## Revision 3 — supersession follows the shape family, and bronze leaves the amber ramp

5. **Supersession now runs within the shape family, not the category.** Making shape follow
   the requirement (revision 2) left the supersession links still wired to the old category
   grouping, so Dan rendered a Gold All-Rounder _and_ a Diamond Complete Player — two notched
   badges answering the same question. The links were rewired to match the silhouettes:

    ```text
    All-Rounder → Complete Player     (notched, "any 3+")
    True Baller → G.O.A.T.            (faceted, "all four")
    ```

    G.O.A.T. no longer supersedes Complete Player: they are different requirements with
    different silhouettes, so both show, exactly as All-Rounder and True Baller both show at
    base level. Each of the four shape families now contributes at most one badge, which is
    asserted directly over all 81 combinations and puts the ceiling back at **ten** — the same
    for four base traits and for four Elite ones.

    Displayed All-Rounder count 12 → 10 (the two Complete Players absorb theirs). Persisted
    `playerProfile` is unchanged, as always: it stores qualification, not presentation.

6. **Bronze moved from the amber ramp to orange.** Bronze (`amber`) and gold (`yellow`) sat
   about 15° of hue apart and read as the same colour at badge size — only the text and rim
   distinguished them. Bronze is now orange and gold stays yellow, roughly 30° apart, and gold
   is deliberately the lighter of the two in both themes so the tiers separate on lightness as
   well as hue. A test locks the two onto different ramps.

    Dark-theme gold contrast moved 12.5 → 6.6 as a result (the fill lightened from `yellow-950`
    to `yellow-800`), still comfortably clear of WCAG AA.

## Revision 4 — outlined, 1.5px

7. **Badges are outlined rather than filled.** The inner layer now paints the page surface
   instead of a tier tint, so only the rim shows. It still cannot be transparent — the edge
   gradient sits directly behind it and would bleed across the whole badge — which means the
   surface is _assumed_ rather than inherited. See the known issue below.

8. **The edge went from 2px to 1px**, accepting the reduced two-tone legibility. This required
   retuning the `*-inner` clip-path corners each time: the bevel compensation is
   `outer + d√2 − 2d`, so the notched inner ended at 8.4px and the faceted at 9.2px. Anyone
   changing the edge width has to redo this or the diagonals change weight.

    Contrast in the outlined style: 8.6–11.1 dark, 4.7–7.3 light. Still clear of WCAG AA, but
    the light-theme margin is now thin (gold 4.72 against a 4.5 floor) where the filled style
    had 6.4–8.8.

### Known issue — the surface assumption

The inner layer is hardcoded to `bg-gray-50 dark:bg-gray-800`. That is correct on
`/rankings/[player]`, where badges sit directly on the page background, but **wrong inside
`PlayerModal`**, whose header sits on a translucent dialog surface — the badge interiors render
as visibly lighter patches. This did not exist in the filled style, where the interior was
meant to be its own colour.

Two ways out, neither done:

- expose the surface as a CSS custom property with the page background as its default, and set
  it on the modal;
- render the rim as a stroked SVG polygon so the interior is genuinely transparent. This is the
  correct fix but needs the badge's aspect ratio at render time to keep the bevel at 45°, since
  `preserveAspectRatio="none"` would skew it.

## Revision 5 — the uneven outline was the gradient, not the geometry

The 1.5px outline looked thicker along the top than the bottom. Measuring the painted gap on
each side first showed the geometry was **exactly symmetric** — 1.5px per side, integer box
positions, no subpixel rounding — so the cause was elsewhere.

It was the gradient. `bg-gradient-to-br` ran light-to-dark, so on a wide, short badge the top
edge sat at the light end and the bottom at the dark end, where it lost contrast against the
background and visually receded. A real bevel effect, and unwanted.

Fix: **both stops now sit on the same Tailwind step and vary only in hue.** Tailwind 4's
scales are oklch-based, so a shared step means shared lightness. Measured as the ratio between
each stop's contrast against the surface, the two edges went from 1.30–1.77 (dark) and
0.55–0.74 (light) to **0.89–1.09 in both themes**. Orange reads slightly darker than amber at
the same step, so bronze's dark pair is offset by one to compensate.

The lesson worth keeping: an outline that looks uneven is not necessarily uneven. Measure the
geometry before adjusting it — here the geometry was already perfect and the fix was entirely
in the colour ramp.

## Revision 6 — popover replaces the highlight interaction

The tap-to-highlight lattice was removed and replaced with a Flowbite `Popover` per badge
showing what the badge takes to earn.

- **Removed**: `selectedId` state, the mute/emphasis classes, the Escape handler, and
  `relatedBadgeIds()` from `shared/badges.js` along with its tests. Badges went from
  `<button onclick>` to a focusable `<span role="button">` wired by `triggeredBy="#id"`,
  matching `ScorerPopover` / `TrophyPopover` / `PlayerRatings`.

- **Popover copy is per badge kind.** A trait badge's requirement is just its own label, so
  restating it would be noise — it explains the band and the stat instead ("Top 15% for saves
  per session"). Combination badges state the requirement. Only count-based badges also list
  which traits earned them: an archetype's requirement already names its two, but "any 3+" does
  not say which three.

- **`BASE_PERCENTILE` / `ELITE_PERCENTILE` moved into `shared/badges.js`** and `rankings.js`
  now imports them. They were local constants inside `calculatePlayerProfiles()`; with the UI
  quoting percentages at users, a duplicated copy would eventually lie. `TRAIT_DEFS` also gained
  the stat each trait measures.

- **Trigger ids carry a per-instance uid**, so two `PlayerBadges` on one page cannot collide.

### Testing note

Flowbite popovers open on the bubbling `focusin`, not `focus`, and debounce the trigger by
`DEFAULT_TRIGGER_DELAY` (200ms). The suite has an `openPopover()` helper that fires `focusin`
and waits 350ms; without both, the content never mounts and the assertions fail in a way that
looks like a component bug. Verified independently in a real browser over CDP with a genuine
`Input.dispatchMouseEvent` hover.

## Revision 7 — the popover's second line becomes a grade

The popover's subtitle read `<tier> <category noun>` ("diamond mastery badge"). It now reads
**`[Elite] <breadth noun>`** — Trait / Archetype / Versatility / Mastery, prefixed "Elite" when
the badge demands Elite traits — so the subtitle names the ADR's two axes directly rather than
encoding them in a colour.

`BREADTH_NOUNS`, `requiredTraitCount()`, `requiresEliteTraits()` and `gradeLabel()` were added to
`shared/badges.js`; the component's local `CATEGORY_NOUNS` map and its `capitalize` class went
away, since the text is now properly cased at source.

|           | base        | Elite             |
| --------- | ----------- | ----------------- |
| 1 trait   | Trait       | Elite Trait       |
| 2 traits  | Archetype   | Elite Archetype   |
| 3+ traits | Versatility | Elite Versatility |
| all 4     | Mastery     | Elite Mastery     |

- **Why the count and not the category.** Each multi-trait family spans two categories:
  All-Rounder is `breadth` and Complete Player is `mastery`, yet both are "any 3+". Grading by
  category would have called one of them Versatility and the other Mastery while their
  requirement is identical. Grading by count also puts the subtitle in step with the silhouette,
  which has followed the requirement count since Revision 2.

- **Why the material is not named.** The first cut of this revision read `<Material> <noun>`
  ("Diamond Versatility"). `tier` is a _function_ of (noun, Elite-ness) — Trait+base is bronze,
  Trait+Elite is gold, Versatility+Elite is diamond — so the colour added no information and
  collided across families: gold is worn by Elite traits, Elite archetypes, All-Rounder and True
  Baller, meaning "Gold" said four different things depending on the badge. Dropping it loses
  nothing; the material still carries the same facts visually on the badge itself.

- **`requiresEliteTraits()` keys on the requirement, not the tier**, precisely because gold is
  not injective — a `tier → Elite?` lookup would have to guess between Elite Trait and base
  Versatility. It splits the catalogue exactly in half, ten and ten.

- `category` is left as-is. It still drives grouping and render order, and renaming it would
  churn the catalogue, the tests and the docs for no display benefit.

Two catalogue tests hold the wiring: `SHAPE_ORDER.indexOf(shape) === requiredTraitCount(b) - 1`
for all 20 badges, so shape and grade noun cannot drift apart; and no badge's grade may contain
its own tier name, so the colour cannot creep back into the copy.

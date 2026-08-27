# Badge Supersession by Strict Implication

**Date:** 2026-08-24
**Change:** `true-baller` supersedes `all-rounder`; `goat` supersedes both `true-baller` and
`complete-player`. Display-only — no recalculation, no data migration.

## Problem

All-Rounder ("any 3+ traits") rendered next to True Baller ("all four") on the same player.
Having all four guarantees having three, so All-Rounder carried no information — visual noise
on exactly the players with the fullest badge rows.

The same redundancy existed one level up, unnoticed because nobody holds it yet: G.O.A.T.
(four Elite) displayed alongside Complete Player (3+ Elite).

The open question was whether hiding the "3+" badge would also destroy a case worth keeping —
a player with **Complete Player (Diamond, 3+ Elite) and True Baller (Gold, all four base)**.

## The rule

Supersession is **strict implication**: a badge is hidden when another badge the player holds
guarantees it. That answers the open question by itself, because Complete Player and True
Baller imply each other in _neither_ direction — being Elite at three does not give you a
fourth base trait, and being solid at four does not make you Elite at three. Both stay.

The breadth/mastery block is a 2×2 grid, `{3+, all four} × {base, Elite}`:

| Base | Elite | Qualifies for            | Was               | Now                               |
| ---- | ----- | ------------------------ | ----------------- | --------------------------------- |
| 3    | ≤2    | All-Rounder              | All-Rounder       | All-Rounder                       |
| 4    | ≤2    | All-Rounder, True Baller | **AR + TB**       | True Baller                       |
| 3    | 3     | + Complete Player        | Complete Player   | Complete Player                   |
| 4    | 3     | + True Baller            | TB + CP           | **True Baller + Complete Player** |
| 4    | 4     | all four                 | **CP + G.O.A.T.** | G.O.A.T.                          |

## Scope: why not apply implication globally

Tested and rejected. Implication across badge families is deliberate — Sniper implies Elite
Finisher, Engine implies Attacker, True Baller implies every trait pill and archetype below
it. Collapsing on that would reduce a four-base-trait player from 9 badges to 1 and a
four-Elite player to 1, destroying the layering that makes the lattice readable.

The rule is therefore scoped to run within the trait, archetype and breadth/mastery families
separately. Verified by brute force: every one of the declared `supersedes` links across the
whole catalogue was already a genuine implication before this change — the relation was
**sound but incomplete**, in exactly the two places fixed here. This completes an existing
policy rather than introducing a new one.

## Ceiling

Still ten, but reached differently. It used to be every four-trait player; it is now only the
(four base, three Elite) shape, where the block legitimately contributes two badges. In the
live pirates data the observed maximum is **9**.

## Files modified

| File                                          | Change                                                                                                                                                                           |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/shared/badges.js`                    | `supersedes` accepts `string \| string[]`; two new links; `displayBadges` flatMaps; typedef and catalogue comments rewritten around implication                                  |
| `test/lib/shared/badges.test.js`              | Supersession tests reworked; two brute-force invariants added (see below)                                                                                                        |
| `test/components/PlayerBadges.svelte.test.js` | `THREE_BASE` fixture for tests that need All-Rounder rendered; lattice list and Gold-silhouette test updated                                                                     |
| `docs/traits.md`                              | "Supersession is presentation-only" rewritten with the 2×2 table and the scoping rule; observed counts refreshed; a stale "True Baller → Gold Notched" line corrected to Faceted |

## Testing

Two invariants replace the hand-declared assertions, both brute-forced over all 81 tier
combinations:

1. **`declares only genuine implications in supersedes links`** — every declared link must be
   a real implication. Catches a link pointing the wrong way.
2. **`shows no breadth or mastery badge implied by another shown badge`** — the complement.
   Catches an incomplete relation, which is the failure mode that produced this ticket.

Both were verified to fail when the new links are reverted (the second reports
`true-baller and all-rounder both shown, but the first implies the second`), so they pin
behaviour rather than restating the catalogue.

- `npm test`: 1179 backend + 221 frontend, all passing. `npx eslint .` and prettier clean.
- Live at `pirates.leagr.local:5173`: Lunathi and Morena now show 9 badges ending in True
  Baller with no All-Rounder; Dan (3 Elite) still shows Complete Player; Mpume (3 base) still
  shows All-Rounder.

## Notes

- **No recalculation was needed.** `playerProfile` persists the _qualified_ set, which is
  unchanged — All-Rounder qualification is still recorded for every player who earned it.
  Only `displayBadges` changed, so this is purely a render-time change.
- Live effect: two players (Lunathi, Morena) lose one badge each, 10 → 9. League-wide
  displayed badges 136 → 134. Nobody else is affected — the other twelve breadth holders sit
  at three traits and never qualified for True Baller.

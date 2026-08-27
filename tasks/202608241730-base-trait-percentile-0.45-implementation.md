# Base Trait Band Moved to the 45th Percentile

**Date:** 2026-08-24
**Change:** `BASE_PERCENTILE` 0.5 → 0.45 (popover wording "Top 50%" → "Top 55%")

## Overview

Base traits were awarded at or above the median of the eligible pool. With Elite tiers now
carrying the claim of excellence, the base badge no longer needs to assert "above average" —
it marks that a stat is a real part of a player's game. The bar moved down one band position.

This is a one-constant change. Eligibility, normalisation, the Elite bar, the badge lattice
and every consumer are untouched.

## Why 0.45 and not 0.4

The user's opening question was whether to go to 0.4. Simulated against live
`data/pirates/rankings-2026.json` (73 players, 39 established), sweeping the constant:

| const | popover | base traits | players w/ badge | total badges | All-Rounder | True Baller |
| ----- | ------- | ----------- | ---------------- | ------------ | ----------- | ----------- |
| 0.5   | Top 50% | 71          | 36               | 118          | 8           | 2           |
| 0.45  | Top 55% | 79          | **38**           | 136          | 12          | 2           |
| 0.4   | Top 60% | 85          | **38**           | 153          | 14          | 3           |
| 0.35  | Top 65% | 92          | 38               | 171          | 17          | 3           |
| 0.3   | Top 70% | 97          | 38               | 188          | 20          | 5           |

**The inclusion benefit is entirely spent by 0.45.** Only 39 of the 73 players are eligible
for any trait at all. At 0.5 three of them held nothing; 0.45 admits two of those three (Pat,
Maestro) and every looser setting admits nobody further — it only adds badges to players who
already had some.

The third, Caesar, is unreachable at any bar: norms of 0.000 / 0.000 / 0.102 on the three
outfield stats, and his one strong stat (saves, norm 0.649) is gated by `sessionsInGoal: 4`
against a threshold of 5. He needs one more session in goal, not a lower percentile.

Two secondary considerations pointed the same way:

- **Gold dilution.** All-Rounder is a Gold badge earned purely from breadth. It would go from
  21% of the eligible pool to 31% at 0.45 and 36% at 0.4. Gold badges earned by breadth rather
  than excellence: 10/41 → 14/45 → 17/48.
- **Wording.** `PlayerBadges.svelte` renders the constant directly, so 0.4 would print
  "Top 60% for goals per session" on a badge. Past the median a band label starts arguing
  against itself; "Top 55%" is about as far as it goes.

## Effect on pirates 2026

Recalculated 2026-08-24. Eight players moved, all 0 → 1 (Elite is untouched — 22 Elite traits
before and after):

| Player  | Gained                              |
| ------- | ----------------------------------- |
| Pat     | Finisher (first badge)              |
| Maestro | Attacker (first badge)              |
| Les     | Defender, Engine, All-Rounder       |
| Mufasa  | Attacker, Engine, All-Rounder       |
| Cwenga  | Defender, Engine, All-Rounder       |
| Mpume   | Finisher, Utility Hero, All-Rounder |
| Chris   | Finisher, Utility Hero              |
| Ricky   | Shot Stopper, Sentinel              |

Total displayed badges 118 → 136. New bars: goals 0.216 → 0.181, off actions 0.299 → 0.268,
def actions 0.452 → 0.416, saves 0.328 → 0.294.

**Nothing outside traits moved.** A field-by-field diff of the pre- and post-recalculation
files shows 0 players with any change outside `traits` / `traitTiers` / `playerProfile` —
ELO, points, appearances, ranking points and all six norms are byte-identical. This is a pure
re-banding, as expected when only the bar position changes.

## Files modified

| File                                          | Change                                                                                                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/shared/badges.js`                    | `BASE_PERCENTILE = 0.45`, with the rationale above the constant                                                           |
| `src/lib/server/rankings.js`                  | Doc comment: "50th percentile (above the median)" → "45th percentile"                                                     |
| `test/lib/shared/badges.test.js`              | Constant assertion 0.5 → 0.45                                                                                             |
| `test/components/PlayerBadges.svelte.test.js` | Popover assertion "Top 50%" → "Top 55%"                                                                                   |
| `test/lib/server/rankings.test.js`            | New band-position test; two descriptions and the ladder comment de-medianed                                               |
| `docs/traits.md`                              | Bands section, new "Why the base bar sits below the median", refreshed Observed behaviour, limitation #3, constants table |
| `scripts/traits-report.mjs` (gitignored)      | Imports `BASE_PERCENTILE`/`ELITE_PERCENTILE` instead of mirroring them                                                    |

## Testing

The existing ten-player ladder fixture **cannot** distinguish 0.45 from 0.5 — nearest-rank
puts both on `sorted[4]` for a pool of ten, so every band test passed unchanged and none of
them actually pinned the new value. Added `places the base bar just below the median of the
eligible pool`: twenty players on a 0.00 … 0.95 ladder, where the bar sits on `sorted[8]`
(0.40) at 0.45 and on `sorted[9]` (0.45) at 0.5. Verified it fails when the constant is
flipped back, so it pins behaviour rather than restating the constant.

- `npm test`: 1176 backend (+1) + 220 frontend, all passing. `npx eslint .` clean, prettier clean.
- `scripts/traits-report.mjs`: all six self-checks green against the recalculated file — an
  independent reimplementation agreeing that the awarding rule matches what was persisted.
- Live check at `pirates.leagr.local:5173`: Pat renders `Finisher` with the popover reading
  "Top 55% for goals per session"; Maestro `Attacker`; Mpume six badges including All-Rounder;
  Lunathi unchanged at ten.

## Note

`scripts/traits-report.mjs` had its own hardcoded copy of the two percentiles and reported
eight false mismatches after the change. It already imported the badge catalogue from
`shared/badges.js`, so it now imports the band positions from there too. The duplication is
gone rather than resynced — a stale copy in the verifier turns the safety net into a false
alarm, which is the one thing it must never do.

## Follow-up

Not done, not needed for this change: the pirates **2025** rankings file was deliberately left
un-recalculated, so it still renders trait badges off its persisted 0.5-era tiers.

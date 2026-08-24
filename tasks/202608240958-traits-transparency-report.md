# Traits & Badges — full transparency report (pirates 2026)

Read-only analysis. **No production behaviour was changed**: `src/` is untouched, no rankings
were recalculated, and no awarding rule was modified.

Follows the Phase 1 audit ([`202608211227-traits-badges-documentation.md`](202608211227-traits-badges-documentation.md))
and the Phase 2 tiering change ([`202608211530-traits-tiering-implementation.md`](202608211530-traits-tiering-implementation.md));
the as-built spec is [`docs/traits.md`](../docs/traits.md).

## Why it was asked for

After the 2026-08-22 session, **Lunathi lost Elite Shot Stopper** while remaining the runaway
Ballers Board leader for total saves (142, against 84 for second place). The request was for the
whole machine laid out — every player's traits, badges, totals, per-session averages, norms,
percentiles — so the behaviour could be judged on evidence.

## What the data says

**The badge measures saves per session _attended_, not per session _kept goal_.** Save actions
were tracked league-wide on 2026-08-22, so `sessionsWithSaveActions` incremented for everyone who
turned up, including the players who were outfield. Lunathi played outfield (Mike M kept goal for
green leapers). His numerator stayed at 142 while his denominator went 23 → 24.

| Date       | Saves | Cumulative | Per session | Norm  | Base bar | Elite bar | Tier  |
| ---------- | ----- | ---------- | ----------- | ----- | -------- | --------- | ----- |
| 2026-08-08 | 14    | 135/22     | 6.136       | 0.622 | 0.161    | 0.580     | Elite |
| 2026-08-15 | 7     | 142/23     | 6.174       | 0.626 | 0.162    | **0.626** | Elite |
| 2026-08-22 | 0     | 142/24     | 5.917       | 0.563 | 0.143    | 0.586     | base  |

Two effects compounded. His rate fell 6.174 → 5.917 (denominator only), and although the Elite bar
also fell (0.626 → 0.586) it did not fall as far. He missed by **0.023**. On 2026-08-15 he _was_
the 85th-percentile player — nearest-rank makes the bar an actual player's value, and that week it
was his own, the thinnest margin the rule can produce.

**The counterfactuals are the sharpest statement of the problem:**

- Had he **not attended at all**, his average would have been carried forward at 6.174 and he would
  have **kept Elite** (0.5881 against a bar of 0.5874). Turning up and playing outfield cost him the
  badge; staying home would not have.
- Had he kept goal and made **6 saves**, he would have held it.

He simultaneously **gained Elite Defender**, so his badge set is unchanged — still all four traits
and all six combos including G.O.A.T. Only which trait renders gold moved.

Other findings worth recording:

- The badge has **changed hands three times this season** for him: Elite 04-04→05-09, base
  05-16→07-11, Elite 07-18→08-15, base since 08-22. This is not a one-off.
- The five keepers ahead of him on rate have **4–12 sessions in goal** against his 19.
  `TRAIT_MIN_TRACKED_SESSIONS = 5` is thin protection for a rotating role stat.
- **Percentile bands fix the holder count, not the standard.** With 37 eligible players there are
  always exactly 6 Elite and 13 base Shot Stoppers. Two players changed tier on 2026-08-22
  _without playing_ — the bar moved under them.

## Method

The generator rebuilds the awarding rule from scratch rather than reading the stored verdict, and
**refuses to emit a report unless it reproduces what the application persisted**. Six checks, all
passing on 73 players × 4 stats:

1. Derived `sessionsWith<Stat>` counters match the persisted ones.
2. Recomputed tiers match persisted `traitTiers`.
3. Exact `total / sessions` matches the stored `perSession`.
4. Renormalising from reproduced min/max bounds lands on the stored norms (max drift 0.0006, pure
   3-dp rounding).
5. The live rule rebuilt through the generic simulator reproduces every tier.
6. An independent per-date reconstruction agrees with the persisted tiers at the latest date.

Check 6 matters because the whole before/after and the season timeline are reconstructed from
`history[date]`, which carries `ratings.<stat>.{perSession,norm}` and `ratings.eloGames.season` per
date. `history[date].stats` is `null` for a carry-forward (absent) entry and
`history[date].stats.<key>` is `null` when that stat was not tracked that session — those two nulls
are the exact attendance and tracking signals, and are what checks 1 and 6 lean on.

Every candidate rule runs through one `simulate({ rateOf, eligibleOf })` function, so the live rule
and the options are compared on identical machinery rather than on parallel re-implementations.

## Options presented (none implemented)

| Option | Rule                                        | Pool | Elite bar | Lunathi   | Tier moves |
| ------ | ------------------------------------------- | ---- | --------- | --------- | ---------- |
| Live   | `total ÷ sessions tracked`                  | 37   | 0.586     | base      | —          |
| **A**  | `total ÷ sessions in goal`, gate ≥5 in goal | 24   | 0.580     | **Elite** | 9          |
| **B**  | unchanged rate, gate ≥10 sessions in goal   | 10   | 0.586     | base      | 12         |
| **D**  | `(total + μ·C) ÷ (sessions + C)`, C=10      | 37   | 0.683     | **Elite** | 16         |

- **A** measures the honest quantity but shrinks the pool 37 → 24, and **the data does not record
  who kept goal** — session JSON has no keeper field, only the `home/awaySaveActions` maps — so
  "in goal" has to be proxied by "recorded ≥1 save", which misses a clean-sheet keeper.
- **B** is refuted by the data: it collapses the pool to 10, _still_ leaves Lunathi outside Elite,
  and cuts Sentinel from 7 holders to 2.
- **D** (empirical-Bayes shrinkage) is the smallest and most general: no new data, no eligibility
  change, pool unchanged, and it addresses small samples across **all four** stats rather than
  patching saves alone.

Because the bands are percentiles, no option changes the _number_ of holders — only which players
hold them. That is why the report compares options by who moves, not by counts.

## Files

- **`scripts/traits-report.mjs`** (new) — rebuilds the rule, self-verifies, simulates the options
  and counterfactuals, writes the HTML. Read-only.
- **`scripts/traits-report-template.mjs`** (new) — renders the model as a self-contained page.
- **`../reports/traits-full-report.html`** (new, untracked) — the generated report.
- `scripts/show-player-stats.mjs` — **left alone**. It is stale: `pull`, `THRESHOLD_BUMP` and
  `STATIC_THRESHOLD` no longer exist in `rankings.js` after `ae2803e`.

Published as an Artifact: <https://claude.ai/code/artifact/cb3b4bb5-dfe9-4e11-8e66-a735b1d5bc21>

## Verification

- The six self-checks above, enforced at generation time (`process.exit(1)` on any mismatch).
- Lunathi's 142 saves cross-checked against the raw session files (`games.rounds[][]` plus
  `games['knockout-games'].bracket`): 19 sessions in goal summing to exactly 142.
- Ballers Board figures reproduce `src/routes/api/ballers-board/+server.js` — Lindo 513, Veli 507,
  Dan 486, Lunathi 471, Jay 441.
- Chart palette validated with the dataviz validator for both light (`#A16207`/`#2F6FAF`) and dark
  (`#BF8517`/`#3E8ACE`) surfaces — all six checks pass on each.
- Rendered and driven in a real browser: sorting, search, stat switching, row expansion, tooltips,
  and both themes (the charts read CSS tokens at draw time, so a `data-theme` MutationObserver
  redraws them).
- `npm test` green — 937 backend + 186 frontend. `npx eslint .` clean.

## Assumptions and limitations

- `/scripts/` is **gitignored** ("Ad-hoc scripts", `.gitignore:38`), so both generators are
  untracked by convention, as `show-player-stats.mjs` already was. `.prettierignore` exempts the
  same directory, so the generators are not prettier-checked either. The
  generated HTML **is**, so the output is run through `npx prettier --write` after generation to
  match the other report files in the repo root. Note `../reports/goals-for-against-2026.html` was already
  failing `npm run lint` before this work and still is — untouched.
- "Sessions in goal" is inferred from "recorded ≥1 save action" because the data has no keeper
  field. A keeper who conceded nothing and saved nothing is invisible. Option A inherits this.
- Percentile bands are recomputed from the live distribution, so every figure in the report moves as
  the season progresses. The report stamps the source file's recalculation time for that reason.

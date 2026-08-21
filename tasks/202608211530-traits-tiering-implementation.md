# Traits & Badges — tracked-session gate and Elite tier (Phase 2)

Follows the Phase 1 audit ([`202608211227-traits-badges-documentation.md`](202608211227-traits-badges-documentation.md)).
Applies the existing 5-session rule to the stat actually being measured, and replaces the single
pass/fail bar with two tiers so that being solidly above average earns a badge and genuine
excellence is visibly separated from it. As-built spec updated in [`docs/traits.md`](../docs/traits.md).

## Correcting the Phase 1 audit

Phase 1 called the 35-game confidence pull an "arbitrary cliff". **That was wrong.** 35 season
ELO games ≈ 5 sessions is a deliberate, long-standing convention: `teamGenerator.js:39` carries
it as `GAMES_THRESHOLD = 35; // Games played before rating is fully trusted (~5 sessions)`, and
`202512101829-provisional-ratings-implementation.md` records the deliberate switch "from 5
sessions to 35 games played". The data agreed it was working — **0 of 28** players below ~4
sessions held any trait, and only established players set the bar, so one-week wonders could
not skew the group average. The bar was never the problem; where it was measured was.

## What was implemented

1. **Eligibility is now a hard gate on two conditions** — `seasonEloGames >= 35` (unchanged)
   **and** `sessionsWith<Stat> >= 5` (new). The second uses counters that already existed
   (`rankings.js:1356-1369`), so there is no new data capture. It matters because a league can
   start recording a stat mid-season: pirates began recording actions on 2026-03-07 while goals
   ran from January, so attendance from before a stat existed was counting toward "proving
   yourself" at it — Sibusiso cleared a _5-session_ defensive bar on **3** sessions of
   defensive data.
2. **The quadratic confidence pull was removed.** Once eligibility requires
   `seasonEloGames >= 35`, every eligible player has a confidence of exactly 1, so
   `norm × min(1, sg/35)²` was provably a no-op. Deleting it makes "5 sessions or nothing"
   explicit rather than emergent.
3. **Two-tier percentile bands replace the mean bar.** Per stat, over the eligible pool:
   base at the **50th percentile**, Elite at the **85th** (nearest-rank). Bands recompute on
   every recalculation, so they cannot go stale as the league grows, and scarcity is now
   consistent across the four traits by construction — previously they ranged from 15 to 22
   holders.
4. **Phantom zeros fixed.** `norm(r.goals?.perSession ?? 0, …)` yielded `0`, not `null`, for a
   player who had never had that stat tracked, putting a fake zero into the pool. Now gated on
   `perSession != null`. This only affects the stored `norm`; the composite attack/control
   ratings already coerced null to 0 and are unchanged.
5. **Elite traits render in gold with an `Elite ` prefix.** The badge lattice is untouched.

## Architecture decisions

1. **`traits` keeps its boolean shape; `traitTiers` is added alongside.** Making `traits` a
   0/1/2 map would have worked by truthiness, but every consumer and every test asserting
   `toBe(true)` would have needed touching. Additive instead:
   `traits = { isFinisher: bool, … }` (true at base-or-better) and
   `traitTiers = { isFinisher: 0|1|2, … }`. `teamGenerator.calculateTraitBalance()` and the
   combo lattice consume `traits` unchanged; only `PlayerBadges.svelte` reads tiers.
2. **The team generator is tier-blind by construction.** It reads the `traits` booleans
   (`teamGenerator.js:936`) and never sees `traitTiers`, so balancing weighs trait vs no-trait
   and an even spread only — exactly the intended behaviour. Three regression tests in
   `describe('tier blindness')` assert that identical booleans at different tiers give an
   identical `traitsNorm` and composite score, while still separating trait from no-trait.
3. **Combos read base-or-better, so a tier upgrade never changes which combos a player holds.**
   This was the explicit instruction — badges stay exactly as they are. A test asserts a
   base-tier and an Elite-tier player earn identical `playerProfile` arrays.
4. **Percentile bands rather than fixed values.** A flat 0.30/0.50 was considered and rejected
   on the data: it works for Attacker but inflates Defender to 30 of 39 holders, because
   defensive norms sit much higher than the others. Percentiles are scale-free, so one rule
   fits all four stats.
5. **Nearest-rank percentile, local helper.** No shared percentile utility exists; `momentum.js`
   likewise keeps its own `median`/`mad` local. A `percentileOf` returning `null` for an empty
   pool lets the caller award nothing rather than fall back to a meaningless bar of 0.
6. **Bands are set by the eligible pool only** — the same principle that already kept newcomers
   out of the threshold mean, now extended to players who have barely been measured on a stat.

## Files

- **`src/lib/server/rankings.js`** — `calculatePlayerProfiles()` rewritten: `STAT_SOURCES`
  table, `isEligible()`, `percentileOf()`, band computation, `traitTiers`; `pull`/`pullMap`/
  `THRESHOLD_BUMP` deleted. Phantom-zero fix in `calculateAttackControlRatings()`.
- **`src/components/PlayerBadges.svelte`** — `traitTiers` prop; tier 2 renders `goldClass` with
  an `Elite ` prefix. A held trait with no tier falls back to base, so rankings files written
  before this change still render.
- **`src/components/PlayerHeader.svelte`**, **`src/routes/rankings/[player]/+page.svelte`** —
  pass `traitTiers` through.
- **`docs/traits.md`** — Eligibility and Bands-and-tiers sections replace Confidence-pull and
  Threshold; constants table, observed figures and limitations updated.
- **`traits-audit-report.html`** — regenerated with a before/after section.

## Results (pirates 2026, 32 sessions, 72 players)

| Stat         | Eligible | Base bar | Elite bar | Base | Elite | Total (was) |
| ------------ | -------- | -------- | --------- | ---- | ----- | ----------- |
| Finisher     | 39       | 0.216    | 0.619     | 14   | 6     | 20 (16)     |
| Attacker     | 37       | 0.299    | 0.743     | 13   | 6     | 19 (16)     |
| Defender     | 37       | 0.452    | 0.683     | 13   | 6     | 19 (22)     |
| Shot Stopper | 37       | 0.162    | 0.626     | 13   | 6     | 19 (17)     |

- **Lunathi** (32 apps) and **Morena** (28 apps) — the reported cases — gain Attacker.
- **Jonathen** (21 apps) gains his first badge; **Chris, Offie, Princelinho, Wayne** (24-26 apps,
  one badge or none) each gain a second trait.
- **Jay**'s perfect 1.000 goals norm now reads as **Elite Finisher + Elite Attacker**.
- **Sibusiso** (3 tracked sessions), **Oscar** and **Nais** (4 apps) lose their traits to the
  tracked-session gate. **Pat** stops contributing phantom zeros.
- Combos move from `Complete Player 8 / Danger Man 14 / Engine 9 / Sentinel 7 / Utility Hero 2 /
G.O.A.T. 0` to `10 / 16 / 11 / 7 / 7 / 3`.

## Testing

`test/lib/server/rankings.test.js` — the `calculatePlayerProfiles` block was rewritten (18
tests). The old two-player High/Low fixture no longer works: with a two-player pool the 50th
percentile _is_ the lower player, so both would qualify. Tests now use a `ladderWith()` helper
building a nine-player 0.0-0.8 ladder plus a subject, which puts the bands at a predictable
0.4 (base) and 0.8 (Elite). Covers both bands, per-stat independence, both eligibility gates
(including the per-stat case), ineligible players not moving the bands, null norms, every combo,
and base/Elite producing identical combos.

Verified against real data by running the **shipped** functions over
`data/pirates/rankings-2026.json` in a throwaway vitest harness — reproduced the results table
above exactly, and asserted `traits[t] === (traitTiers[t] > 0)` for all 72 players and that
Pat's untracked norms are `null`.

Team-draw impact checked two ways.

- **Effect of the awarding change**: scored `calculateTraitBalance` with old and new trait data
  on the same team splits across 16 real sessions (May-Aug 2026). Mean imbalance 0.343 → 0.314
  (lower is better), range unchanged, holder counts across the four traits noticeably more even
  (e.g. 10/8/10/7 → 14/10/10/9). No regression.
- **Tier-blindness end to end**: ran the full `generateSeededTeams()` over 11 real sessions
  twice — once with every held trait flattened to base, once to Elite, booleans untouched —
  with `Math.random` replaced by a seeded PRNG reset before each run and `generateTeamNames`
  stubbed. Every draw was byte-identical, with assertions on team count and roster size so the
  comparison could not pass vacuously.

Full suite green: 934 backend + 186 frontend; lint clean.

## Assumptions / limitations

- `TRAIT_MIN_TRACKED_SESSIONS = 5` mirrors the ~5-session convention in ELO games. It is a
  session count, not a games count, because that is the unit the averages are built on.
- Bands recompute from the live distribution, so **trait counts move as the season progresses**
  and a player can lose a trait without playing worse if the field improves around them. This
  is inherent to a percentile rule and is the trade for never going stale.
- **Breadth still outranks excellence at the very top.** Because combos read base-or-better,
  four median-level traits earn G.O.A.T. — **Morena, Lunathi and Veli** now hold it, where
  nobody did before, and each renders ten badges. This was raised before implementation and the
  decision was to leave the lattice alone. The smallest available follow-up is to require at
  least one Elite trait for `Complete Player` and `G.O.A.T.`
- Unchanged and still open, all recorded in the Phase 1 audit: the two missing two-trait combos,
  save actions being a role stat, the Ballers Board ranking by totals while traits use averages,
  and the wider threshold inconsistencies (`35` hard-coded in six places, `0.66` duplicated,
  `pullFactor` meaning opposite things in two files, `calculateTraitBalance` bypassing the
  provisional gate at `teamGenerator.js:325`).

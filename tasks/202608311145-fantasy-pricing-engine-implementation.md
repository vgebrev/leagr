# Fantasy League — Player Valuation Engine

Status: **engine only**. No API, no page, no settings UI, no game. This step exists so the
prices can be argued with on real data before anything is built on top of them.

Two modes share one model: **season** (continuous league, availability is the manager's
risk) and **weekly** (pick from this week's signups, availability falls away). The weekly
mode is the one that backtests well — see "Weekly pool mode" below.

## What it does

Prices every player in a league from `rankings-YYYY.json`, denominated in **expected
fantasy points per week**:

```
price = f( E[points | plays]  ×  P(plays) )
```

The alternative — a weighted blend of ELO, stats, attendance and trophies scaled onto a
price band — was rejected. It is unfalsifiable (no way to say a price is _wrong_), it
double-counts (ELO is computed from match results; trophies are match results; form is
match results again — the same trap `202606091200-ADR-momentum-metric.md` avoided), and it
makes the budget arbitrary. Denominating price in points makes the whole model
backtestable and makes the budget mean something.

Each signal has exactly one job:

| Signal           | Job                                                        |
| ---------------- | ---------------------------------------------------------- |
| Individual stats | the observed sample of `E[points \| plays]` — the evidence |
| ELO              | the prior for `E[points \| plays]` when the sample is thin |
| Trophies         | paid through the scoring rules; plus the prior for low-n   |
| Attendance       | `P(plays)` — a **multiplier**, never an additive term      |
| Recency / form   | the weighting inside the sample, not a separate term       |

## Pipeline

```
rankings-YYYY.json history[date]
  └─ trackedStatRegime()        drop sessions outside the current tracking regime
      └─ sessionFantasyPoints() weighted points for one player-session, by source
          └─ recencyWeightedMean()   time-aware EMA, half-life 6 weeks  → observed mean
              └─ credibility shrink toward prior(elo, honours)          → μ
                  └─ × computeAvailability()                            → expected weekly points
                      └─ priceFromExpectedPoints() + dampPrice()        → price
```

## Scoring: what a point is

Everything downstream is denominated in these, so this is the table to read first. Points
for **one player-session**, all of them in `DEFAULT_FANTASY_CONFIG.scoring`:

| Source           | Weight  | Applied to                                           |
| ---------------- | ------- | ---------------------------------------------------- |
| Appearance       | **2.0** | flat, for turning out                                |
| Goal             | **4.0** | × goals scored                                       |
| Offensive action | **1.5** | × offensive actions (the closest thing to an assist) |
| Defensive action | **1.5** | × defensive actions                                  |
| Save             | **0.7** | × save actions                                       |
| Match point      | **0.5** | × `points.match`, already 3/1/0 per league game      |
| Knockout         | **0.5** | × `points.knockout`, already 4 per knockout win      |
| League win       | **5.0** | once, if their team won the league that session      |
| Cup win          | **4.0** | once, if their team won the cup                      |

```
FP = 2
   + 4·goals + 1.5·offActions + 1.5·defActions + 0.7·saveActions
   + 0.5·points.match + 0.5·points.knockout
   + 5·leagueWinner + 4·cupWinner
```

Only stat types in the current tracking regime are paid for — a goals-only session from
before March 2026 is a non-observation, not a session where a player recorded zero
tackles.

Two weights carry an argument rather than a guess:

- **Save is 0.7**, far below its raw volume, because saves are a role stat with a rotating
  keeper (`docs/traits.md`). A full shift in goal can out-count a striker's hat-trick
  several times over, and paying per save at goal rates would make the keeper the
  automatic first pick every week.
- **Match point and knockout are 0.5**, deliberately low. They are team-derived, and the
  balancer decides who plays with whom, so they are the part of a score that is luck of the
  draw. Keeping them small is the same argument the ratings audit made about team GF/GA.

`sessionFantasyPoints()` returns the total _and_ the per-source split, and both report
scripts print it — the `app / goal / off / def / save / res / tro` columns. A price is
meant to be arguable: "you cost 12.0 because you're expected to score 57.5, a third of it
from offensive actions".

## Architecture decisions

**No new data store.** Prices are rebuilt by deterministic replay from the season's first
usable session on every call, matching how `updateRankings()` rebuilds rankings from
session files and how momentum recomputes at render time. It also yields the full price
series for free, so a sparkline and a "since last week" delta cost nothing. A
`fantasy-YYYY.json` only becomes necessary when squads exist and a manager's team value
has to be held at _purchase_ price.

**Tracking-regime gate, shared with momentum.** The regime rule was inline in
`buildBallersMomentum()`; it is now `trackedStatRegime(players)`, exported and used by
both. Pirates tracked goals only from 2026-01-03 and all four stat types from 2026-03-07 —
summing across that boundary reads as the whole league improving. On pirates this leaves
**24 usable sessions of 33 ranked**.

**Raw counts, not the existing `*Norm` fields.** `tasks/202608271319-attack-control-ratings-audit.md`
found min-max normalisation to be the dominant distortion in `goalsNorm` /
`attackingRating` etc. (right-skewed inputs put median goals/session at 0.21), plus a live
`?? 0` bug at `rankings.js:1826-1827`. Fantasy points come from `history[date].stats`
directly — same source, none of the distortion.

**Availability starts at the player's debut**, not at season start. Charging a July joiner
for missing January would price every newcomer as unreliable by construction.

**Discipline applies to the current snapshot only.** Suspensions and no-shows are a "now"
concern; historical prices stay pure performance.

## Calibration (pirates 2026, 24 usable sessions, 73 players, 37 established)

Prior coefficients are **fitted, not guessed** — regressed on each player's _observed_
recency-weighted points/session (not the shrunk μ, which contains the prior and would make
the fit circular). Measured 2026-08-31, and a fixed point on re-run:

| Coefficient            | Value | Note                                 |
| ---------------------- | ----- | ------------------------------------ |
| `PRIOR_ELO_BETA`       | 0.554 | in pool SDs of points/session        |
| `PRIOR_HONOURS_GAMMA`  | 0.048 | ≈ 0 given ELO — see below            |
| R²                     | 0.334 |                                      |
| corr(elo, pts/session) | 0.577 | inflated by construction — see below |

Two findings worth keeping:

- **Last season's honours say almost nothing that ELO has not already said** (γ ≈ 0.05).
  The term is kept because it is the only signal that survives a season boundary intact,
  but it is not a meaningful trophy premium and should not be presented as one.
- **corr(elo, points/session) = 0.577 is partly self-referential.** Fantasy points pay for
  match results and trophies, which is exactly what ELO is computed from — against the
  0.173 the ratings audit measured for ELO vs _individual_ output. Acceptable, because the
  prior only carries weight when a player has too little evidence of their own, and at that
  point "they win a lot" is the best guess available.

Health checks at these settings: **0% of players at the price floor, 7% at the ceiling**,
and the top-5 squad costs **60.0 against a 49.0 budget** — so the budget forces a choice,
which is the whole point of having one.

## Files

| File                                     | Role                                                                                                                                         |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/fantasyPricing.js`       | **New.** The whole model. Pure — no I/O, no `data.js`.                                                                                       |
| `src/lib/server/momentum.js`             | `trackedStatRegime()` / `STAT_TYPES` extracted and exported; `buildBallersMomentum` now calls it. Behaviour unchanged (62 tests still pass). |
| `scripts/fantasy-pricing-report.mjs`     | **New.** Offline price list + prior fit + distribution + budget-bite check.                                                                  |
| `test/lib/server/fantasyPricing.test.js` | **New.** 28 tests.                                                                                                                           |

## Testing

`npm test` — 1207 backend, 241 frontend, all passing. The new tests cover scoring by
source, the regime gate (an out-of-regime session is a non-observation, not a zero),
recency weighting on calendar time, availability shrinkage / suspension / no-show floor,
price clamping and step rounding, damping caps in both directions, replay determinism, and
the breakdown summing to the observed mean.

Look at real numbers with:

```bash
node scripts/fantasy-pricing-report.mjs pirates 2026
```

## Open calibration questions

1. **Save weight (0.7) is a first guess.** Saves are a role stat with a rotating keeper, so
   raw volume dwarfs goals. The intended calibration route is median price by badge
   archetype — if Shot Stoppers price systematically below Snipers, tune this.
2. **Thin-sample newcomers price high.** A player with 2–3 sessions who has attended all of
   them gets a prior-dominated μ and a lightly shrunk availability, landing mid-table. The
   `provisional` flag marks them; whether they belong in the market at all is a game-design
   decision, not a pricing one.
3. **No backtest yet.** The model is backtestable by construction — price as of session
   _T_ from data ≤ _T_, correlate against points actually scored in _T+1…T+4_ over a
   rolling origin. Worth doing before the game is built. Note the audit's power warning:
   ~24 sessions gives Kendall τ s.e. ≈ 0.09, so expect wide error bars.

## Limitations

- **24 usable sessions.** A fresh league will be almost entirely prior-driven until it has
  ~5 sessions of its own.
- **No positions, minutes, clean sheets or cards exist** in the data; "assists" is
  approximated by `offActions`, and keeper time is proxied by "recorded a save"
  (`docs/traits.md`).
- **Attendance is partly endogenous.** The balancer decides who plays with whom, and
  `matchPoint`/`leagueWin` are team-derived, so part of every price is luck of the draw.
  Keeping team-derived weights low relative to individual ones is the mitigation — the same
  argument the ratings audit made about team GF/GA.

---

# Weekly pool mode

Added after the season mode's prices were reviewed. Two problems showed up, and they turn
out to be the same problem.

**The ceiling clamp was destroying the information managers pick on.** Season mode anchors
on the 90th percentile of expected weekly points and clamps, which put five players at
12.0 — Dan among them. Dan is 315 ELO clear of the next player, has 24 trophies to
Lunathi's 17, and beats him 3.42 to 1.18 on goals/session and 13.47 to 5.79 on offensive
actions. He is not the same price as Lunathi, and a game that says he is has thrown away
its most important distinction.

**Availability was doing the compressing.** Dan's 57.5 points/session is the best in the
league, but 0.67 availability drags his expected _weekly_ points down to where the clamp
catches him alongside players who score less and turn up more.

In a weekly game the second problem dissolves and takes the first with it: **everyone in
the pool signed up, so they are available by construction.** Expected points per session
becomes the whole signal, and the price band has to carry its full spread.

## What changes

|               | Season                   | Weekly                                 |
| ------------- | ------------------------ | -------------------------------------- |
| Price         | `f(μ × P(plays))`        | `f(μ)`                                 |
| Pool          | every ranked player      | the session's signups                  |
| Top anchor    | 90th percentile, clamped | the pool **maximum**                   |
| Bottom anchor | fixed floor              | 10th percentile of the pool            |
| Data cutoff   | latest session           | strictly **before** the session priced |

Anchoring the top on the pool maximum is the fix: the best available player is always
exactly at the ceiling and never shares it. Anchoring the bottom on the 10th percentile
rather than the minimum stops one very weak signup dragging the whole scale.

On 2026-08-15 (a pool that included Dan) this gives Dan 12.0 and Veli 10.0 — two full
points clear, where season mode had them level.

Because prices use only data from _before_ the session, any past session can be replayed
exactly as a manager would have seen it that morning. That is what makes the mode
backtestable rather than merely plausible.

## Squad size is 5, deliberately one short of a drawn team

Pirates draws **six a side** — measured over 265 draws: 219 six, 43 five, one four, two
seven, mean 5.84. So the obvious choice is a squad of 6, and it was tried.

It measures worse. Picking 6 from a ~24 pool forces a quarter of the pool into every
squad, which leaves less room for a good pick to separate from a bad one:

| squad | budget | premium bought      | capture | edge      |
| ----- | ------ | ------------------- | ------- | --------- |
| **5** | 43.7   | 3.04 of top 5 (61%) | **79%** | **1.251** |
| 6     | 50.6   | 3.67 of top 6 (61%) | 77%     | 1.167     |

A fantasy squad is a selection, not a team sheet — nobody expects the five they picked to
line up together — so the sharper game wins and `squad.size` stays **5**. A league that
wants the squad to mirror its draw can set it; the model does not care, and affordability
holds the game's shape either way (61% of the squad is premium at 0.90 at both sizes).

The size-6 re-sweep also confirmed the affordability cliff does not move with squad size:
still exactly at 1.00, where the top N become exactly affordable, the optimum is the top N
in 100% of weeks, and the near-optimal pool collapses (23 players to 18 at size 6, 23 to 15
at size 5).

Worth recording, because it is the trap in the tuning: **edge rises monotonically toward
that cliff** — 1.167, 1.223, 1.270 at 0.90/0.95/1.00. Maximising it walks you straight off.
It is a sanity check, not an objective function.

## Backtest (24 sessions, pirates 2026)

`node scripts/fantasy-weekly-report.mjs pirates all`

| Metric                                | Value     | Reading                                                              |
| ------------------------------------- | --------- | -------------------------------------------------------------------- |
| Mean Spearman ρ(price, actual points) | **0.353** | price predicts a week, but loosely                                   |
| Mean capture                          | **76%**   | the expected-points-optimal squad takes 76% of the hindsight maximum |

ρ climbs through the season as evidence accumulates — −0.08, 0.12, 0.21 over the first
three sessions of the regime against 0.54, 0.66, 0.51 for the last three. Early prices are
prior-dominated, and the prior is weak; that is the model being honest about what it knows
rather than a defect.

Both numbers sit where a game wants them. ρ near 0.9 would mean the week is solved before
it starts; ρ near 0 would mean price is decoration and the game is a raffle. 76% capture
says picking well matters and still leaves real variance to the day.

## The mini-game

`bestSquad(candidates, budget, size, valueOf)` is an exact integer knapsack over half-unit
prices — not greedy, which would misprice on points-per-pound. Pools are ~24 and squads
are ~5, so the table is trivial. It serves both ends of the week:

- before the session, `valueOf = expectedPoints` → the squad to beat;
- after it, `valueOf = actual points` → the hindsight-best team, which is what "best picked
  team of the week" is measured against.

`sessionActuals(players, date, weights, regimeTypes)` settles a completed session from the
same scoring rules used to price it, so the currency never changes between picking and
scoring.

## Files added

| File                                | Role                                                                                                                                                            |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/fantasyPricing.js`  | `buildWeeklyPrices`, `priceInPool`, `bestSquad`, `sessionActuals`; `expectedPointsSnapshot` split out of `priceSnapshot` so both modes share the μ computation. |
| `scripts/fantasy-weekly-report.mjs` | **New.** One week's prices, the optimal squad, the settlement, and a `all` mode running the full backtest.                                                      |

## Budget: the only knob worth tuning

Budget was originally `size × median price × 1.15`. That is the wrong quantity — the
question a manager faces is "how much of the best available squad can I afford?", and the
median says nothing about it. On 2026-08-15 it produced a budget of 31.5 against a top-five
cost of 46.5, which priced Dan out of the optimal squad entirely: the model's most
expensive player was never worth buying.

It is now a fraction of what the `size` most expensive players in the pool cost
(`deriveBudget`), which sets that fraction directly and holds it steady whether the week's
pool is strong or weak.

### Where the value comes from

Swept over all 24 backtest sessions at squad size 5 (see "Squad size" above for the size-6
re-sweep, which moves the numbers but not the conclusion). `edge` is how much the
expected-points-optimal squad beats a random affordable one; `distinct` counts players
appearing in any squad within 3% of optimal, out of a ~24 pool.

| affordability | budget (mean) | top-5 bought | at price floor | capture | edge      | distinct | optimum _is_ the top 5 |
| ------------- | ------------- | ------------ | -------------- | ------- | --------- | -------- | ---------------------- |
| 0.750         | 36.5          | 1.79         | 0.25           | 73%     | 1.145     | 23.2     | 0%                     |
| 0.800         | 38.9          | 2.04         | 0.13           | 72%     | 1.138     | 23.2     | 0%                     |
| **0.825**     | **40.1**      | **2.42**     | **0.08**       | **76%** | **1.198** | **23.2** | **0%**                 |
| 0.850         | 41.3          | 2.63         | 0.08           | 76%     | 1.190     | 23.2     | 0%                     |
| 0.900         | 43.7          | 3.08         | 0.04           | 79%     | 1.256     | 23.2     | 0%                     |
| 0.950         | 46.1          | 3.63         | 0.00           | 79%     | 1.255     | 22.2     | 0%                     |
| 1.000         | 48.6          | 5.00         | 0.00           | 82%     | 1.296     | 14.8     | **100%**               |

Budgets are rounded to the half unit prices move in, so a real week reads 40.0 or 38.5 —
the means above are averages across 24 sessions, not numbers anyone sees. At 0.825 actual
budgets ran 37.0 to 46.0, clustering around 40.

**There is a cliff at 1.00**, and it is structural rather than empirical: the top five
becomes exactly affordable, so it is always the answer. The optimum is the top five _every
single week_ and the near-optimal pool collapses from 23 players to 15 — every manager
picks the same team and the game is over.

**The setting is 0.825, deliberately below the measured optimum.** 0.90 scores better on
capture (79% vs 76%) and discrimination (edge 1.256 vs 1.198), and on those numbers alone
it is the better setting. But it hands you 3.08 of the top five — 60% of the squad picked
for you before you start. At 0.825 you buy 2.42, so half the squad is genuinely your call,
and it costs nothing at all against 0.85 on either metric while landing the budget near 40.

That is a preference for a more open game over a more predictable one: a taste call, made
knowingly, at a measured price of three points of capture against 0.90.

### Tightening the budget does not cause floor-filling

The obvious worry about a tighter budget is that squads degenerate into "two stars and
three 4.0 fillers". Measured, they do not — the `at price floor` column above is the mean
number of the five picks sitting at the 4.0 floor, and it is **0.08 at 0.825** and never
above 0.25 even at 0.75.

The reason is structural: price is linear in expected points, so a floor-priced player is
honestly poor value rather than a bargain, and the optimiser has no reason to reach for
one. Across the last eight sessions the optimal squads contained exactly one 4.5 pick and
no 4.0s — they are consistently one or two premiums plus genuine mid-tier players:

```
2026-08-08  budget 40.5  ->  Veli 12.0, Lindo 9.0, Morena 8.0, Ricci 6.0, Brian 5.5
2026-08-22  budget 40.5  ->  Jay 12.0, Morena 8.5, Mike W 7.0, Xavier 7.0, Denzo 6.0
2026-08-29  budget 40.0  ->  Dan 12.0, Veli 10.5, Lunathi 6.5, Mufasa 6.0, Hayden 5.0
```

This is the property that would break first if the price mapping ever stopped being linear
in expected points — worth re-measuring if that changes.

Worth recording, because it is the trap in the tuning: **`edge` rises monotonically toward
the cliff** — 1.198, 1.190, 1.256, 1.255, 1.296 across the range. Maximising it walks you
straight off. It is a sanity check, not an objective function.

### Raising the ceiling does not help

The obvious lever — widen the band from 4–12 to 4–15 so the stars cost more — was measured
and is **worse at every affordability**:

| band | afford 0.85          | afford 0.90    | afford 0.95 |
| ---- | -------------------- | -------------- | ----------- |
| 4–12 | edge 1.199           | edge **1.251** | edge 1.253  |
| 4–15 | edge 1.113           | edge 1.210     | edge 1.248  |
| 4–18 | edge 1.149 (at 0.80) | edge 1.226     | —           |

Prices are mapped pool-relative, so raising the ceiling only stretches the star-to-floor
_ratio_. That makes premium players disproportionately expensive, pushes the optimum toward
cheap players, and leaves price _less_ informative about who to pick — while the shape of
the game (`distinct`, "optimum is the top 5") does not move at all. It is a rescale, and a
mildly harmful one. Dropping the floor to 3.0 is a wash (edge 1.265 vs 1.251, inside noise).

**The band is cosmetic; affordability is the game.**

## Open questions for the weekly game

1. **True debutants price at the pool mean.** With no history their μ is the prior, which
   lands them mid-table (Mike M, 2026-08-22, priced 6.0 having never played). Correct
   Bayesian behaviour, and they are flagged, but it makes unknowns lottery tickets. Whether
   that is a feature is a game-design call.
2. **The pool is the signup list**, which can change up to the registration deadline. Prices
   would need locking at the same moment the team draw locks.

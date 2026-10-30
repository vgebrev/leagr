# ADR: Fantasy Positions

**Status:** Accepted — **parked**. No code, no script, no product change. This records the
design and the evidence behind it so it can be picked up without re-deriving any of it.
**Context:** Weekly fantasy mini-game (`src/lib/server/fantasyPricing.js`, `fantasyManager.js`)
**Decision:** If positions ship, they are **formation slots the manager assigns freely**, scored
by blended per-slot weight tables, with **pricing left on the flat table**. Positions derived as
a player attribute are rejected; position-aware pricing is rejected.

## Context

A manager asked to drag their fantasy picks into custom positions instead of the default
price-descending order. As raised that is cosmetic — every player is scored under one flat
table, so where a tile sits changes nothing. The question underneath it is the real one: should
fantasy have positions, with different stats paying differently by slot, to create squad
building and widen the gap between a good manager and a careless one?

Everything below was measured against `data/pirates/rankings-2026.json` over **27 real
sessions**, driving the live `buildWeeklyPrices` / `sessionActuals` so the prices and pools are
the ones managers actually saw.

## Evidence

### 1. Position weights on their own are a no-op

Reweighting the four tracked stats into GK/DEF/MID/FWD tables and re-ranking all 39 established
players gives Spearman against today's flat ordering of:

| Slot | Spearman vs flat |
| ---- | ---------------- |
| DEF  | 0.974            |
| MID  | 0.995            |
| FWD  | 0.960            |
| GK   | 0.799            |

Dan, Jay, Sphe, Veli and Lindo top every table. Fantasy points are dominated by **volume of
involvement**, and the best players do more of everything — so a reweight on its own would be
the same kind of no-op as the drag-ordering that prompted the question. This is the finding the
whole design has to answer to.

### 2. A formation to fill is what binds

With a `GK / DEF / MID / MID / FWD` shape and the manager free to slot anyone anywhere, the
optimal squad shares only **2.07 of 5 picks** with today's flat optimum. The squad you buy
changes almost completely. The constraint, not the weights, is the mechanism.

### 3. Arrangement is a genuine decision

Slotting the **same five players** well versus badly is worth **15.4%** of squad expected points
(11.6–24.3% across the 27 weeks). That is what would make the drag gesture the manager asked for
actually mean something.

### 4. Selection is nearly position-agnostic — the weak spot

Buying today's flat-optimal five and then arranging it optimally costs only **3.0%** against the
true shaped optimum (worst weeks 6.2–6.8%). The new skill is concentrated in arrangement, not in
the market. Whether 3.0% is enough separation at the buying end is **the open question**, and it
is the one the report in "Next step" exists to answer.

### 5. Derived positions are too unstable to be a player attribute

Week-to-week position changes for the same player:

| Classification rule               | Churn     | GK pool per week |
| --------------------------------- | --------- | ---------------- |
| Pool-relative z-score over shares | **21.3%** | 0–4 (median 2)   |
| League-absolute share thresholds  | **10.3%** | 0–4 (median 2)   |

Absolute thresholds halve the churn and are still far too noisy to present as an identity. A
constrained squad was also **infeasible in 3 of 27 weeks** under a strict derived-keeper gate —
no eligible GK existed in the pool at all. This is why the design does not label players.

### 6. The keeper slot trends cheap

In 24 of 27 weeks the GK slot went to a sub-6.0 player, often the pool's cheapest (Prosper 4.0,
Dave 4.0, Irry 4.0, Caesar 4.0). Recognisable FPL behaviour — cheap keeper, spend up top — but
if it is _always_ the literal cheapest, the slot is a fixed tax rather than a decision.

## Decision

### Positions are slots, not player attributes

The manager assigns freely. No eligibility rules, no derived label on a player, nothing to
recalculate when other people play. The formation is the constraint; the skill is fitting
profiles to slots.

This is only sound because of finding 5 — there is no stable positional identity in this data to
enforce — and it is what makes the original drag gesture real rather than cosmetic.

### Weight tables are blended, not one stat per slot

Positional stats only. `appearance`, `matchPoint`, `knockout`, `leagueWin` and `cupWin` are not
positional and stay flat in every table. Flat baseline for comparison is
`goal 4 / offAction 1.5 / defAction 1.5 / save 0.7`:

| Slot | goal | offAction | defAction | save | reads as                                  |
| ---- | ---- | --------- | --------- | ---- | ----------------------------------------- |
| GK   | 4.67 | 0.78      | 1.56      | 2.02 | saves ~3x flat, still paid for coming out |
| DEF  | 4.33 | 0.94      | 2.05      | 0.94 | defensive actions lead, a goal is a bonus |
| MID  | 3.44 | 1.55      | 1.55      | 0.77 | balanced across attack, defence and goals |
| FWD  | 6.12 | 1.88      | 0.75      | 0.66 | goals lead, offensive actions contribute  |

These are candidates sized to demonstrate the mechanism, not tuned constants.

### Neutralisation is a rule, not a tuning pass

Each table is scaled so the **league-median established player scores the same in any slot**
(measured factors for the table above: GK 0.778, DEF 0.787, MID 0.861, FWD 0.942). Without it a
slot becomes a points farm or a tax and the formation stops being a choice. It must be asserted
as a property and computed, never hard-coded.

### Pricing does not change

`fantasyPricing.js` stays on the flat table. Price remains `f(E[points | flat scoring])`.

This is load-bearing. The gap between a player's flat price and their yield **in the slot you put
them in** is exactly the edge a manager hunts — findings 3 and 4 are measured with flat prices.
Pricing each player at their best position would close that gap and take most of the game with
it. It also keeps `PRIOR_ELO_BETA = 0.554` and `PRIOR_HONOURS_GAMMA = 0.048`
(`fantasyPricing.js:50-51`) valid; they were fitted against flat weights.

So positions would touch **settlement only**: `sessionFantasyPoints(entry, weights, regimeTypes)`
(`fantasyPricing.js:181`) gains a per-slot weight table, reusing the existing
`settings.fantasy.scoring` override path (`resolveFantasyConfig`, `fantasyPricing.js:150-158`;
`FantasySettings` at `src/lib/shared/types.js:78-86`).

**Budget is the knob that moves.** `deriveBudget` (`fantasyPricing.js:352-358`) is calibrated at
`affordability 0.825` against an unconstrained top-5. A formation changes the spend pattern, so
the affordability sweep has to be re-run under the constraint before anything ships.

Squad size stays **5**. It is separately calibrated
(`tasks/202608311145-fantasy-pricing-engine-implementation.md`) and is not in question here.

## Alternatives rejected

| Alternative                                | Why rejected                                                                                                                                                                                                                               |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Position as a derived player attribute** | Finding 5: 10.3% churn at best, and 3 of 27 weeks had no eligible keeper. A player's position would silently change between weeks.                                                                                                         |
| **Position weights with no formation**     | Finding 1: collapses to a mild rescale. Everyone slots everyone into their best-paying position and nothing is learned.                                                                                                                    |
| **Position-aware pricing**                 | Closes the flat-price-vs-slot-yield gap that findings 3 and 4 measure, and invalidates the fitted priors. Removes the game it enables.                                                                                                     |
| **Splitting assists out of `offActions`**  | `trackedStatRegime()` (`momentum.js:199-228`) defines the regime as the stat types in the latest tracked session, so a fifth type drops all 26 fully-tracked sessions out of regime and collapses pricing. Needs a regime migration first. |

## Data capture

- **Clean sheets — derivable today, zero capture change.** `homeScore`/`awayScore` already give
  it; 614 team-side clean sheets in the corpus, 311 in 2026. **Measure before paying for it**:
  teams are re-drawn every week by the balancer, so a clean sheet may be closer to luck of the
  draw than to defending. The precedent is `docs/traits.md` killing the per-match keeper rate on
  ICC 0.05 — same test, same bar.
- **Explicit keeper marker per match — new capture, highest value.** Today "in goal" is proxied
  by "recorded at least one save"; **280 of 921 team-sides record no save at all**, so those
  keepers are invisible, and the gloves rotate 2–6 times per team-session.
  `docs/traits.md:129` already names this swap and calls it cheap once the flag exists.

## Next step when unparked

A read-only `scripts/fantasy-positions-report.mjs`, modelled on `scripts/fantasy-weekly-report.mjs`
(plain import from `../src/lib/server/fantasyPricing.js`, `[leagueId] [date|all]`). It needs its
own constrained optimiser — `bestSquad()` (`fantasyPricing.js:784-822`) is an exact knapsack with
no notion of slots — but pools are ~24 and squads 5, so enumeration with a 5! arrangement inner
loop is instant.

It should reproduce the baselines above and add: `edge` / `capture` / `distinct` under the
formation against the current unconstrained figures (ρ 0.353, capture 76%, edge 1.198,
distinct 23.2); the affordability sweep re-run under the constraint; GK-slot price distribution;
clean-sheet reliability; and keeper-proxy error. Formations worth sweeping:
`GK/DEF/MID/MID/FWD`, `GK/DEF/DEF/MID/FWD`, `GK/DEF/MID/FWD/FWD`, and a flexible
`>=1 GK, >=1 DEF, >=1 FWD`.

## Risks

- **3.0% may be too thin at the market end.** Arrangement clearly matters; selection barely does.
  If no formation widens it, the honest conclusion is "positions are an arrangement minigame, not
  squad building" — worth writing down either way.
- **The keeper slot may be a fixed tax** rather than a decision (finding 6).
- **Neutralisation is measured on pirates.** Another league would need its own factors, or the
  rule computed per league at settlement.
- **Captain interacts with slots.** Doubling a FWD in a goals-heavy table carries more variance
  than doubling a GK; the captain's contribution by slot needs showing before the rule is settled.

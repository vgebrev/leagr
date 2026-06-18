# ADR: "Momentum" Metric for Champions Hall & Ballers Board

- **Status:** Accepted (pilot — display-only)
- **Date:** 2026-06-09
- **Scope:** Adds a signed, self-relative "momentum" signal to the two existing fun ranking boards. Display-only for v1, consistent with Leagr's convention that new metrics are piloted for bragging rights before being considered for team generation.

---

## Context

Players brag about hot streaks (e.g. consecutive MVP or trophy runs). We want to quantify "who's hot" as a first-class, chartable signal on the two existing fun boards:

- **Champions Hall** — trophies / placement.
- **Ballers Board** — contributions (goals, attacking actions, defensive actions, saves).

Two goals were considered:

1. **Bragging rights** (primary, this ADR).
2. **Team-balancing input** (explicitly out of scope for v1 — see "Rejected / Deferred").

The naïve framing ("won X of last Y") is just a laggy proxy for elo and adds no information beyond it. The valuable signal is **overperformance relative to a player's own baseline** — which surfaces the comeback-from-last story rather than the strong player winning as expected, and is roughly orthogonal to elo by construction.

---

## Decision

### 1. One mechanism, two boards

Both boards share a single momentum mechanism applied to a different **continuous substrate**. The scarce/prestigious events (trophies, MVP) become **badges layered on top**; the continuous substrate is what heats and cools.

| Board          | Continuous substrate (per session)                  | Badge on top             |
| -------------- | --------------------------------------------------- | ------------------------ |
| Champions Hall | **Normalised placement**                            | Trophy / cup-win streaks |
| Ballers Board  | **Contribution aggregate** (existing Ballers score) | MVP streaks              |

The insight that replaced the originally-considered composite: do **not** blend trophies + positions + contributions into one weighted score. Instead, find the abundant continuous signal _underneath_ each scarce event. A trophy is the top bucket of placement; MVP is the top of contribution share. This eliminates the cross-category weighting problem entirely.

### 2. Signal definition (generic, applies to both boards)

Momentum is the divergence between a fast and a slow exponential moving average of the substrate, squashed to (−1, 1) by `tanh`. This is structurally MACD (fast-vs-slow EMA divergence).

```
momentum = tanh( (fast_ema − slow_ema) / k · staleness )
```

- `slow_ema` — the player's **own** expected level (long half-life baseline).
- `fast_ema` — the player's **own** recent form (short half-life).
- `k` — the player's **own** variability scale (robust spread, e.g. MAD). Bounds and saturates the signal symmetrically; absorbs the floored-downside / unbounded-upside asymmetry of action counts.
- `staleness` — calendar-time cooling factor (see §4).

**Signed −1 to 1**, not 0 to 1: "below expected" (cooling off) is a real state with its own story and must occupy its own half of the range. `0` = neutral / at-baseline. `+1` = saturated hot. `−1` = saturated cold.

**Own-baseline, never league-baseline.** Measuring against the player's own history is what makes this "are you hot relative to yourself" rather than a re-skin of the raw board ("are you good"). It also neutralises position bias for free: a keeper measured against their own save-baseline can read "hot" without ever competing with a striker's goal volume.

### 3. Substrate normalisation

**Champions Hall — placement:**

```
placement_norm = (N − position) / (N − 1)     # 1st = 1.0, last = 0.0
```

Sessions are overwhelmingly **4 teams** → {1.0, 0.667, 0.333, 0.0}: four ordinal levels, properly graded (not a binary win/loss collapse). Formula is **N-agnostic**, so minority 3-team sessions need no special-casing — they just produce a coarser observation ({0, 0.5, 1}) in the same stream.

League and cup are combined into **one** placement value per session **before** the EMA (combine-then-EMA), weighted by games played. The weights are **derived from team count N**, not hardcoded — every session config self-weights:

```
league_games = 2 · (N − 1)          # double round-robin, per team
cup_games    = ceil(log2(N))         # rounds to fill the knockout bracket

session_placement =
  (league_games · league_norm + cup_games · cup_norm)
  / (league_games + cup_games)
```

This reproduces the common cases without special-casing: **N=4** → `(6·L + 2·C)/8` (the original 3:1); **N=5–8** → `cup_games = 3`, e.g. N=5 → `(8·L + 3·C)/11`. Both `league_games` and `cup_games` are **session-level nominal counts** (same weight for every player that night), since this is prestige-weighting, not per-player information — a team reaching the final shouldn't get a structurally heavier session than its semi-final opponent.

Rationale for downweighting cup: league and cup are two correlated reads on the _same_ team draw, not independent signals — so this is **prestige-weighting**, not information-weighting. The cup's prestige already lives in its badge, so giving it the smaller share of the continuous line is appropriate, not harsh.

**Cup placement normalisation (`cup_norm`).** Unlike the league table, a single-elimination bracket does **not** yield a clean 1..N ordinal — teams knocked out in the same round are tied (both losing semi-finalists are equal; there is **no 3rd-place playoff**). So `(N−position)/(N−1)` does **not** apply to the cup. The backend stores the **raw round in which a team was eliminated** (`'winner'`, `'final'`, `'semi'`, `'quarter'`, `'round-of-16'`, `'round-of-32'`, …). Map these linearly by distance from the top:

```
rounds = cup_games = ceil(log2(N))

p =  0                       if round == 'winner'
     log2(teams_in_round)    otherwise
        # 'final'        -> round-of-2   -> p = 1
        # 'semi'         -> round-of-4   -> p = 2
        # 'quarter'      -> round-of-8   -> p = 3
        # 'round-of-16'                  -> p = 4   ... etc.

cup_norm = (rounds − p) / rounds
```

Each round earlier you exit drops `cup_norm` by a constant `1/rounds` step (the "still linear" property), and same-round exits tie. Worked values — **2 rounds (N=4):** winner 1.0, final 0.5, semi 0.0. **3 rounds (N=5–8):** winner 1.0, final 0.667, semi 0.333, quarter 0.0. Byes (`2^rounds − N`, to top seeds) don't disturb this: the stored round records _where a team lost_, not how many games it played, so a bye team that loses its first match in the semis is simply `'semi'` regardless of the bye. The only special case in code is `'winner'` (p=0); every other name derives `p` from its bracket size.

**Ballers Board — contributions:**

Run the EMA on the **existing Ballers contribution aggregate** (the aggregation across goals/attacking/defensive/saves is a pre-existing board decision and is **not** re-litigated here). One aggregate value per player per session feeds the EMA, same cadence as placement.

### 4. Decay on calendar time, not sessions played

Baseline EMAs update **only on observed sessions** (keeps the baseline stable and event-indexed internally). Inactivity cooling is applied as a **staleness multiplier** on the displayed divergence:

```
staleness = exp( −Δt_since_last_session / τ_cool )
```

where `Δt` is **calendar** time. This is the clean answer to the cherry-picking tension: skipping weeks cools a player toward neutral **without ever recording a loss**. Regular attenders aren't penalised; occasional stars simply fade between appearances. Inactivity reads honestly as "cooling off" and needs no special-case rule.

> Note: this is the opposite indexing to elo. Elo should remain **event-indexed** (a no-show is invisible to it). Momentum is the metric that _should_ decay on the wall clock.

### 5. Cold-start guardrail

A new/unproven player must read **neutral (0)** with a visual "provisional / insufficient data" treatment — **not** be allowed to swing to ±1 on one or two observations. Damp the magnitude until the player has ≥ `n_min` sessions (suggest 4–5), e.g. scale the output by `min(n / n_min, 1)`. Until the player has enough history to estimate their own `k`, fall back to a **league-wide typical spread** for the variability scale.

> The earlier "anchor low, not zero" guidance was for the 0–1 scale where 0 meant ice-cold. On the signed scale, 0 **is** the correct neutral anchor — so cold-start = damped magnitude + provisional visual flag.

### 6. Display

- **One chart per category** (placement-momentum, contribution-momentum) — no single composite sortable score. The per-board boards are sorted by their own continuous momentum value.
- The discrete tally ("3 of 4 heating up", "1 of 5 cooling off") is a **human-readable label only**; the **continuous score sorts the board**. Sanity-check on render that the label and the continuous score don't visibly contradict.
- **Painted bar sections:** the bar may be visually segmented by component ratio — league:cup (the games-derived weight, e.g. 3:1 at N=4) for Champions Hall, goals/attacking/defensive/saves for Ballers — purely presentational. **Painting does not affect the computed momentum value.**
- **Badges** (MVP streak, trophy/cup-win run) render on top of the continuous line as the "rare and prestigious" layer. Define the streak-break rule explicitly (recommend: a below-threshold session breaks it; a _missed_ session does **not** — consistent with calendar-cooling not punishing absence).

---

## Consequences

**Positive / by design:**

- **Comeback weighting is correct for free.** Last-to-first reads as a bigger heat-up than mid-to-first, because it's relative to the player's own low baseline — matching lived experience. (Worked example, N=4: after a 4-week last-place run the slow EMA sits near the floor; a league win (1.0) + cup runner-up (0.5) → `session_placement = (6·1.0 + 2·0.5)/8 = 0.875` → large divergence → tanh saturates positive → reads strongly "heating up.")
- **Champions stay flat while winning.** Winning is their expected, so divergence ≈ 0. They brag via trophy count; the comeback kid brags via momentum. Clean separation of stories.
- **Board is never all-flat.** Placement is zero-sum across the league (the four normalised values average 0.5), so the substrate self-corrects toward spread — there are always both hot and cold players.
- **Position-neutral** via own-baseline (keepers/defenders can be "hot").

**Negative / accepted trade-offs:**

- **Placement momentum is more team-dependent than contribution momentum** (it reflects the team draw, not just the individual). Accepted as part of the fun; mitigated by a **longer fast half-life** on Champions Hall so a single lucky draw doesn't spike someone to max heat.
- **Tuning surface.** Half-lives, `k`, `τ_cool`, `n_min` are all knobs (see config below). Defaults provided; expose as operator config.

---

## Rejected / Deferred

- **Team-generation input (deferred).** Individual momentum in a team game is intrinsically noisy and largely team-draw-dependent; the hot-hand signal is weak relative to elo and risks double-counting (elo already absorbs results). Revisit only after the pilot yields real distributions. If ever adopted, the "challenge high-momentum players" idea is an **anti-dynasty / drama lever**, distinct from fairness-balancing — keep it separate from the elo balancer and **operator-configurable, off by default**.
- **Single weighted composite momentum score (rejected).** Reintroduces hidden cross-category weighting and an opaque sort order with no empirical basis during a pilot. Per-category boards preserve legibility and generate the distributions needed to derive weights later, if ever.
- **Continuous trophy-momentum from raw trophy integers (rejected).** Too sparse for a stable baseline. Resolved by using placement as the continuous substrate instead.
- **League-baseline normalisation (rejected).** Would rebuild the raw "are you good" board. Own-baseline only.
- **Tracking league and cup as separate momentum lines (rejected).** Combine-then-EMA into one "overall performance" momentum; cup prestige lives in the badge.

---

## Appendix: implementation notes for LLD

**Time-aware EMA update (per player, per metric, on each observed session):**

```
τ      = half_life / ln(2)
α_fast = 1 − exp(−Δt_session / τ_fast)      # Δt in chosen calendar unit
α_slow = 1 − exp(−Δt_session / τ_slow)
fast   = α_fast · x + (1 − α_fast) · fast_prev
slow   = α_slow · x + (1 − α_slow) · slow_prev
```

(Using calendar Δt between _observed_ sessions for the update keeps spacing honest if sessions aren't perfectly weekly. The `staleness` term in §4 then handles cooling for the gap since the **last** session up to _now_ at render time.)

**Render time:**

```
gap        = now − last_session_time
staleness  = exp(−gap / τ_cool)
raw        = (fast − slow) / k
damp       = min(n_sessions / n_min, 1)          # cold-start
momentum   = tanh(raw · staleness) · damp
```

**Per-player state to persist:** `fast_ema`, `slow_ema`, `last_session_time`, `n_sessions`, and a robust spread estimate (running MAD or equivalent) for `k`. Fits the file-based JSON store; one record per player per board.

**Suggested starting config (operator-tunable; assuming ~weekly sessions):**

| Param            | Ballers                  | Champions Hall           | Note                               |
| ---------------- | ------------------------ | ------------------------ | ---------------------------------- |
| `fast_half_life` | ~2–3 wk                  | ~3–4 wk                  | Champions slower (team-draw noise) |
| `slow_half_life` | ~8–12 wk                 | ~8–12 wk                 | baseline                           |
| `τ_cool`         | ≈ fast half-life         | ≈ fast half-life         | inactivity cooling                 |
| `n_min`          | 4–5 sessions             | 4–5 sessions             | cold-start damping                 |
| `k`              | own MAD, league fallback | own MAD, league fallback | variability scale                  |

**Open question left for implementation (low-risk):** whether `k` uses standard deviation or MAD — recommend MAD for robustness on short histories, but confirm against your real contribution/placement distributions once data exists.

# Traits & Badges — documentation audit (Phase 1)

Documents the player trait and badge awarding mechanism, which shipped undocumented and then
changed twice more without a doc update. The as-built spec now lives in
[`docs/traits.md`](../docs/traits.md). **No behaviour changed** — this round is documentation
plus a data audit; refining the awarding rule is Phase 2.

## What was audited

- **No documentation existed.** `git log --all --diff-filter=D -- '*.md'` is empty, so nothing
  was written and later deleted — it was simply never written. `README.md:42` carries a
  one-line mention and nothing else.
- **The only trait document is a stale pre-implementation plan**,
  `202603141200-enhanced-ratings-player-profiles-plan.md`. It has been superseded three times
  and should not be read as a spec. Left in place as a historical record; `docs/traits.md`
  opens by saying so.

| Commit                 | Change                                                                                                                                                                                          | Doc updated?                            |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| `24fc13d`              | Shipped traits + badges. Already differed from the plan in the same commit: a badge **array** rather than a single derived label, and `PROFILE_THRESHOLD = 0.5` rather than the planned `0.55`. | plan shipped alongside, never rewritten |
| `81705eb` (2026-03-22) | Replaced the static threshold with **the mean of established players' norms**; added `Utility Hero`.                                                                                            | no                                      |
| `5dfe4ff` (2026-04-05) | Traits norm rebuilt from all four individual stats rather than attack/defence buckets.                                                                                                          | no                                      |
| `b6a549d`              | Ballers Board shipped.                                                                                                                                                                          | no                                      |

## Correcting the recollection that prompted this

Traits **are** built on per-session averages rather than totals — that part was remembered
correctly. But the gate is **the mean of the established pool**, not a top-N percentile, and
there is no standard-deviation term anywhere in the calculation. The percentile idea appears
in neither the plan nor any commit.

## Verification that the doc describes the code that actually ran

An independent re-implementation of `calculatePlayerProfiles()` was run against the stored
norms in `data/pirates/rankings-2026.json` and compared to the `traits` and `playerProfile`
values already persisted there: **72 players, 0 mismatches**. The spec therefore describes
observed behaviour, not just a reading of the source.

## Phase 2 candidates — deferred

Evidence from `data/pirates/rankings-2026.json` (recalculated 2026-08-15T10:07:38Z; 32 sessions,
72 players, 39 established; thresholds `g 0.278 / o 0.362 / d 0.446 / s 0.280`). Full detail and
per-player tables in `traits-audit-report.html`.

1. **The confidence cliff is arbitrary and sits inside the small-sample zone.** Confidence is
   `min(1, seasonEloGames/35)²`, so it is steepest exactly where most fringe players sit.
   The clearest pair:

    |             | appearances | tracked sessions | `seasonEloGames` | confidence | def actions/session | league rank | outcome                                                     |
    | ----------- | ----------- | ---------------- | ---------------- | ---------- | ------------------- | ----------- | ----------------------------------------------------------- |
    | **Oscar**   | 4           | 4                | 30               | 0.73       | 6.50                | 8th         | Finisher + Attacker + Defender → **Complete Player (gold)** |
    | **Brandon** | 3           | 3                | 23               | 0.43       | 7.67                | **3rd**     | **no traits at all**                                        |

    Brandon defends better than Oscar by rate, on one fewer session, and receives nothing while
    Oscar wears gold. Neither player is established; the entire difference is one session's worth
    of ELO games landing on the steep part of a quadratic.

2. **The gate measures a different clock from the average it gates.** The pull keys off
   `seasonEloGames`; the averages are built on `sessionsWithX`. Action tracking began
   2026-03-07, so the two diverge. **Sibusiso** has just **3** tracked action sessions but
   `sg=65` accumulated from goals-only appearances → confidence **1.00** → awarded Defender +
   Shot Stopper + Sentinel. Brandon, on the same 3-session sample, is discounted to 0.43.
   Attendance _before_ the stat existed is deciding confidence _in_ that stat.
3. **The pull is a wall, not a taper.** Norms cap at 1.0, so a trait is unreachable below
   `seasonEloGames > 35·√threshold` — 18.5 to 23.4 games — regardless of how good the player
   is. **23** (player, trait) pairs currently clear the raw bar and are blocked purely by the
   pull, two of them sitting at a perfect norm of 1.000.
4. **Min-max normalisation makes the bar outlier-relative and unstable.** The minimum is
   almost always 0, so a norm is "fraction of the best player's rate". **Elvis** sets the saves
   maximum at 9.80/session off **5** tracked sessions, compressing every other keeper beneath
   him. The distribution is right-skewed, so the mean sits above the median and only 15–20 of
   39 established players clear each bar.
5. **Phantom zeros enter the threshold pool.** A player who never had a stat tracked scores
   `norm(undefined ?? 0, …) = 0` rather than `null` (`rankings.js:1748-1761`). **15** such
   (player, stat) pairs exist league-wide; 3 of them (**Pat**, who last played 2026-02-21,
   before action tracking began) sit inside the established pool and drag the threshold down.
   Small today, but it grows every time tracking changes.
6. **Carry-forward keeps departed players setting the bar.** **Sphe** last played 2026-05-09
   and still contributes norms of 0.684 / 0.864 / 0.800 to the established mean — and still
   wears Complete Player on his profile.
7. **Four independent bars near the mean reward breadth over excellence.** **Hayden** ranks
   19th / 19th / 22nd and clears three bars by margins of 0.021, 0.017 and 0.050 — collecting
   Complete Player (**gold**) + Danger Man + Engine. **Jay**, the league's leading scorer with a
   **perfect 1.000** goals norm and 4th-best offensive rate, tops out at Danger Man (silver).
   Excellence in one stat cannot outrank mediocrity in three.
8. **The board and the badges are ordered by different quantities — the likeliest proximate
   cause of the complaint.** `api/ballers-board` ranks by **season totals**
   (`+server.js:83-94`), which rewards attendance; traits use **per-session averages**, which
   do not. Rows link straight to `/rankings/{player}`, where the badges render. The result on
   the current board: **Chris (#8), Offie (#10), Princelinho (#13) and Wayne (#14)** — all with
   24–26 appearances — hold **one trait or none between them**, while **Oscar sits at #34 on
   four appearances wearing gold**. Nothing is malfunctioning; the two views simply measure
   different things.
9. **The badge lattice is incomplete and additive.** Two of six two-trait pairs have no badge
   (Finisher+Defender, Attacker+Shot Stopper) — **Talent** currently holds exactly that first
   pair and so displays two bronze badges and no combo. A four-trait player would render ten
   badges at once, because G.O.A.T. does not suppress the rest. No player currently holds all
   four.

## Files

- **`docs/traits.md`** (new) — the as-built spec: pipeline, per-session averaging, min-max
  normalisation, the confidence pull, the dynamic threshold, the badge lattice, consumers, a
  constants table with source lines, and the characteristics above stated neutrally.
- **`tasks/202608211227-traits-badges-documentation.md`** (new) — this audit.
- **`traits-audit-report.html`** (new, repo root) — the data report: live thresholds,
  reachability floors, norm distributions, a sortable 72-player table, flagged anomalies, and
  a comparison of the current rule against three candidate replacements.
- **`test/lib/server/rankings.test.js`** — comment-only fix. Four comments claimed
  `threshold = mean + 0.1`; `THRESHOLD_BUMP` has been `0` since `81705eb`. Assertions were
  already correct — the margins are wide enough that they pass either way — so no test
  behaviour changed.

## Testing

No production code changed, so the existing suite is the regression check. The report
generator is a scratchpad script rather than a committed tool: it reads a rankings file and
emits static HTML, and re-running it is only needed when the data moves.

## Assumptions / limitations

- The audit covers **pirates 2026 only**. It is the only league with meaningful action-stat
  history; the other data directories are smoke-test fixtures.
- Findings 1–5 are measurement artefacts: they make the award depend on something other than
  the player's play, and are wrong on their own terms. Findings 6–9 are **design choices**
  rather than defects — whether excellence in one stat should outrank breadth across three,
  and whether the board and the badges ought to agree, are calls to make in Phase 2, not bugs
  to fix.
- The report's rule comparison is illustrative, sized to show who gains and loses under each
  candidate. It is not a recommendation; no threshold has been tuned.

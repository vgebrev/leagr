# Shot Stopper measures saves per session in goal

Implements **Option A** from
[`202608240958-traits-transparency-report.md`](202608240958-traits-transparency-report.md):
the saves denominator becomes sessions the player kept goal, gated at five of those.

## The problem it fixes

The badge measured saves per session **attended**, not per session **kept goal**. Save actions are
tracked league-wide, so `sessionsWithSaveActions` incremented for everyone who turned up —
including whoever was outfield that week.

On 2026-08-22 the league's runaway save leader (142 saves, against 84 for second place) played
outfield. Numerator held at 142, denominator went 23 → 24, rate fell 6.174 → 5.917, and he lost
Elite Shot Stopper by **0.023**. Had he stayed home his average would have been carried forward
and he would have kept it. Turning up cost him the badge.

## What changed

One condition, in the per-session accumulation loop (`rankings.js`):

```js
if (sessionTracked.saveActions && ind.saveActions > 0) {
    playerData.saveActions += ind.saveActions;
    playerData.sessionsInGoal += 1;
}
```

`ind.saveActions` is zero for an outfield session, so `saveActions` totals are untouched — the
change is purely to the denominator. Everything downstream follows from that one counter:

| Quantity                     | Follows because                                             |
| ---------------------------- | ----------------------------------------------------------- |
| `saveActionsPerSession`      | `saveActions / sessionsInGoal`                              |
| eligibility for Shot Stopper | `TRAIT_MIN_TRACKED_SESSIONS = 5` now reads **5 in goal**    |
| `saveActionsNorm` bounds     | min/max over established players with a rate — keepers only |
| `controlRating`              | carries `saveActionsNorm` at weight 0.5/5.5                 |

### The counter was renamed

`sessionsWithSaveActions` → **`sessionsInGoal`**. The other three counters mean "sessions this
stat was recorded league-wide"; this one no longer does, and a field whose meaning silently
diverges from its name is exactly what produced the bug. The new name also survives the follow-up
below: when an explicit keeper flag arrives, the derivation changes and the name does not.

Back-compat is a non-issue — `updateRankings()` rebuilds every counter from the session files, and
persisted `traits`/`traitTiers` are only recomputed there. `calculateEnhancedRankings()` reads
`data.sessionsInGoal ?? 0`, deliberately **not** falling back to the old field, whose value means
something different.

## The proxy, and what it costs

Session JSON has no keeper field — only `home/awaySaveActions` maps — so "in goal" is proxied by
"recorded at least one save this session". Measured over every pirates session with save tracking
(2026, 360 matches):

| Granularity             | Keeper identified | Conceded, no save | Clean sheet, no save |
| ----------------------- | ----------------- | ----------------- | -------------------- |
| team-side per **match** | 586 / 720 (81.4%) | 89 (12.4%)        | 45 (6.3%)            |
| team per **session**    | 96 / 96 (100%)    | 0                 | 0                    |

The trait rule works at session granularity, and at that granularity the proxy **never** loses a
keeper in the data that exists. Match-level indeterminacy is real but irrelevant here: a team
always recorded a save somewhere across a session's games.

The opposite failure is the live one. The league rotates the gloves _within_ a session — 2 to 6
distinct players record saves for one team in one session (median 3; only 3 of 96 team-sessions
had a single save-recorder). So "a session in goal" means _some_ time in goal, not a full shift,
and an outfielder credited with one goal-line block picks up a session at a rate of 1.

## Effect on pirates 2026

Recalculated and diffed against the previous file. **Nothing outside the save path moved**:
`saveActions`, `indGoals`, `offActions`, `defActions`, `appearances`, `points`, `rankingPoints`
and every ELO object are byte-identical, and `attackingRating` has a max delta of 0.0000.

- **9 trait-tier moves**, exactly the set the transparency report predicted for Option A.
- Shot-stopper eligible pool **37 → 24** — thirteen players fall under the five-in-goal gate.
- The focus player: rate 5.92 → 7.47, tier 1 → **2**. Elite Shot Stopper restored, and with it
  Guardian (Elite Defender + Elite Shot Stopper).
- Two players drop Elite to base (Tinashe, Prosper), five drop base to none, one (Caesar) loses
  his only badge — 33 saves at a genuinely elite rate, but over four sessions in goal.
- `controlRating` mean |delta| 0.0049, max 0.034 (one player above 0.02). The Ballers Board is
  unaffected: it ranks on season totals, which did not move.

The bar is still nearest-rank, so the focus player sits **exactly on** the Elite bar (norm 0.5797
vs bar 0.5797) — he is the 85th-percentile player. Thin, but that is the band rule, not this
change.

## Files

| File                                           | Change                                                            |
| ---------------------------------------------- | ----------------------------------------------------------------- |
| `src/lib/server/rankings.js`                   | in-goal gate; `sessionsWithSaveActions` → `sessionsInGoal`        |
| `test/lib/server/rankings.shotStopper.test.js` | **new** — six integration tests through `updateRankings()`        |
| `test/lib/server/rankings.test.js`             | helper renamed; new gate test on `sessionsInGoal`                 |
| `docs/traits.md`                               | new "Saves divide by sessions in goal"; eligibility; limitation 5 |
| `scripts/traits-report.mjs`                    | self-checks 1 and 6 derive the saves counter from in-goal dates   |

## Testing

Integration rather than unit, because the point is what a real session file does to the
denominator — the tests write session JSON and run `updateRankings()`:

- only sessions with a recorded save increment the counter;
- totals are untouched, only the denominator moves;
- a keeper who attends and plays outfield keeps their rate (the 2026-08-22 case);
- a player who has never kept goal gets a null rate and a null norm, not a zero;
- `history[].stats.saveActions` still records a tracked **zero** for an outfield session — the
  momentum boards and the transparency report both read it, and it is the only evidence of who
  was in goal;
- sessions with no save tracking at all still increment nothing.

`npm test` green: **1175 backend + 220 frontend**. `npx eslint .` clean.

Independent check: `scripts/traits-report.mjs` refuses to emit unless it reproduces what the app
persisted. All six self-checks pass against the recalculated file — session counters, per-session
averages, norm bounds, live-rule simulation and per-date reconstruction — and its Option A
simulation now reports **0 tier moves against live**, which is the rule having actually shipped.

Verified in the browser at `/rankings/Lunathi`: Elite Shot Stopper and Guardian present.

## Follow-up (separate ticket)

Record the keeper explicitly on the session — a per-match keeper field rather than a per-session
one, since the gloves rotate mid-session. That replaces `ind.saveActions > 0` with a real signal,
makes a shutout keeper visible, and stops crediting an outfielder's goal-line block as a session
in goal. `sessionsInGoal` is named for the quantity, so it is a one-line swap.

# Momentum ("Form") — As-Built

Implements the momentum metric ADR (`tasks/202606091200-ADR-momentum-metric.md`): a signed,
self-relative "who's hot" signal rendered as a **Form** tab on the Champions Hall and
Ballers Board pages. **Display-only** — team generation, balancing and elo are untouched.

## Signal

```
momentum = tanh( GAIN · (fast_ema − slow_ema) / k · staleness ) · damp
```

- `fast_ema` / `slow_ema` — time-aware EMAs of the per-session substrate, updated only on
  observed sessions with calendar Δt between them (`α = 1 − exp(−Δt·ln2 / half_life)`).
- `k` — the player's **own MAD** of substrate values; falls back to the **league-wide pooled
  MAD** until the player has `minSessions` sessions or whenever own MAD is 0 (constant
  history). Final fallbacks if even the pooled MAD is 0: 0.25 (placement), 1 (contributions).
- `staleness = 2^(−gap_weeks / coolHalfLifeWeeks)` — calendar cooling from the player's last
  session to render time. Skipped weeks cool a player toward neutral without recording a loss.
- `damp = min(n / minSessions, 1)` — cold-start damping; players below `minSessions` are
  flagged **provisional** ("new" pill, dimmed bar).
- `GAIN = 1.5` (internal constant, `src/lib/server/momentum.js`). A fast-vs-slow divergence
  after a single shock is structurally only ~0.14–0.23 of the shock size, so some gain is
  needed for hot streaks to read hot. Calibrated against a real season (pirates 2026): the ADR
  worked comeback (four last places then a 0.875 session) reads ~0.6 and saturates (~0.85+)
  only when sustained for a second week; steady performers stay near 0; only a few genuinely
  streaking players sit above |0.85|. Gain 3 was tried first and saturated half the active
  board, violating the ADR's "a single lucky draw shouldn't spike a player to max heat".

Range is **−1 (saturated cold) to +1 (saturated hot)**; 0 = at own baseline.

## Substrates

**Champions Hall — placement** (one combined value per session, combine-then-EMA):

```
league_norm = (N − position) / (N − 1)
cup_norm    = (rounds − p) / rounds      rounds = ceil(log2 N)
              p = 0 for 'winner', else log2(bracket size of exit round)
              ('final'→1, 'semi'→2, 'quarter'→3, 'round-of-16'→4, …)

session_placement = (league_games·league_norm + cup_games·cup_norm) / (league_games + cup_games)
                    league_games = 2(N−1), cup_games = ceil(log2 N)   # N=4 → 6:2
```

Components without data (no cup that day, no league standings) are excluded from the weighted
average rather than zero-filled. Team count `N` is **derived, not stored**: max
`leaguePosition` across all players that date (standings positions are unique 1..N), with
distinct team names as fallback.

**Ballers Board — contributions**: sum of the raw per-session `stats` block
(goals/offActions/defActions/saveActions), restricted to a **consistent tracking regime**: the
stat types tracked in the league's latest session define the substrate, and only sessions that
tracked all of those types count as observations (summing exactly those types). This matters
on real data — pirates 2026 tracked goals-only through February and all four types from March;
without the regime rule the ~10× jump in tracked volume read as the entire league "heating up"
(instrumentation drift, not form). Sessions outside the regime, or with no stats at all, are
no-observations: they don't update the EMA and don't break streaks.

## Data

No new store. Momentum is recomputed at **render time** in the GET handlers of
`/api/champions` and `/api/ballers-board` from the per-player `history` in
`rankings-YYYY.json` — consistent with the rankings file being fully rebuilt from session
files by `updateRankings()`. Render-time computation is required anyway because staleness and
provisional damping depend on "now".

One additive field in the history entry written by `rankings.js`:

```json
"stats": { "goals": 2, "offActions": 3, "defActions": 1, "saveActions": 0 }
```

(null per type when untracked that session). **Deploy note:** POST `/api/rankings` once per
league after deploying to rebuild rankings files with the new field; older entries without
`stats` are simply skipped as Ballers observations.

The API returns `momentum: [...] | null` alongside the existing payload — only when the
requested year is the current year (a past year's "heat now" is meaningless), and only when
enabled in settings. Entries are sorted hottest-first:

```json
{
    "playerName": "…",
    "value": 0.84,
    "sessions": 12,
    "provisional": false,
    "lastSession": "2026-06-06",
    "components": { "league": 0.75, "cup": 0.25 },
    "badges": [{ "type": "league", "count": 3 }],
    "series": [{ "date": "…", "value": 0.1 }]
}
```

`components` (painted bar shares) are **presentational only** and never feed the value:
Champions = games-derived league:cup weight of the latest session; Ballers =
goals/attack/defence/saves shares over the last `minSessions` observed sessions.

## Streaks

Strict consecutive streaks, shown at **count ≥ 2**, drawn as the **actual icons of the run**
(no abstract "trophy of any kind" badge). Break rule: a **below-threshold observed session
breaks** a streak; a **missed session does not** (consistent with calendar cooling not
punishing absence); a session where the category was untracked is skipped.

**Champions Hall** — a single trailing "won-something" run, rendered as **one column per
session** in chronological order. Each column shows the actual trophies won that week; a
**double** (league **and** cup) stacks crown over trophy. Columns are vertically centred so a
lone crown/cup never reads as sitting on the "cup row". The **wooden spoon** (league last
place) is an independent run. The server emits the run verbatim — `championsTrophyStreak()`
returns `trophyStreak: [{league, cup}, …]`, plus `woodenSpoonStreak: number` (this replaces
the old collapsed `selectChampionsBadges` / silverware-subsumption model).

| Element      | Condition per session           | Icon                          |
| ------------ | ------------------------------- | ----------------------------- |
| League win   | league winner                   | `CrownIcon` (yellow-500)      |
| Cup win      | cup winner                      | `TrophyIcon` (amber-600)      |
| Double       | league **and** cup winner       | crown stacked over trophy     |
| Wooden Spoon | league last place (independent) | `WoodenSpoonIcon` (amber-800) |

**Ballers Board** — five categories mirroring Stars of the Day (MVP, Golden Boot, Playmaker,
Brick Wall, Golden Glove): a streak session = topping that category's per-session value across
all players. Each active category is an **independent run rendered as its own row** of repeated
icons (a player can hold several at once — e.g. MVP + Brick Wall). Server emits
`badges: [{type, count}]` (count ≥ 2). **Ties count as a win for all tied players** (the in-day
game-sequence tie-break isn't reconstructable from per-session totals — accepted deviation).
No cold badge on Ballers by design: "lowest contributor" is league-relative and would pin on
keepers/defenders, against the ADR's own-baseline principle.

**Rendering cap.** Runs draw literal icons up to `STREAK_CAP` (6); beyond that they collapse to
`icon ×N`. Ballers (homogeneous) collapse to a single icon + count; Champions collapse to a
**per-type** summary (👑 ×league, 🏆 ×cup) so the trophy distinction survives long runs. The
Streak column is auto-width (sizes to the widest run present, capped), and the Form column
absorbs the remaining width.

## Config (operator-tunable, league-level `info.json → settings.momentum`)

```json
{
    "enabled": true,
    "ballers": {
        "fastHalfLifeWeeks": 2,
        "slowHalfLifeWeeks": 10,
        "coolHalfLifeWeeks": 2,
        "minSessions": 5
    },
    "champions": {
        "fastHalfLifeWeeks": 3,
        "slowHalfLifeWeeks": 10,
        "coolHalfLifeWeeks": 3,
        "minSessions": 5
    }
}
```

Defaults in `src/lib/shared/defaults.js`; deep-merged via `getEffectiveMomentumSettings()`.
Champions uses a slower fast EMA (placement reflects the team draw). `minSessions: 5` matches
the existing "<5 sessions = provisional" team-generator convention. Editable in the admin
Settings page (League Settings → Form section). `k` is MAD-based per the ADR decision (not
configurable).

## UI

- Both board pages become **two tabs** ("Champions"/"Ballers" | "Form") when momentum data is
  present; otherwise the plain board renders as before. The Form tab disappears for past
  years / `year=all`.
- **Tab state uses shallow routing** (`pushState('', { formTab })` + `page.state`, mirroring
  the team/player modal pattern) so switching to Form is reflected in browser back/forward.
  `App.PageState.formTab` is declared in `src/app.d.ts`. Selecting the list tab calls
  `history.back()`; state isn't URL-encoded, so a reload returns to the default tab.
- `MomentumBoard.svelte` — sorted signed-bar list rendered as a **transparent, panel-less
  table** matching the main board tables (the tab panel is `bg-transparent dark:bg-transparent`
  so the page background shows through; rows keep the default table background). Columns:
  #, Player, Streak, Form (bar), +/-. Tally label ("3 heating up · 2 cooling off", derived
  from the same continuous values that sort the board so they can't contradict) and a hot/cold
  legend sit above.
- **Audience filtering**: **provisional players (<5 sessions) are always hidden** so "form" is
  a meaningful signal (this absorbs the old provisional pill). A **"Regular players only"**
  toggle (default on, mirrors the Rankings active-player filter — ≥2 observed sessions in the
  last 2 months, computed client-side from the `series` dates) further narrows to recent
  regulars; the hot/cold tally reflects the filtered set. Note the regulars toggle only changes
  the view when a non-provisional player has lapsed (5+ sessions but quiet 2 months); on the
  Ballers board such a player must also clear `minSessions` under the **current stat regime**,
  so pre-regime players stay provisional there.
- `MomentumBar.svelte` — centre-zero bar, hot grows right (oranges), cold grows left (blues),
  painted by component shares.

## Files

| File                                                                                          | Change                                                                                                                                  |
| --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/server/momentum.js`                                                                  | pure computation module; `championsTrophyStreak()` + `trophyStreak`/`woodenSpoonStreak` entry fields (replaced `selectChampionsBadges`) |
| `src/lib/server/rankings.js`                                                                  | additive `stats` block in history entries                                                                                               |
| `src/lib/shared/defaults.js`                                                                  | momentum defaults + `getEffectiveMomentumSettings` + `LEAGUE_ONLY_SETTINGS`                                                             |
| `src/lib/shared/types.js`                                                                     | `MomentumSettings`/`MomentumBoardConfig` typedefs                                                                                       |
| `src/routes/api/champions/+server.js`, `src/routes/api/ballers-board/+server.js`              | momentum block in GET                                                                                                                   |
| `src/routes/champions/+page.svelte`, `src/routes/ballers-board/+page.svelte`                  | tabs + Form tab + shallow-routing tab state                                                                                             |
| `src/app.d.ts`                                                                                | `App.PageState.formTab`                                                                                                                 |
| `src/components/MomentumBoard.svelte`, `src/components/MomentumBar.svelte`                    | panel-less table, regulars toggle, per-session/per-award streak rendering                                                               |
| `src/components/Icons/WoodenSpoonIcon.svelte`, `src/components/Icons/DoubleTrophyIcon.svelte` | `DoubleTrophyIcon` no longer used (doubles draw crown+trophy stacked)                                                                   |
| `src/routes/settings/components/MomentumSettings.svelte`, `src/routes/settings/+page.svelte`  | settings UI                                                                                                                             |
| `test/lib/server/momentum.test.js`                                                            | 65 unit/integration tests                                                                                                               |

## Tests

`test/lib/server/momentum.test.js` covers: MAD; league/cup norms (incl. N-agnostic and
bye-exit cases); combine weights (6:2 at N=4, 8:3 at N=5); the **ADR worked comeback example**
(four last-place weeks then 0.875 → momentum > 0.7, top of board) and its inverse (fallen
champion reads cold); flat champion reads 0; staleness cooling; cold-start damping; MAD
fallback selection and zero-`k` guard; streak counting incl. missed-session and
untracked-category skips; `championsTrophyStreak` (mixed runs latest-last, doubles flagged on
both axes, break-on-no-win, skip no-competition sessions) and the `trophyStreak` /
`woodenSpoonStreak` board fields; tie handling; painted component shares; legacy entries
without `stats`.

## Deferred (revisit after pilot data exists)

- "X of last Y" density badges (e.g. 5 trophies in 7 sessions) — strict streaks only in v1.
- Momentum as a team-generation input (per ADR: anti-dynasty lever, off by default, separate
  from the elo balancer).
- Per-player momentum sparkline rendering (the per-session `series` is already in the payload).

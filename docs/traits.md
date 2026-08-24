# Player Traits & Badges — As-Built

Documents the trait and badge awarding mechanism on player profiles. Trait qualification and
tiering live in `src/lib/server/rankings.js`; the badge lattice and its visual grammar live in
`src/lib/shared/badges.js`.

Originally reconstructed from the code on 2026-08-21 (the feature shipped undocumented — see
`tasks/202608211227-traits-badges-documentation.md` for the audit trail), then updated for the
tiering change in `tasks/202608211530-traits-tiering-implementation.md`, and again for the
badge-lattice expansion in `tasks/202608241055-adr-badge-lattice-and-elite-badge-tiers.md`
(the accepted ADR) and its implementation note.

The pre-implementation design in `tasks/202603141200-enhanced-ratings-player-profiles-plan.md`
does **not** describe current behaviour and should not be read as a spec.

Traits are **computed once and persisted** into `rankings-YYYY.json`, not derived on read.

## Pipeline

```
session JSON (games.rounds[][], knockout bracket)
  └─ collectIndividualStatsForSession()      raw per-session counts + `tracked` flags
      └─ per-stat cumulative averages         indGoals / sessionsWithGoals, …
          └─ calculateAttackControlRatings()  min-max norms against the established pool
              └─ calculatePlayerProfiles()    confidence pull → dynamic threshold → traits → badges
                  └─ saveRankingsUnsafe()     persisted as `traits` and `playerProfile`
```

Call order is fixed at `rankings.js:1517-1522` — profiles **must** run after attack/control,
because it consumes the `*Norm` values that step writes.

## Data capture

`collectIndividualStatsForSession()` (`rankings.js:1027-1098`) walks every league round and the
knockout bracket, absorbing eight maps per match: `home/awayScorers`,
`home/awayOffensiveActions`, `home/awayDefensiveActions`, `home/awaySaveActions`.

- Reserved keys `__ownGoal__` and `__unassigned__` are excluded, as are non-positive counts.
- A `tracked` flag is set per stat **type** the first time a non-null map for it is seen. This
  distinguishes "tracked and scored zero" from "not tracked at all" — the flag, not the count,
  drives everything downstream.

## Per-session averages, not totals

`rankings.js:1356-1392`. Each of the four stats carries its **own** session counter, incremented
only when that stat type was tracked in that session:

```
goalsPerSession      = indGoals    / sessionsWithGoals
offActionsPerSession = offActions  / sessionsWithOffActions
defActionsPerSession = defActions  / sessionsWithDefActions
saveActionsPerSession= saveActions / sessionsInGoal                 // null when the counter is 0
```

Separate counters exist so a change in what the league records doesn't dilute the averages of
stats that were always recorded. In pirates 2026 this is load-bearing: goals were tracked from
2026-01-03 but offensive/defensive/save actions only from **2026-03-07**, so the first nine
sessions of the season count toward `sessionsWithGoals` and toward nothing else.

### Saves divide by sessions in goal

`sessionsInGoal` is the odd counter out. The other three increment for every session the stat was
tracked league-wide; this one increments only when **the player themselves recorded a save**.

Saves are the only stat that a single position monopolises, so an attendance denominator
measures a mix of two different things — how well you keep, and how often you are put in goal. It
also punishes turning up: on **2026-08-22** the league's runaway save leader (142 saves against 84
for second place) played outfield, his numerator held at 142 while his denominator went 23 → 24,
and he lost Elite Shot Stopper by 0.023. Staying home would have carried the average forward and
kept the badge.

Session files carry **no keeper field**, so "in goal" is proxied by "recorded at least one save
this session". Consequences worth knowing:

- A keeper who faced nothing at all is invisible, and that session is dropped rather than counted
  as a zero. Measured over pirates 2026: at match level 89 of 720 team-sides (12.4%) conceded
  without recording a save, and another 45 (6.3%) kept a clean sheet without one — but rolled up
  to the whole session, which is the granularity this counter works at, **0 of 96 team-sessions**
  recorded no save at all. The proxy never actually loses a keeper in the data that exists.
- The league rotates the gloves within a session, so the proxy is generous rather than strict:
  2–6 different players record saves for one team in one session (median 3; only 3 of 96
  team-sessions had a single save-recorder). "A session in goal" therefore means _some_ time in
  goal, not a full shift, and an outfielder credited with one goal-line block picks up a session
  at a rate of 1.

An explicit keeper flag on the session data would replace the proxy; the counter is named for the
quantity it means rather than the way it is currently derived, so that change is a one-line swap.

Team-level `teamGF`/`teamGA` use plain `appearances` as the denominator instead
(`rankings.js:1374-1376`), since they are always available.

## Normalisation

`calculateAttackControlRatings()` (`rankings.js:1635-1876`) runs three passes over the history.

1. **Carry-forward** (`1652-1681`) — a player's last known per-session averages are copied into
   history entries for sessions they missed, so an absent player keeps a norm rather than
   dropping out.
2. **Bounds** (`1683-1732`) — per session date, min and max of each stat are taken across the
   **established pool**: players with `eloGames.season >= MIN_GAMES_FOR_NORMALIZATION_POOL` (35)
   on that date. A stat with no established values that date gets `null` bounds.
3. **Normalise** (`1734-1875`) — min-max, clamped to `[0,1]`:

```
norm(v, min, max) = clamp01((v − min) / (max − min))      // 0.5 when max === min
```

The value the trait system consumes is the **latest date's** norm, lifted to player level as
`goalsNorm` / `offActionsNorm` / `defActionsNorm` / `saveActionsNorm` (`rankings.js:1871-1874`).
Because every player who has ever appeared receives a history entry on every subsequent date,
"latest" is the same date for everyone, so the four norms are mutually comparable.

The same norms feed the composite balancing ratings (`rankings.js:1817-1818`):

```
attacking = (3·goalsNorm + 2·offActionsNorm + 1·teamGFNorm) / 6
control   = (0.5·saveActionsNorm + 3.5·defActionsNorm + 1.5·teamGAInvNorm) / 5.5
```

## Eligibility

`calculatePlayerProfiles()` (`rankings.js:1118-1217`) gates traits on **two** conditions, both
of which must hold before a stat can award anything:

```
seasonEloGames        >= 35      TRAIT_SEASON_GAMES_THRESHOLD
sessionsWith<Stat>    >= 5       TRAIT_MIN_TRACKED_SESSIONS
                                 (for saves this reads sessionsInGoal >= 5)
```

The first is the league-wide "established" bar — the same 35 games the team generator uses for
provisional ratings (`teamGenerator.js:39`, "~5 sessions"). It reads the **current season's**
count, so a returning player does not import last year's standing. A session is roughly 7–8 ELO
games, so it lands at about five sessions.

The second requires five sessions of **the stat itself** — and for Shot Stopper, five sessions
**in goal**, since that is what `sessionsInGoal` counts. This matters whenever a league starts
recording a stat mid-season: without it, attendance from before the stat existed would count
toward "proving yourself" at it. Pirates began recording offensive/defensive/save actions on
2026-03-07 while goals ran from January, so the two counts genuinely diverge.

This is a **hard gate, not a ramp**. An earlier version multiplied each norm by
`min(1, seasonEloGames/35)²` before comparing it to the bar; that pull was removed once
eligibility became a hard requirement, because every eligible player has a confidence of
exactly 1 and the multiplication was provably a no-op.

## Bands and tiers

Eligible players are banded per stat against the **live distribution** of that stat, using
nearest-rank percentiles over the eligible pool (`rankings.js:1153-1179`):

```
baseBar  = 45th percentile of eligible norms      BASE_PERCENTILE  = 0.45
eliteBar = 85th percentile of eligible norms      ELITE_PERCENTILE = 0.85
tier     = norm >= eliteBar ? 2 : norm >= baseBar ? 1 : 0
```

Base therefore means "top 55% at this", and Elite means "top 15%". Because only eligible
players set the bands, newcomers and barely-measured players cannot drag them around; and
because the bands recompute on every recalculation, they cannot go stale as the league grows.
Scarcity is now consistent across the four traits by construction, where the previous
mean-based bar left them ranging from 15 to 22 holders.

### Why the base bar sits below the median

It started on the median, which made a base badge a claim about being above average. Once
Elite tiers landed that claim became redundant — Elite is where excellence is asserted, so
base is free to mean "this is a real part of your game" instead.

Measured on pirates 2026, the median bar left three of the 39 eligible players with no badge
at all. Two of them (Pat, Maestro) sat just under it on a single stat; moving the bar to 0.45
admits exactly those two and nobody else. **Loosening further buys no additional players**:
at 0.4, 0.35 and 0.3 the badged population is still the same 38, and the only effect is more
badges on players who already had some — total badges 118 → 136 → 153 → 171, with All-Rounder
(gold) going from 21% to 36% to 44% of the eligible pool. The third badgeless player, Caesar,
is unreachable at any bar: he sits at the bottom of the pool on all three outfield stats, and
his one strong stat (saves) is held back by `sessionsInGoal: 4` against a gate of 5.

0.45 is therefore the last setting where relaxing the bar still includes someone. Its wording
matters too — the badge popover renders the constant directly, and "Top 55%" is about as far
as a band label can go before it stops reading as an achievement.

Each player receives both a boolean map and a tier map:

| Trait        | Flag            | Source stat                   |
| ------------ | --------------- | ----------------------------- |
| Finisher     | `isFinisher`    | goals per session             |
| Attacker     | `isAttacker`    | offensive actions per session |
| Defender     | `isDefender`    | defensive actions per session |
| Shot Stopper | `isShotStopper` | save actions per session      |

```js
playerData.traits     = { isFinisher: bool, ... };      // true at base-or-better
playerData.traitTiers = { isFinisher: 0 | 1 | 2, ... }; // 0 none, 1 base, 2 Elite
```

`traits` keeps its original boolean shape deliberately, so the badge lattice and
`teamGenerator.calculateTraitBalance()` consume it unchanged. Only the badge component reads
`traitTiers`.

## Badge lattice

The lattice lives in **`src/lib/shared/badges.js`**, imported by the server (awarding), the
component (presentation) and `scripts/traits-report.mjs` (verification), so it cannot drift
between them. It implements
[`tasks/202608241055-adr-badge-lattice-and-elite-badge-tiers.md`](../tasks/202608241055-adr-badge-lattice-and-elite-badge-tiers.md).

Badges read **tiers**, not the `traits` booleans, so Elite qualification earns badges of its
own. Two independent axes are encoded:

- **Breadth** — how many areas a player is strong in.
- **Excellence** — base threshold or Elite.

Each badge declares its shape and tier as independent facts. Neither is derived from the
other, and neither is derived from the awarding logic:

```js
{ id: 'powerhouse', label: 'Powerhouse', category: 'archetype', shape: 'rounded',
  tier: 'gold', requires: { isAttacker: 'elite', isDefender: 'elite' },
  supersedes: 'engine' }
```

`category` survives as the grouping and render-order key; `shape` is what presentation reads.

A requirement of `'base'` is satisfied by tier ≥ 1 and `'elite'` by tier 2 — Elite satisfies
base, never the reverse.

### Catalogue

| Badge              | Category  | Tier    | Shape   | Requires             | Supersedes   |
| ------------------ | --------- | ------- | ------- | -------------------- | ------------ |
| Finisher           | Trait     | Bronze  | pill    | Finisher base        | —            |
| Attacker           | Trait     | Bronze  | pill    | Attacker base        | —            |
| Defender           | Trait     | Bronze  | pill    | Defender base        | —            |
| Shot Stopper       | Trait     | Bronze  | pill    | Shot Stopper base    | —            |
| Elite Finisher     | Trait     | Gold    | pill    | Finisher Elite       | Finisher     |
| Elite Attacker     | Trait     | Gold    | pill    | Attacker Elite       | Attacker     |
| Elite Defender     | Trait     | Gold    | pill    | Defender Elite       | Defender     |
| Elite Shot Stopper | Trait     | Gold    | pill    | Shot Stopper Elite   | Shot Stopper |
| Danger Man         | Archetype | Silver  | rounded | Attacker + Finisher  | —            |
| Engine             | Archetype | Silver  | rounded | Attacker + Defender  | —            |
| Sentinel           | Archetype | Silver  | rounded | Defender + Shot Stop | —            |
| Utility Hero       | Archetype | Silver  | rounded | Finisher + Shot Stop | —            |
| Sniper             | Archetype | Gold    | rounded | both Elite           | Danger Man   |
| Powerhouse         | Archetype | Gold    | rounded | both Elite           | Engine       |
| Guardian           | Archetype | Gold    | rounded | both Elite           | Sentinel     |
| Maverick           | Archetype | Gold    | rounded | both Elite           | Utility Hero |
| All-Rounder        | Breadth   | Gold    | notched | any 3+ base traits   | —            |
| True Baller        | Breadth   | Gold    | faceted | all 4 base traits    | —            |
| Complete Player    | Mastery   | Diamond | notched | any 3+ Elite traits  | All-Rounder  |
| G.O.A.T.           | Mastery   | Diamond | faceted | all 4 Elite traits   | True Baller  |

Two of the six two-trait pairs still have **no** archetype: Finisher + Defender and
Attacker + Shot Stopper. The lattice is deliberately curated rather than exhaustive — badge
scarcity and recognisable player identities take precedence over mathematical completeness.
`test/lib/shared/badges.test.js` asserts both absences.

### Supersession is presentation-only

`qualifiedBadges(tiers)` returns everything a player qualifies for. `displayBadges(tiers)`
drops anything a held badge supersedes. **Only the second is used for rendering** — a
G.O.A.T. genuinely still qualifies for four Elite traits, four Gold archetypes, All-Rounder,
True Baller and Complete Player, and those facts stay available for stats and future badge
families.

**Supersession is strict implication.** A badge is hidden when another badge the player holds
guarantees it — that badge then carries no information, and the one that says more is shown:

```text
Finisher        → Elite Finisher                    (pill)
Danger Man      → Sniper                            (rounded)
All-Rounder     → Complete Player, True Baller      ("any 3+" is implied by both)
True Baller     → G.O.A.T.
Complete Player → G.O.A.T.
```

The rule is **scoped to the trait, archetype and breadth/mastery families separately**.
Implication across families is deliberate and must not collapse: Sniper implies Elite
Finisher, and both are meant to show — the layering of traits under archetypes under breadth
badges is the readable part of the lattice. Applying implication globally would reduce a
four-trait player to a single badge.

Within the breadth/mastery block the four badges form a 2×2 grid — `{3+, all four}` ×
`{base, Elite}` — and the rule leaves exactly the informative ones:

| Base traits | Elite traits | Qualifies for            | Displayed                         |
| ----------- | ------------ | ------------------------ | --------------------------------- |
| 3           | ≤2           | All-Rounder              | All-Rounder                       |
| 4           | ≤2           | All-Rounder, True Baller | True Baller                       |
| 3           | 3            | +Complete Player         | Complete Player                   |
| **4**       | **3**        | +True Baller             | **True Baller + Complete Player** |
| 4           | 4            | all four                 | G.O.A.T.                          |

The bolded row is why this is an implication rule rather than a shape rule. Complete Player
("Elite at three") and True Baller ("solid at all four") imply each other in **neither**
direction, so both stay — they are genuinely different claims, and a player holding both has
earned two distinct things. Every other row collapses to one badge.

The ceiling is still **ten** badges (four traits + four archetypes + two from the block), but
it is now reached only by that one shape of player, rather than by every four-trait player.

Both directions are enforced by brute force over all 81 tier combinations in
`test/lib/shared/badges.test.js`: every declared `supersedes` link must be a genuine
implication, and no two displayed breadth/mastery badges may imply one another. An incomplete
supersession relation is invisible until someone reaches the combination that exposes it —
which is exactly how All-Rounder rendered beside True Baller for as long as it did.

### Two routes to Gold

Breadth and excellence are separate paths, and they converge at Diamond:

```text
Elite Attacker   → Gold Pill               excellence, one dimension
Powerhouse       → Gold Rounded Rectangle  excellence, one archetype
True Baller      → Gold Faceted            breadth, four dimensions
G.O.A.T.         → Diamond Faceted         breadth AT Elite level
```

## Visual grammar

```text
shape    = badge.shape
material = badge.tier
```

**Shape is declared per badge, not derived.** Traits and archetypes take the shape of their
category, but the four multi-trait badges take the shape of their **requirement**: "any 3+" is
notched and "all four" is faceted, at either tier.

| Shape             | Meaning               | Badges                       | Utility          |
| ----------------- | --------------------- | ---------------------------- | ---------------- |
| Pill              | one strength          | the eight trait badges       | `.badge-pill`    |
| Rounded rectangle | a two-trait archetype | the eight archetypes         | `.badge-rounded` |
| Notched           | strong in 3+ areas    | All-Rounder, Complete Player | `.badge-notched` |
| Faceted           | strong in all 4 areas | True Baller, G.O.A.T.        | `.badge-faceted` |

So Diamond spans two silhouettes and notched spans two tiers — which is the point. The two
channels answer different questions: the shape says _how broad_, the material says _at what
level_. All-Rounder and Complete Player are the same achievement in Gold and Diamond, as are
True Baller and G.O.A.T.

Within a category the silhouette is inherited as prestige rises: Attacker → Elite Attacker
stays a pill, Engine → Powerhouse stays a rounded rectangle.

### Material and the edge

Badges are **outlined, not filled**: a 1px gradient rim carries the tier colour and the
interior is the page surface.

Each badge renders as **two nested elements** — the outer carries the shape plus the gradient
edge, the inner carries the same shape inset by the edge width plus the surface colour. The
nesting is required because `clip-path` clips borders, rings, outlines and shadows alike, so a
clipped shape cannot carry a real border.

**The inner layer paints the surface rather than being transparent.** It has to: the edge
gradient sits directly behind it, so a transparent interior would show the gradient across the
whole badge instead of only as a rim. The consequence is that the surface is _assumed_
(`bg-gray-50 dark:bg-gray-800`) rather than inherited — see Limitations #10.

The `*-inner` clip-path corners are **tuned, not copied**. Insetting the outer polygon by the
edge width while keeping its corner value leaves the 45° diagonal a different weight from the
straight edges; the compensating corner is `outer + d√2 − 2d`, which at 1px gives 8.4px
against an outer 9px. **Retune these if the edge width changes.**

**Both gradient stops sit on the same Tailwind step, varying only in hue.** Tailwind 4's
scales are oklch-based, so a shared step means shared lightness — and that is the requirement,
not a nicety. A light-to-dark ramp reads as a bevel: on a wide badge the top edge sits at the
light end and the bottom at the dark end, where it recedes into the background, so the outline
looks thicker on top even though the geometry is symmetric to the pixel. Measured as the ratio
between each stop's contrast against the surface, the stops are within 0.89–1.09 of each other
in both themes. Orange reads slightly darker than amber at the same step, so bronze's dark
pair is deliberately offset by one to compensate. **Keep any replacement pair luminance-matched
and re-measure.**

**Bronze sits on the orange ramp and gold on the yellow one.** They were previously amber and
yellow — about 15° of hue apart, which read as the same colour at badge size. Orange to yellow
is roughly 30°. Silver is slate, diamond is a cyan→violet gradient.

Measured text contrast against the surface: 8.6–11.1 in dark, 4.7–7.3 in light. All clear of
WCAG AA, but the light-theme margin is thin — gold is 4.72 against a 4.5 floor, so darkening
any ink further needs re-measuring.

**Icon = badge identity, and identity is shared exactly where the _name_ is shared.**

| Icon              | Shared by                                 |
| ----------------- | ----------------------------------------- |
| `LeagueIcon`      | Finisher → Elite Finisher                 |
| `BullseyeIcon`    | Attacker → Elite Attacker                 |
| `ShieldIcon`      | Defender → Elite Defender                 |
| `GloveIcon`       | Shot Stopper → Elite Shot Stopper         |
| `EngineIcon`      | Engine → Powerhouse                       |
| `TowerIcon`       | Sentinel → Guardian                       |
| `UtilityHeroIcon` | Utility Hero → Maverick                   |
| `CrownIcon`       | All-Rounder → Complete Player (both "3+") |
| `TrophyIcon`      | True Baller → G.O.A.T. (both "all 4")     |
| `DangerManIcon`   | Danger Man only                           |
| `CrosshairIcon`   | Sniper only                               |

A trait pill is "Finisher" and "Elite Finisher" — one identity at two levels — so the shared
glyph makes the Gold version read as the upgrade of the Bronze one. Same for the
breadth/mastery pairs, which pair by **requirement** rather than by tier.

Archetype upgrades are different: they are named as separate identities (Danger Man → Sniper,
not "Elite Danger Man"), and [supersession](#supersession-is-presentation-only) means a player
never displays both members of a pair at once. A shared glyph there buys a side-by-side
reading the UI never renders, while spending a channel that helps scan a row of nine badges.
Sniper is the first archetype to take its own icon; Powerhouse, Guardian and Maverick still
inherit, so the archetype block is mid-migration.

> **Watch the Attacker collision.** Sniper requires Elite Attacker, so the crosshair and the
> `BullseyeIcon` dart-and-target are always co-present and always both Gold. They are the two
> most similar glyphs in the set at 16px. If a third target-like icon is ever added, this is
> the constraint to check first.

## Consumers

- **`src/components/PlayerBadges.svelte`** — renders the lattice, grouped by category then
  tier. It derives badges from `traits`/`traitTiers` via the shared module and **ignores the
  persisted `playerProfile`**, deliberately: rankings files written before this change hold
  badge names whose meaning has since moved (their `"G.O.A.T."` meant four _base_ traits, now
  True Baller), so deriving from tiers renders every file under today's rules with no
  migration. Reached from `PlayerHeader.svelte:73` (used by `PlayerModal.svelte:112`) and
  `src/routes/rankings/[player]/+page.svelte:223`.

    Each badge is a focusable `<span role="button">` wired to a Flowbite `Popover` by element
    id, following the repo's `triggeredBy="#id"` convention. The popover names the badge, its
    grade, and what it takes to earn it.

    **The grade is `[Elite] <breadth noun>`** — "Trait", "Elite Archetype", "Versatility",
    "Elite Mastery" — built by `gradeLabel()`, and it names the two badge axes directly:

    - the **noun** is breadth, following the number of traits required (`BREADTH_NOUNS`, indexed
      by `requiredTraitCount()`) and **not** `category`, for the same reason `shape` does: each
      multi-trait family spans two categories, so All-Rounder (breadth) and Complete Player
      (mastery) are both "any 3+" and both grade as Versatility;
    - the **"Elite" marker** is excellence, set by `requiresEliteTraits()` — true for exactly
      the ten badges whose requirement names the Elite level.

    **The material is deliberately not named.** `tier` is a function of those same two facts
    (Trait+base → bronze, Trait+Elite → gold, Versatility+Elite → diamond, …), so the colour was
    redundant with the wording while colliding across families — gold is worn by Elite traits,
    Elite archetypes and base Versatility alike, so "Gold" said three different things. The badge
    still carries the material visually.

    A catalogue test asserts shape and grade noun stay in step, and another asserts no grade ever
    contains its own tier name.

    **A trait badge's requirement is its own label**, so the popover explains the band and the
    underlying stat instead — "Top 15% for saves per session". Those percentages are derived
    from `BASE_PERCENTILE` / `ELITE_PERCENTILE`, which now live in `shared/badges.js` and are
    imported by `rankings.js`, so the explanation cannot drift from the awarding rule. Combination
    badges state their requirement directly, and count-based badges additionally list which
    traits earned them — an archetype's requirement already names its two, but "any 3+" does not
    say which three.

    Popover trigger ids are namespaced with a per-instance uid, so two `PlayerBadges` on one page
    do not collide.

- **`src/lib/server/rankings.js`** — `calculatePlayerProfiles()` persists `playerProfile` as
  the **full qualification set, as ids, without supersession**, minus trait badges (which
  `traitTiers` already describes exactly).

- **`src/lib/server/teamGenerator.js`** — `calculateTraitBalance()` (`teamGenerator.js:917`)
  spreads trait-holders across teams, weighted `W_TRAITS = 0.8` (`teamGenerator.js:829`).
  Provisional players are forced to zero traits for balancing (`teamGenerator.js:325`),
  independently of what their profile displays.

    **The team generator is deliberately tier-blind.** It reads the `traits` booleans at
    `teamGenerator.js:936` and never touches `traitTiers`, so balancing sees only trait vs
    no-trait and an even spread of holders — an Elite Finisher and a base Finisher are the same
    player to it. This keeps tiering a display concern, and is unaffected by the badge change.
    `test/lib/server/teamGenerator.test.js` (`describe('tier blindness')`) locks it in.

- The **Ballers Board does not render trait badges.** Its rows link to `/rankings/{player}`,
  where the badges appear.

## Constants

| Constant                           | Value | Source                 |
| ---------------------------------- | ----- | ---------------------- |
| `TRAIT_SEASON_GAMES_THRESHOLD`     | 35    | `rankings.js:1121`     |
| `TRAIT_MIN_TRACKED_SESSIONS`       | 5     | `rankings.js:1123`     |
| `BASE_PERCENTILE`                  | 0.45  | `shared/badges.js`     |
| `ELITE_PERCENTILE`                 | 0.85  | `shared/badges.js`     |
| `MIN_GAMES_FOR_NORMALIZATION_POOL` | 35    | `rankings.js:1636`     |
| `W_TRAITS`                         | 0.8   | `teamGenerator.js:829` |

None of these are operator-tunable — unlike momentum, traits have no `info.json → settings`
block.

## Observed behaviour (pirates, 2026 season, 33 sessions)

Measured 2026-08-24 against `data/pirates/rankings-2026.json`, recalculated the same day at
`BASE_PERCENTILE = 0.45`; 73 players, 39 established. These figures move as the season
progresses.

| Stat         | Eligible | Base bar | Elite bar | Base | Elite | Total |
| ------------ | -------- | -------- | --------- | ---- | ----- | ----- |
| Goals        | 39       | 0.181    | 0.609     | 17   | 6     | 23    |
| Off actions  | 37       | 0.268    | 0.767     | 15   | 6     | 21    |
| Def actions  | 37       | 0.416    | 0.658     | 15   | 6     | 21    |
| Save actions | 24       | 0.294    | 0.580     | 10   | 4     | 14    |

Saves have the smallest pool and the fewest holders because its denominator is
`sessionsInGoal` — see [Saves divide by sessions in goal](#saves-divide-by-sessions-in-goal).

Badges **as displayed** under the current lattice (supersession applied):

| Badge              | Held | Badge           | Held |
| ------------------ | ---- | --------------- | ---- |
| Finisher           | 17   | Danger Man      | 11   |
| Attacker           | 15   | Engine          | 11   |
| Defender           | 15   | Sentinel        | 5    |
| Shot Stopper       | 10   | Utility Hero    | 5    |
| Elite Finisher     | 6    | Sniper          | 5    |
| Elite Attacker     | 6    | Powerhouse      | 3    |
| Elite Defender     | 6    | Guardian        | 1    |
| Elite Shot Stopper | 4    | Maverick        | 0    |
| All-Rounder        | 10   | Complete Player | 2    |
| True Baller        | 2    | G.O.A.T.        | 0    |

Nobody currently holds G.O.A.T. or Maverick. That is the lattice working as designed: the
pinnacle now requires four Elite traits rather than four base ones, and Maverick needs
simultaneous Elite tiers on finishing and saves, which no one has. Before the lattice change
the same file issued G.O.A.T. to 3 players and Complete Player to 10.

The **qualification** counts persisted in `playerProfile` are higher, since they include
superseded badges: Danger Man 16 (11 shown + 5 Snipers), Engine 14, Sentinel 6, All-Rounder
14 (10 shown, 2 hidden under Complete Player and 2 under True Baller).

Total displayed badges across the league is 134, and the most any one player shows is 9
(Lunathi and Morena, both at four base traits). Two recent changes moved these figures: the
base bar dropping to 0.45 added base traits to 8 players and brought Pat and Maestro in from
zero (see [Why the base bar sits below the median](#why-the-base-bar-sits-below-the-median)),
and True Baller superseding All-Rounder took one badge back off Lunathi and Morena.

## Characteristics and limitations

Properties of the current rule, recorded neutrally.

1. **Min-max makes a norm outlier-relative.** The minimum is almost always 0, so a norm is
   effectively "fraction of the single best player's rate", and one player's exceptional run
   compresses everyone else. Percentile bands blunt this — the bar is a rank, not a value — but
   the underlying norm still moves when the league's best mover changes.
2. **Carry-forward keeps departed players in the pool.** A player who stopped attending months
   ago retains their last norms and continues to sit inside the eligible pool that sets the
   bands.
3. **Breadth and excellence are now separate routes.** Four base-level traits earn Gold via
   True Baller; Elite specialisation earns Gold via Elite traits and Elite archetypes. Diamond
   is reserved for their convergence — breadth _at_ Elite level. This resolves the earlier
   imbalance where four median traits outranked a single perfect norm. Note that the base bar
   at 0.45 makes the breadth route slightly cheaper than it was, so Gold is now a little more
   often earned by breadth than by excellence — 14 of 45 Gold badges on pirates 2026.
4. **Badge count is still high for broad players** — ten is the ceiling, reached by four base
   traits and by four Elite ones alike. Supersession collapses each shape family to its
   highest tier but never merges families, which is what keeps the tap-to-highlight
   interaction meaningful: the contributing badges have to be on screen to be lit. Bounded by
   `test/lib/shared/badges.test.js`.
5. **Save actions are a role stat, now measured per session in goal.** The denominator is
   `sessionsInGoal`, not attendance, so playing outfield no longer dilutes a keeper's rate. Two
   residual effects remain, both from the missing keeper field: a keeper who faced nothing is
   dropped rather than counted, and rotation within a session credits every player who made a
   save with a full session in goal. See "Saves divide by sessions in goal" above.
6. **The Ballers Board ranks by season totals**, while traits use per-session averages — the
   board and the badges it links to are ordered by different quantities, so a high-attendance
   player near the top of the board may hold fewer badges than a low-attendance player far
   below them.
7. **Two of the six two-trait pairs have no archetype**, so some trait pairs display as two
   trait badges and nothing else. This is deliberate (see Catalogue above).
8. **Percentile bands fix the holder count, not the standard.** With a fixed eligible pool
   there are always exactly as many Elite players as the 85th percentile admits, so a player
   can change tier — and therefore change badges — without playing, because the bar moved
   under them. See `tasks/202608240958-traits-transparency-report.md`.
9. **Badges assume the page surface behind them.** The outlined style needs an opaque inner
   layer painted the same colour as whatever sits behind the badge. It is hardcoded to the page
   background, so a badge rendered on a panel of a different colour shows a visible
   badge-shaped patch — currently the case inside `PlayerModal`, whose header sits on a
   translucent dialog surface. Fixing it properly means either exposing the surface as a custom
   property the container sets, or rendering the rim as a stroked SVG so the interior can be
   genuinely transparent.
10. **The 35-game bar reads season ELO games, while the team generator's identical bar reads
    all-time `elo.gamesPlayed`.** This is deliberate — traits describe current-season form — but
    it means a returning veteran can be non-provisional for the draw and hold no traits.

## Files

| File                                           | Role                                                       |
| ---------------------------------------------- | ---------------------------------------------------------- |
| `src/lib/shared/badges.js`                     | the lattice: catalogue, qualification, supersession        |
| `src/lib/server/rankings.js`                   | capture, averages, normalisation, trait tiers, awarding    |
| `src/lib/server/teamGenerator.js`              | `calculateTraitBalance()`, `W_TRAITS` (tier-blind)         |
| `src/components/PlayerBadges.svelte`           | badge rendering, visual grammar, tap-to-highlight          |
| `src/app.css`                                  | `.badge-*` shape utilities, outer and inset variants       |
| `src/components/Icons/*Icon.svelte`            | badge icons (shared across tiers where the name is shared) |
| `test/lib/shared/badges.test.js`               | lattice, exhaustive over all 81 tier combinations          |
| `test/lib/server/rankings.test.js`             | `calculatePlayerProfiles` unit tests                       |
| `test/lib/server/rankings.shotStopper.test.js` | `sessionsInGoal` semantics through `updateRankings()`      |
| `test/components/PlayerBadges.svelte.test.js`  | grammar and highlight-interaction tests                    |
| `test/lib/server/teamGenerator.test.js`        | trait-balance and tier-blindness tests                     |
| `scripts/traits-report.mjs`                    | offline transparency report; imports the shared lattice    |

# Stars of the Day on the Player Profile

**Date:** 2026-11-14
**Request:** "I want to see my Stars of the Day awards on my profile"

## Overview

Individual session awards (MVP, Golden Boot, Playmaker, Brick Wall, Golden Glove) were only
visible on each session's Table and Cup screens. The profile page (`/rankings/[player]`) now
shows them in three places:

- **Appearance cards** - redesigned: gold-outlined award chips beside the League/Cup trophy
  chips, the final league position and cup performance, a compact four-column points strip,
  and a team badge that opens the team modal for that session (it used to navigate to the
  Table screen).
- **Rank Progression chart** - a row of award icons under each node's trophy row.
- **Performance section** - a "Stars of the Day" totals panel, and longest award streaks in the
  streaks and doubles panel.

## Architecture decisions

- **Co-winners all take the award.** `ballerAwards(stats, dateTops)` in
  `src/lib/server/momentum.js` awards every player whose session total equals the session top
  from the existing `deriveBallerTops()`. This is the rule the news feed and Ballers Board
  streaks already use. The live Stars of the Day board on Table/Cup is unchanged and still
  breaks ties by "first to reach it", so on a tied session the profile can show an award the
  board listed under another name. On pirates 2026, 34 of 198 awarded categories are ties.
- **Awards are computed at read time**, not stored. Nothing is written to the rankings files,
  so no recalculation or migration is needed.
- **One mapper for the card's data.** `appearanceDetail()` in `src/lib/server/sessionDetails.js`
  flattens a history entry into the fields the card renders. Both `GET /api/rankings/[player]`
  and `GET /api/champions/[player]` use it. The champions endpoint previously returned bare
  history entries, so the trophy popover's cards only ever showed a date and team; they now
  show the full card.
- **`StarAwardChip` is not a `BadgeChip`.** `BadgeChip` belongs to the trait catalogue and
  paints an opaque page-coloured interior behind a gradient rim. Award chips sit on glass cards
  and in popovers, so they use a plain gold border with a transparent interior, in the
  archetype badges' rounded shape (`badge-rounded`) and the gold tier's ink.
- **Icons are the existing award glyphs** (star, boot, bullseye, shield, glove), centralised
  for new code in `StarAwardIcon.svelte`. `NewsCard`, `MomentumBoard` and `StarsOfTheDay` keep
  their own copies of the map; consolidating them was left out to keep the change small.
- **Team modal via `page.state.teamModal`.** The card calls `pushState` itself (as `NewsCard`
  does); the profile and champions pages each mount a `TeamModal`. Any future host of
  `AppearanceCard` must do the same.
- **`preserveScroll()` extracted** from `NewsCard` to `src/lib/client/preserveScroll.js`. It now
  restores every scrollable ancestor, because a card inside a scrolling popover has two.
- **Point labels abbreviate by container width** (App / KO under 17rem). The size container is
  the points strip, not the card root: a size container has no intrinsic width, and a card
  root container collapsed the trophy popover to a sliver.
- **The card header wraps** in the narrow two-column grid, so the team name drops under the
  date instead of truncating - it is the card's one control.
- **Streak tiles show only for runs of two or more.** A missed session does not break a run
  (same as league/cup streaks); an appearance without the award does.
- **The streaks panel is titled "Longest Streaks & Doubles"**, so its tiles carry short names
  (League, Cup, Doubles, Golden Boot...) instead of repeating "Longest X Streak".
- **Totals and streak tiles wrap three to a row, centred.** Five award totals across a 384px
  phone truncated "Golden Boot" and "Golden Glove"; they now sit 3 + 2, and in one row from `sm`.
- **The chart's award row collapses up** to sit directly under the node when the session
  brought no trophy; otherwise it sits under the trophy row.
- **Card sections are separated by dividers** (date and team / result / honours / points /
  total and ELO) via `divide-y`, so a card without honours has no doubled rule.

## Files

**New**

- `src/lib/server/sessionDetails.js` - `appearanceDetail()` history-entry mapper
- `src/lib/shared/starAwards.js` - award types/labels, `awardTotals()`, `longestAwardStreaks()`
- `src/lib/client/preserveScroll.js` - scroll preservation across modal open
- `src/components/StarAwardIcon.svelte`, `src/components/StarAwardChip.svelte`

**Modified**

- `src/lib/server/momentum.js` - `ballerAwards()`; typed `BALLER_CATEGORIES`
- `src/lib/shared/domain.d.ts` - `BallerAwardType`, `AppearanceDetail`, `awards` on
  `PlayerSessionDetail`, widened `ChampionSession`
- `src/lib/shared/helpers.js` - `ordinal()`, `formatCupRound()` (moved from `PerformanceSection`)
- `src/routes/api/rankings/[player]/+server.js`, `src/routes/api/champions/[player]/+server.js`
- `src/components/AppearanceCard.svelte` - redesign
- `src/components/NewsCard.svelte` - uses the shared `preserveScroll` and `ordinal`
- `src/routes/rankings/[player]/+page.svelte`, `src/routes/champions/+page.svelte` - host
  `TeamModal`
- `src/routes/rankings/[player]/components/RankProgressionChartNode.svelte` - award icon row
- `src/routes/rankings/[player]/components/RankProgressionChart.svelte` - 14px more bottom room
- `src/routes/rankings/[player]/components/PerformanceSection.svelte` - totals panel, streak
  tiles

## Testing

- Backend: `ballerAwards` (tops, ties, empty categories) in `momentum.test.js`;
  `sessionDetails.test.js`; `starAwards.test.js`; `ordinal`/`formatCupRound` in
  `helpers.test.js`.
- Frontend: `AppearanceCard.svelte.test.js` (team modal push, result row, chips, points);
  `PerformanceSection.svelte.test.js` (totals, hidden when empty, streak threshold).
- Browser (headless Chrome over CDP against the dev server, pirates data): profile at 384px
  and 1280px with no horizontal overflow or clipped rows; team modal opens from a card with
  the scroll position preserved and closes on back; chart node popover; champions trophy
  popover and its team modal.
- `npm test`, `npm run lint` and `npm run check:ci` pass.

## Assumptions and limitations

- Totals and streaks follow the "Show last N appearances" filter, like the position charts.
- In sessions where only goals were tracked (pirates, Jan-Feb 2026), MVP and Golden Boot go to
  the same player(s), as on the live board.
- Dark mode was not checked in the browser; the new classes carry `dark:` variants.
- The champions trophy popover reads the current year only (unchanged behaviour).

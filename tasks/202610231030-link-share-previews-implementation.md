# Link Share Previews - Implementation

## Overview

Shared links now preview with a page-specific title and description, plus a branded image.
Titles follow `[Page] > [League] > Leagr`.

## Root cause

Page titles were set by each page in a `$effect` (`titleParts` store). Effects never run during
SSR, and link-preview crawlers (WhatsApp, Slack, iMessage) don't run client JS, so every link in
a league previewed as `League > Leagr` with the same generic description.

## Architecture decisions

- **Central route map** (`src/lib/shared/pageMeta.js`), keyed by `page.route.id`. The root layout
  calls `pageMeta()` during render, so SSR emits the right tags. Dynamic routes read `page.params`
  (`[player]`, `[year]`).
- **Date-aware copy only when the link carries `?date=`.** A link without one previews generically
  rather than claiming the server's "today" is the session date. Players (the most-shared link)
  reads "Sign up for {League} on Saturday 24 October."
- **No live data in previews.** League data sits behind the access code; previews are visible to
  anyone with the URL and crawlers cache them for days.
- **og:image is absolute, built from `APP_URL`** (`https://leagr.co.za/og-image.png`). The request
  origin is unusable behind IIS/ARR (the container sees `localhost:3001`). One brand image for all
  leagues for now; per-league images are a possible follow-up.
- `twitter:*` tags now use `name=` (the spec) and `summary_large_image`. Added `og:site_name`,
  image dimensions and alt text.

## Files

- `src/lib/shared/pageMeta.js` - new: route -> title parts + description
- `src/routes/+layout.svelte` - head tags driven by `pageMeta()`; og/twitter image tags
- `src/routes/**/+page.svelte` (21 files) - removed the `titleParts` `$effect` blocks
- `src/lib/client/stores/pageTitle.js` - deleted
- `static/og-image.png` - new 1200x630 brand card (source: `scratchpad/og.html`)
- `test/lib/shared/pageMeta.test.js` - new

## Testing

Unit tests for title composition, params, date formatting/malformed dates and fallbacks. Verified
SSR output with curl against a dev server for `/`, `/players` (with and without `?date`),
`/rankings/[player]`, `/year-recap/[year]` and the root domain.

## Limitations

- Crawlers cache previews; links already shared keep their old preview until the cache expires.
- `og:url` is deliberately omitted (the shared URL may carry `?code=`).

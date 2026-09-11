# iOS market drawer collapse — fix

## Overview

Two players reported that the fantasy **Player market** sheet would not open on iOS — one on
Safari, one saying "Safari and Chrome". Tapping a slot on the pitch produced a thin strip at
the bottom of the screen showing only the heading ("Player market · $40.5m to spend") and the
close button; no player rows at all.

Chrome on iOS is WebKit too, so "both browsers" is one engine, and the bug is a WebKit/Blink
layout difference rather than anything browser-specific.

## Cause

The market sheet is a Flowbite `Drawer` with `placement="bottom"`. A drawer is a `<dialog>`
whose theme sets `open:flex flex-col`, `mt-auto w-full!` and `max-h-none`, and it has **no
height of its own** — it is sized by its content.

Inside it, the scroller grew into the sheet the usual way:

```svelte
<div class="app-container flex min-h-0 flex-1 flex-col">
    <!-- heading + scroller -->
    <div class="min-h-0 flex-1 overflow-y-auto">…market…</div>
</div>
```

`flex-1` is `flex: 1 1 0%`, and `min-h-0` removes the automatic minimum size, so the item's
contribution to its container's intrinsic height is **zero**. When the flex container has a
definite height that is harmless — the item grows into the free space. When the container's
height is `auto`, as a bottom drawer's is, the container has to size itself _from_ those
contributions, and the two engines disagree:

- **WebKit** takes the flex base size, gets 0, and the sheet collapses to its own `p-4`.
- **Blink** sizes from the content instead, which is why it looked correct in every
  browser the feature was built and tested in.

Measured on the real markup and the real built stylesheet, 390×844:

|                  | dialog height | scroller height | market rows in view |
| ---------------- | ------------- | --------------- | ------------------- |
| WebKit, before   | 34px          | 0px             | 0 of 24             |
| Chromium, before | 717px         | 651px           | 12 of 24            |
| WebKit, after    | 687px         | 621px           | 12 of 24            |
| Chromium, after  | 687px         | 621px           | 12 of 24            |

The heading stayed visible in the bug because it simply overflowed the zero-height wrapper —
which is exactly what both screenshots show.

## The fix

`src/routes/fantasy/team/+page.svelte` — the scroller carries its own height cap instead of
asking the sheet for room, so nothing depends on how an engine sizes a flex container from
its items:

- wrapper: `app-container flex min-h-0 flex-1 flex-col` → `app-container` (plain block)
- scroller: `min-h-0 flex-1 overflow-y-auto` → `max-h-[calc(85dvh-6rem)] overflow-y-auto`
- drawer cap: `max-h-[85vh]!` → `max-h-[85dvh]!`

`dvh` over `vh` because the drawer is pinned to the bottom of the screen, where iOS's
collapsing toolbars are; `h-dvh` / `100dvh` is already what the layout and the year recap use.

The two caps are coupled: the heading plus the drawer's own `p-4` measures ~4.1rem, and 6rem
is subtracted so there is slack for a heading that wraps on a narrow screen. Without that
slack a wrapped heading pushed the sheet into the 85dvh cap and cropped ~10px off the bottom
of the list.

## Testing

- `test/routes/fantasy/team.svelte.test.js` — new case _"caps the market scroller itself
  rather than growing into the sheet"_. jsdom has no layout engine and can never reproduce
  the collapse, so the test pins the shape instead: the scroller carries a height cap and
  carries neither `flex-1` nor `min-h-0`. Verified to fail against the old markup.
- Full suite green: 1345 backend, 318 frontend.
- Verified in a real WebKit, not by reasoning. The recipe extends the one in
  `202609110920-fantasy-pick-screen-rework-implementation.md`: render the page in jsdom, dump
  `document.body.innerHTML`, wrap it in the built stylesheet, strip the drawer's
  `translate-y-full` and call `showModal()`, then load it in Playwright's WebKit _and_
  Chromium and measure. The before/after screenshots of that dump are a pixel match for the
  reported ones.
- Edge cases measured in WebKit after the fix: a 3-player market hugs its content (241px, no
  scrollbar); 320×568 gives a 453px sheet that scrolls; a deliberately wrapped heading at
  320×568 stays under the cap with nothing cropped.

## Notes and limitations

- Only one `<Drawer>` exists in the app, so the fix is contained to this screen.
- The same `flex-1 min-h-0` chain appears in the year recap carousel, but it is rooted in a
  `min-h-[calc(100dvh-9rem)]` container rather than an auto-height one, so the intrinsic
  sizing path is never taken there. Left alone.
- Running Playwright's WebKit on this machine needs two shared libraries the host lacks
  (`libwoff2dec`, and the `libjxl.so.0.8` SONAME link for the copy WebKit already bundles).
  They were placed in the browser's own `sys/lib`, so no root and no system change.

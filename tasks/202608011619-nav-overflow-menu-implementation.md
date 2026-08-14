# Top nav overflow menu + shared page width

## Overview

The top navbar's four icon buttons (Share link, News, Settings, theme toggle) were replaced by a
single 3-dot overflow menu, so new entries can be added without crowding the bar. The tooltips became
the menu labels. At the same time the navbar's inner row was narrowed to the same width as the page
content column, which previously only matched below the `md` breakpoint.

Two related fixes fell out of the work:

- **The app now owns theme persistence, and upgrading users keep their choice.** Flowbite's
  `DarkMode` component stored the preference under its own key, `THEME_PREFERENCE_KEY`, and applied
  it via a `<svelte:head>` script that SSR emitted into the document head — so persistence worked,
  but through a component we were about to delete, in parallel with `src/app.html`'s own boot script
  reading key `theme` (which nothing ever wrote). The menu item is now backed by
  `src/lib/client/stores/theme.js` (previously written and unit-tested but wired to nothing), which
  writes `theme`. To stop existing users being reset to their OS preference on the deploy, the
  `app.html` boot script adopts a `THEME_PREFERENCE_KEY` value when `theme` is unset, writes it
  across, and clears the old key — a one-time migration that runs before first paint.
- **Frontend test environment gaps.** `ResizeObserver`/`IntersectionObserver` stubs were not
  constructible with `new` (floating-ui does exactly that), and jsdom implements neither the Popover
  API nor `ToggleEvent` — both of which Flowbite's dropdowns/tooltips/popovers rely on. Any test
  rendering a Flowbite popover was silently throwing.

## Architecture decisions

**Menu lives in its own component.** `src/routes/components/NavMenu.svelte` owns the trigger, the
dropdown and the share logic (moved out of `TopNavBar.svelte`), leaving `TopNavBar` as a thin shell
of brand + loading spinner + menu. Adding an entry is now a single `DropdownItem`.

It follows the existing `src/components/PlayerActionsDropdown.svelte` pattern: `simple` dropdown,
`DotsVerticalOutline` trigger, `<span class="flex items-center"><Icon class="me-2 h-4 w-4" />Label`
item bodies, and the `Dropdown` kept as the immediate next sibling of the trigger (Flowbite's popper
binds to `previousElementSibling`). The trigger deliberately has **no `onclick`** — Popper attaches
its own mousedown/focusin handlers, and a manual toggle fights them (rankings/champions year pickers
do the same).

**Theme label is snapshotted on open, not derived live.** `$isDarkMode` driving the item label meant
that clicking it changed store state and closed the menu in the same flush; re-rendering content
inside the popover while it tears down leaves Flowbite's popover **stuck open** (verified in Chrome:
the menu stayed visible with a frozen label, while `aria-expanded` was already `false`). Since the
dropdown body is only mounted while open, an `$effect` snapshots `get(isDarkMode)` into
`showsDarkMode` when the menu opens — always fresh on open, inert during close. Worth remembering
for any future menu item whose label depends on state the item itself changes.

**Width recipe extracted, not changed.** `.app-container` in `src/app.css` holds the existing
`container mx-auto md:w-2/3 lg:w-1/2 xl:w-1/3`, and is now used by both the layout content column
and the navbar's inner row. Rendered page width is byte-for-byte unchanged; only the navbar moved.
The `<Navbar>` is `fluid` with `px-0 sm:px-0` so the bar stays full-bleed while its inner row carries
the width and a matching `px-2`. The bottom nav keeps Flowbite's `max-w-lg` inner grid (decided with
the user — 6 icons spread across a wider column looks sparse).

Content width was left as a fraction of the viewport rather than given a hard cap; note it is
therefore _not_ capped on ultra-wide displays (~853px at 2560px).

## Files modified

| File                                            | Change                                                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `src/routes/components/NavMenu.svelte`          | **New.** Kebab trigger + dropdown with Share link / News / Settings / theme items; owns `shareCurrentPage()`                     |
| `src/routes/components/TopNavBar.svelte`        | Reduced to brand + spinner + `<NavMenu />`; `fluid` navbar with `navContainerClass="app-container px-2"`                         |
| `src/app.css`                                   | Added `.app-container` utility                                                                                                   |
| `src/app.html`                                  | Boot script migrates the legacy `THEME_PREFERENCE_KEY` to `theme` before first paint                                             |
| `src/routes/+layout.svelte`                     | Content column uses `app-container`                                                                                              |
| `src/lib/client/stores/theme.js`                | Added `isDarkMode` derived store and `toggleTheme()`                                                                             |
| `test/setup.svelte.js`                          | Observer stubs made constructible; added `Element.prototype.animate`, `ToggleEvent`, `showPopover`/`hidePopover`/`togglePopover` |
| `test/lib/client/stores/theme.svelte.test.js`   | 8 cases for `isDarkMode` / `toggleTheme`                                                                                         |
| `test/routes/components/NavMenu.svelte.test.js` | **New.** 6 render tests                                                                                                          |

`DarkMode` is no longer used anywhere, so its `<svelte:head>` theme-init script is gone too; the
`app.html` boot script is now the single, FOUC-free source of truth.

**Menu panel is glass, items are not painted.** The items originally carried
`dark:bg-gray-800` (copied from `PlayerActionsDropdown`), which rendered opaque against the
translucent `glass-strong` panel — visible as a different shade in the group's top/bottom padding.
Items are now `bg-transparent`, so only the panel paints a background (verified: panel
`…/0.75`, group and items `rgba(0,0,0,0)` in both themes). Page content does show faintly through
the panel, consistent with the bottom nav's glass treatment.

## Testing

- `test/lib/client/stores/theme.svelte.test.js` — `toggleTheme()` across light/dark/system (both OS
  preferences) and persistence to the `theme` key; `isDarkMode` resolution.
- `test/routes/components/NavMenu.svelte.test.js` — collapsed trigger, all four items on open, date
  preserved in News/Settings hrefs, theme-only menu on the root domain, toggle + close, and the label
  reflecting the opposite mode. `$app/state`, `$app/paths`, auth and clipboard are mocked.
  `openMenu()` waits out Flowbite's ~200ms rAF debounce and lets the popover's toggle event settle;
  without that wait the close assertion races under full-suite load.
- Full suite: 903 backend + 172 frontend tests pass; lint clean.

**Browser verification** (headless Chrome over CDP, `pirates.leagr.local:5173`): menu opens with all
four items; the theme item flips light/dark, closes the menu and survives a reload; Escape closes;
Settings and News navigate; the root domain shows only the theme item; no horizontal overflow at
390px. Alignment at 1440px: navbar row `[480, 960]` vs content column `[480, 960]`.

## Assumptions and limitations

- The content column sits inside the scrolling container while the navbar does not, so a classic
  (non-overlay) scrollbar offsets them by the scrollbar width — measured at 5px on the root domain,
  15px at mobile width. Deemed not worth a `scrollbar-gutter` workaround.
- The legacy-key migration lives in `src/app.html`, which no unit test covers; it was verified in a
  browser instead (legacy `dark`, no `theme` → renders dark, writes `theme=dark`, clears the legacy
  key; no keys at all → follows the OS preference).
- The theme item toggles between explicit light and dark. The store's `'system'` value is still the
  default for anyone who has never toggled, but there is no UI to return to it.

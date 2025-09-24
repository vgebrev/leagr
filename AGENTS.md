# Repository Guidelines

## Project Structure & Module Organization

- Source: `src/` (SvelteKit 5). Pages in `src/routes/**/+page.svelte`; API handlers in `src/routes/api/<resource>/+server.js`.
- Libraries: client logic in `src/lib/client` (stores, services); server logic in `src/lib/server` (data, scheduling, rankings); shared UI in `src/components`.
- Assets: `static/` (e.g., `favicon.svg`).
- Data: local JSON under `data/` (volume-mounted in production). Do not commit real data.
- Tests: mirror `src/` under `test/` (backend in `test/lib/server`, frontend in `test/lib/client`).

## Build, Test, and Development Commands

- `npm ci`: Install dependencies.
- `npm run dev`: Start dev server at `http://localhost:5173` (use `-- --host` to test across devices).
- `npm run build` / `npm run preview`: Production build and local preview.
- `npm run check`: Type and Svelte checks (uses `jsconfig.json`).
- `npm run lint` / `npm run format`: ESLint + Prettier (with Svelte/Tailwind plugins).
- `npm test`: Run all tests; use `npm run test:backend` or `npm run test:frontend` for subsets.

## Coding Style & Naming Conventions

- Language: JavaScript with JSDoc; Svelte 5 (runes). Indentation: 2 spaces.
- Components: PascalCase (e.g., `TeamBadge.svelte`). Modules/functions: `camelCase`.
- Routes: API at `src/routes/api/<resource>/+server.js`; pages at `+page.svelte`; layouts at `+layout(.server).js|.svelte`.
- Quality: run `npm run lint` and `npm run check` before committing.

## Testing Guidelines

- Framework: Vitest with separate configs (`vitest.config.js` backend, `vitest.svelte.config.js` frontend/jsdom).
- Location/Names: place tests under `test/**`, mirroring module paths; use `*.test.js`.
- Coverage: prioritize core domain logic (`src/lib/server/**`) and API handlers. Add tests for bug fixes.

## Commit & Pull Request Guidelines

- Commits: follow Conventional Commits (e.g., `feat: add ELO to rankings table`). Keep messages imperative and scoped.
- PRs: include a clear summary, linked issues, reproduction steps, and screenshots for UI changes. Ensure `npm run lint`, `npm run check`, and `npm test` pass. Note any data migrations.

## Security & Configuration Tips

- Required env: `API_KEY`, `ALLOWED_ORIGIN`, `APP_URL`, and Mailgun vars for email. Never commit secrets.
- For local testing, set subdomains in your hosts file as described in `README.md`.

## Agent-Specific Notes

- Keep changes minimal and focused; update docs/tests alongside code. Prefer small PRs. See `CLAUDE.md` for deeper architecture and workflow expectations.

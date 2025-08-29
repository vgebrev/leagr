# Repository Guidelines

## Project Structure & Module Organization

- Source: `src/` (SvelteKit 5). Pages in `src/routes/**/+page.svelte`, server endpoints in `src/routes/api/**/+server.js`.
- Libraries: `src/lib/client` (stores, services), `src/lib/server` (data, scheduling, rankings), `src/components` (shared UI), `static/` (assets like `favicon.svg`).
- Data: JSON files under `data/` (created locally; volume-mounted in production). Do not commit real data.
- Tests: `test/` mirrors `src/` (backend under `test/lib/server`, frontend under `test/lib/client`).

## Build, Test, and Development Commands

- `npm ci`: Install dependencies.
- `npm run dev`: Start dev server at http://localhost:5173. Use `-- --host` to test across devices.
- `npm run build` / `npm run preview`: Production build and local preview.
- `npm run check`: Type/svelte checks (uses `jsconfig.json`).
- `npm run lint` / `npm run format`: Lint and format (ESLint + Prettier).
- `npm test`: Run all tests (backend + frontend). Use `npm run test:backend` or `npm run test:frontend` for a subset.

## Coding Style & Naming Conventions

- Language: JS with JSDoc; Svelte 5 (runes). Indentation: 2 spaces.
- Components: PascalCase (`TeamBadge.svelte`, `RankingsTable.svelte`). Modules and functions: `camelCase`.
- API routes: `src/routes/api/<resource>/+server.js`. Pages: `+page.svelte`; layouts: `+layout(.server).js|.svelte`.
- Tools: ESLint (`eslint.config.js`), Prettier (with Svelte and Tailwind plugins). Run `npm run lint` before committing.

## Testing Guidelines

- Framework: Vitest with separate configs (`vitest.config.js` for backend, `vitest.svelte.config.js` for frontend/jsdom).
- Location/Names: place tests in `test/**`, mirroring module paths; use `*.test.js`.
- Coverage: prioritize core domain logic (`src/lib/server/**`) and API handlers. Add tests for bug fixes.

## Commit & Pull Request Guidelines

- Commits: follow Conventional Commits seen in history — `feat:`, `fix:`, `chore:`, etc. Keep messages imperative and scoped (e.g., `feat: add ELO to rankings table`).
- PRs: include a clear summary, linked issues, reproduction steps, and screenshots for UI changes. Ensure `npm run lint`, `npm run check`, and `npm test` pass. Note any data migrations.

## Security & Configuration Tips

- Required env: `API_KEY`, `ALLOWED_ORIGIN`, `APP_URL`, and Mailgun vars for email. Never commit secrets. For local testing, set subdomains in hosts file as in `README.md`.

## Agent-Specific Notes

- Keep changes minimal and focused; update docs/tests alongside code. Prefer small PRs. See `CLAUDE.md` for deeper architecture notes and workflow expectations.

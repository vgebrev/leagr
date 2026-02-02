# AGENTS.md

This file is for agentic coding tools working in this repo. Keep changes minimal and aligned with
existing patterns. CLAUDE.md is the primary reference for architecture and workflow.

## Project Map

- SvelteKit 5 app in `src/` (Svelte 5 runes).
- Pages: `src/routes/**/+page.svelte`.
- API handlers: `src/routes/api/<resource>/+server.js`.
- Client code: `src/lib/client/` (stores, services).
- Server code: `src/lib/server/` (data, managers, business logic).
- Shared UI: `src/components/`.
- Shared logic: `src/lib/shared/`.
- Data: JSON in `data/` (never commit real data).
- Tests mirror `src/` under `test/`.

## Build, Lint, Test

```bash
npm ci
npm run dev          # http://localhost:5173
npm run build
npm run preview
npm run lint
npm run format
npm run check
npm test             # backend + frontend
npm run test:backend
npm run test:frontend
```

### Run a single test

```bash
# single backend file
npm run test:backend -- test/lib/server/playerManager.test.js

# single frontend file
npm run test:frontend -- test/lib/client/stores/players.test.js

# by test name (backend example)
npm run test:backend -- -t "adds player to waiting list"
```

## Code Style (JS + Svelte)

- Language: JavaScript (ESM) with JSDoc types; repo `type: module`.
- Svelte: Always use Svelte 5 runes (`$state`, `$derived`, `$effect`).
- Formatting: Prettier with `tabWidth: 4`, `singleQuote: true`, `trailingComma: none`,
  `printWidth: 100`, `semi: true`, `singleAttributePerLine: true`.
- Linting: ESLint + Svelte plugin; `no-console` except `console.warn` and `console.error`.
- Indentation: 4 spaces (per Prettier config).

### Types and JSDoc

- Prefer JSDoc annotations for complex objects and function boundaries.
- Use `@typedef` and `@param`/`@returns` when it improves clarity.
- Avoid full JSDoc coverage on trivial helpers; keep it pragmatic.

### Svelte/Frontend Conventions

- Components live in `src/components/` and use PascalCase filenames.
- Use `+page.svelte` for pages and `+layout(.server).js|.svelte` for layouts.
- Client services live in `src/lib/client/services/` and are `*.svelte.js`.
- Stores live in `src/lib/client/stores/`; keep state immutable where possible.
- Prefer `$lib` alias imports for shared code in Svelte and tests.

## Imports & Modules

- Use ESM `import`/`export` everywhere.
- Prefer `$lib` aliases over deep relative paths in app/tests when available.
- Group imports logically: Node built-ins, external deps, `$lib` aliases, local relative.
- Avoid side-effect imports unless required.
- Keep import lists sorted within each group when editing.

## Naming & Structure

- Components: PascalCase (`TeamBadge.svelte`).
- Functions/modules: camelCase.
- Managers: `{Feature}Manager` with factory creators (`createPlayerManager`).
- API route files: `src/routes/api/<resource>/+server.js`.
- Svelte client services: `src/lib/client/services/{feature}.svelte.js`.

### Routing and Files

- API routes are `src/routes/api/<resource>/+server.js`.
- Request/response logic stays in API handlers; business logic in server managers.
- Pages should avoid direct data file access; use client services or API calls.

## Error Handling & Validation

- Validate inputs using `$lib/shared/validation.js` helpers.
- Use custom error classes that preserve HTTP status codes.
- Return appropriate status codes (400/403/404/500) in endpoints.
- Handle multi-league context and authentication headers in API routes.

### Authentication Headers

- `X-API-KEY` for API auth, `Authorization` for league access code.
- `X-ADMIN-CODE` required for admin endpoints (avatars, discipline, settings).
- `X-CLIENT-ID` is used for client ownership tracking.

## Server-Side Patterns (from CLAUDE.md)

- Use factory functions for managers; call `.setLeague(leagueId)` before operations.
- Use `setMany()` for atomic multi-key updates (race-free).
- Invalidate settings cache after settings updates.
- File operations are mutex-protected; avoid bypassing `data.js`.

### Data and League Context

- Multi-league routing via subdomain; always pass `leagueId` to server operations.
- Daily sessions stored as `data/{leagueId}/YYYY-MM-DD.json`.
- Rankings stored as `data/{leagueId}/rankings-YYYY.json`.
- Invalidate settings cache after any league or day-level settings change.

## Tests

- Vitest with separate configs: `vitest.config.js` (backend) and
  `vitest.svelte.config.js` (frontend/jsdom).
- Tests live in `test/**` and mirror `src/` paths.
- Add tests for bug fixes, especially in `src/lib/server/**` and API handlers.

### Testing Patterns

- Backend tests use Node environment; frontend tests use jsdom.
- Tests should mirror the `src/` path under `test/`.
- Prefer `$lib` imports in tests when available.
- Cover both happy path and error cases for API handlers.

## Security & Data

- Required env vars: `ALLOWED_ORIGIN`, `API_KEY`, `APP_URL`, Mailgun vars.
- Never commit secrets or real data under `data/`.
- Remember auth headers: `X-API-KEY`, `Authorization` (access code), `X-ADMIN-CODE`.

### Required Environment Variables

- `ALLOWED_ORIGIN`, `API_KEY`, `APP_URL`.
- Mailgun vars: `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`.
- Optional: `BODY_SIZE_LIMIT`, `LOGS_DIR`.

## Agent Workflow Expectations

- Keep diffs small and focused.
- Update docs/tests alongside code when behavior changes.
- Prefer simple, direct solutions; avoid large refactors.
- Update or add tests when behavior changes.
- Keep docs in `tasks/` for non-trivial features (overview, files changed, tests).

## Cursor/Copilot Rules

- No `.cursor/rules/`, `.cursorrules`, or `.github/copilot-instructions.md` found in repo.

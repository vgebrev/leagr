# Returning deploy.sh to version control

## Overview

`deploy.sh` held live production secrets inline, so it was kept untracked — it had been committed
once before and removed in `18e87d4` ("Oops"). This change splits configuration from logic so the
script can live in the public repo safely, and adds a backstop against the mistake recurring.

## Security analysis that preceded the change

**Already public.** `deploy.sh` was on `origin/main`/`origin/develop` in `be7ef31` and `6923c5d`
(2025-07-04) before deletion in `18e87d4`. Deleting a file does not remove it from history, so that
version is still readable. It exposed `API_KEY="09a5ca6a-…"`, `footy.gebrev.com`,
`C:/pirates-footy-roster/*`, and the `lesley-desktop-deploy` alias.

Impact assessed as low: the leaked `API_KEY` is dead (auth moved to signed `_ls` session cookies;
no consumer of it remains in `src/`), and `REMOTE_HOST` is an SSH _alias_ — the real hostname, user,
port and key path live in `~/.ssh/config` and were never in the repo.

**Not public.** `git log --all -S<secret>` returned zero hits for the current `SESSION_SECRET`,
`MAILGUN_SENDING_KEY` and `OPENAI_API_KEY`. The 2025 leak predates all three.

**Decision:** track a sanitised script. Disclosure risk is negligible — `README.md` already
documents the entire deployment model — so the real risk is recurrence, which the hook addresses.

Deliberately **not** done: no git history rewrite (641 commits, 159 tags; forks and GitHub's
unreachable-object retention make it high-cost for a dead key and a machine nickname), and no
deployment from GitHub Actions (would require inbound SSH to a home desktop with a key in GitHub
secrets, or a self-hosted runner, which GitHub advises against on public repos). Secret rotation was
consciously deferred by the repo owner.

## Architecture decisions

**All environment-specific values move out, not just secrets.** Host alias, Windows paths, port and
domains join the secrets in `deploy.env`. This makes the tracked script fully generic, so the
"am I leaking infrastructure?" question disappears rather than needing a judgement call per line.

**Fail fast, all at once.** `require_var` collects every missing key and reports them in one pass,
rather than failing on the first. Config loading happens before the `ERR` trap is installed, so a
misconfiguration exits cleanly without triggering rollback.

**Optional values are appended conditionally.** `DOCKER_ENV_ARGS` is assembled incrementally;
`PLAYER_OWNER_SALT` and `OPENAI_API_KEY` are only passed when non-empty, preserving the app's own
fallback behaviour.

**Hook over CI for secret scanning.** A pre-push CI check would only fire after the commit is
already on a public GitHub. The pre-commit hook stops it locally, and GitHub push protection
(enabled separately in repo settings) covers the bypass case for recognised provider key formats.

## Two defects found and fixed along the way

1. **`.env.local` was baked into the production image.** It is not in `.dockerignore`, so `COPY . .`
   pulled it into the build context and Vite inlined every `VITE_*` value into the server bundle.
   Verified empirically: the production Mailgun key appears in
   `build/server/chunks/hooks.server-*.js` and its sourcemap. `.env` / `.env.*` are now excluded.

2. **`deploy.sh` passed the wrong Mailgun variable name.** It set `MAILGUN_SENDING_KEY`, but
   `src/hooks.server.js:39` reads `process.env.MAILGUN_API_KEY`. Production email worked only via
   the baked-in `VITE_MAILGUN_SENDING_KEY` fallback from defect 1 — so fixing `.dockerignore`
   without this would have broken email. The two fixes are a pair.

## Files modified

- `deploy.sh` — now tracked. Config block replaced with `deploy.env` sourcing + `require_var`;
  `docker run` env flags assembled into `DOCKER_ENV_ARGS`. Rollback state machine unchanged.
- `deploy.env` — **new, gitignored, `chmod 600`.** Holds the real values.
- `deploy.env.example` — new, tracked. Documented placeholder template.
- `copy-live-data.sh`, `copy-live-logs.sh` — now tracked; source the same `deploy.env`.
  `DEFAULT_LEAGUE` replaces the hardcoded `pirates`.
- `.gitignore` — dropped `/deploy.sh` and `/copy-live-*.sh`; added `/deploy.env`. Note `deploy.env`
  does not match the existing `.env.*` pattern, so an explicit rule was required.
- `.dockerignore` — excludes `.env`/`.env.*` plus the deploy artefacts.
- `.githooks/pre-commit` — new secret scanner.
- `README.md` — "Scripted Deployment" section and the `core.hooksPath` setup step.

## Testing approach

Verified without triggering a real deployment, using the `DEPLOY_ENV_FILE` override:

- Missing config file and partial config both exit 1 before any git, Docker or network action,
  listing all 11 missing keys at once.
- `DOCKER_ENV_ARGS` assembled from the real `deploy.env` and inspected with values masked: all
  required vars present, `PLAYER_OWNER_SALT` correctly omitted when empty, port mapping unchanged
  at `3001:3000`.
- Hook true-positive: a staged file with all three live secret shapes was blocked, including the
  bare-UUID `SESSION_SECRET` that GitHub's scanner would not recognise.
- Hook false-positive audit across all 328 tracked files: clean. An initial version flagged
  `STORAGE_KEY = 'leagr:matchTimer'` and `const SECRET = 'test-secret-key'`, so the rule was
  narrowed to explicit credential key names and now requires a digit in the value.
- `npm test`: 887 backend passed / 2 skipped, 133 frontend passed. `npx eslint .` clean.

## Assumptions and limitations

- The refactor is intended to be behaviour-neutral **except** for the deliberate `MAILGUN_API_KEY`
  rename. A live `./deploy.sh --no-version` run is still the definitive confirmation and has not
  been performed.
- Secrets are still passed as `docker run -e` arguments over SSH, so they appear in the remote
  process list and in `docker inspect`. Pre-existing; `--env-file` on the remote would be the fix.
- `PLAYER_OWNER_SALT` remains unset in production, so player-ownership HMACs use `APP_URL` as salt
  (`src/lib/server/playerAccessControl.js:11-16`). Low severity — `deriveOwnerId()` hashes the
  client's secret UUID, and anyone holding that UUID can already impersonate via `X-CLIENT-ID`.
  Setting a real salt invalidates every stored `ownerId`, so it needs its own change timed against
  a fresh session week.
- The hook only scans added lines in staged changes; it is a safety net, not an audit of history.

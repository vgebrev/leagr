# Leagr

A little [SvelteKit 5](https://svelte.dev/) web app to help organise social 5-a-side [football] leagues.

Features include:

- **League Management**
    - Subdomain-based league registration.
    - Access-controlled league isolation.
    - [Mailgun](https://www.mailgun.com/) integration for sending email (Access code recovery).
- **Player Management**
    - View and manage player availability.
    - Waiting list after a limit is reached.
    - Moving players between lists.
    - Player renaming capability.
    - Quick-access player information modals.
- **Team Management**
    - Generate random teams, either completely random or using player ELO as seeds.
    - AI-generated team logos using OpenAI's Images API (Requires an OpenAI API Key, disabled by default).
    - Provisional rating system ensures balanced teams even with new players.
    - Multi-iteration team generation algorithm that maximises team variance and balance using attack/defense and individual trait ratings (finishing, playmaking, defending, shot-stopping).
    - Visual indicators for provisional vs. established players.
    - Team attack/defense rating displays.
    - Animated draw replay with team logo reveal, player fly-in effects, and roster table slide-in.
    - Players can be moved from a team to the waiting list (and vice versa), removed, renamed, or marked as a no-show.
    - Quick-access team information modals.
- **Discipline**
    - Automatic suspension of players after no-shows.
- **Game Scheduling and Score Tracking**
    - Generate a round-robin home-away match schedule and track results.
    - Match Centre page for live stats tracking (goals, attack/defence contributions, and saves).
    - Match Centre game timer with a configurable game length, pause/resume, and a referee's whistle.
    - Individual goal-scorer tracking with interactive popover UI (league + knockout matches).
    - Standings table based on match results.
    - Knockout tournament generation with teams seeded by standings.
    - Stars of the Day awards players with the most contributions across a session's league and knockout cup phases.
- **Player Rankings**
    - Cumulative player rankings based on team performances and consistency.
    - Player ELO with provisional ratings system for new players (<5 sessions).
    - Attack/defense ratings displayed on player profiles and teams.
    - Individual attack/defence ratings derived from team goals for/against across sessions.
    - Trait badges on player profiles awarded for individual and combined stat strengths.
    - Performance tracking: league positions, cup progress, win streaks, and achievements.
    - Player profile modals - ranking details, history, profile photos (Admin-approved), and performance stats accessible throughout the app.
    - Champions hall: tracks league and cup winners (yearly and all-time views).
    - Ballers Board: leaderboard ranking players across all tracked individual stats (yearly and all-time views).
    - Annually reset rankings to keep competition fresh and motivating.
- **Year Recap**
    - An annual highlight reel of the league
    - Individual Categories
    - Team Categories
    - Fun/Stats Categories
    - Background Music

## Environment Setup

Data is stored as JSON files in the `data` directory. For dev, make sure it exists in the root of the project.

For development (needs [Node.js](https://nodejs.org/en)):

- `npm ci` - Ensures dependencies are installed.
- `npm run dev` - Starts the dev server. The app is available at http://localhost:5173.
- `npm run dev -- --host` - Starts the dev server and allows access from other devices on your network (useful for mobile testing, or if you're using [WSL](https://learn.microsoft.com/en-us/windows/wsl/)).
- `npm test` - Runs all tests (backend + frontend).
- `npm run test:backend` - Runs backend tests only.
- `npm run test:frontend` - Runs frontend tests only.
- `npm run check` - Type checking.
- `npm run lint` - Code linting.
- `npm run format` - Code formatting.

Enable the repo's secret-scanning pre-commit hook once per clone (git does not pick up tracked hooks automatically):

```bash
git config core.hooksPath .githooks
```

It blocks commits containing credential-shaped strings. Bypass a false positive with `git commit --no-verify`.

### Subdomain Setup

Since leagues are registered/accessed on subdomains, it's useful to set up your `hosts` file to test locally:

```bash
# Add to /etc/hosts (Linux/Mac) or C:\Windows\System32\drivers\etc\hosts (Windows)
127.0.0.1 leagr.local
127.0.0.1 league1.leagr.local
127.0.0.1 league2.leagr.local

# If you're using WSL, you need the WSL Network IP
172.21.184.1 leagr.local
172.21.184.1 league1.leagr.local
```

Then you can access the app at `http://leagr.local:5173`, `http://league1.leagr.local:5173`, etc.

### Security Configuration

The application includes rudimentary security features to prevent abuse:

#### CORS Protection

- **ALLOWED_ORIGIN**: Comma-separated list of allowed origins for cross-origin requests
- Only specified origins can access the API endpoints
- Example: `https://your-production-url.com,http://localhost:3000`

#### Session Cookie Authentication

- **SESSION_SECRET**: Used to sign HttpOnly session cookies issued on first page load
- The browser sends the cookie automatically on all same-origin API requests — it is never exposed in client-side code or page source
- Example: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`

#### Access Code Authorisation

- Each league has a unique access code
- To access the league, the access code must be provided in a "code" query parameter, or the user is redirected to a login page
- Access code must be included in an **Authorization** header of API requests
- Access codes can be reset if an organiser/owner email is set up for the league

#### Rate Limiting

- Built-in rate limiting: 60 requests per minute per IP address
- Automatically blocks excessive requests with HTTP 429 status

### Testing

The application includes comprehensive automated testing:

- **800+ tests** covering backend logic and frontend components
- **Backend tests** use Node environment (unit and integration tests)
- **Frontend tests** use jsdom environment (component and store tests)
- **Automated test execution** runs before every deployment
- Tests must pass before deployment succeeds

### Production Deployment

For production (needs [Docker](https://www.docker.com/)):

- Build a docker image with a production build of the app
- Note: Automated tests run during the build process and must pass

```bash
docker build -t leagr:latest
```

- Run the docker container (The app will be available at http://localhost:3000)

```bash
docker run -d \
  --name leagr \
  --restart unless-stopped \
  -p 3000:3000 \
  -v /path/to/data/on/host:/app/data \
  -v /path/to/logs/on/host:/app/logs \
  -e ALLOWED_ORIGIN="https://your-production-url.com,http://localhost:3000" \
  -e SESSION_SECRET="a1b2c3d4-e5f6-7890-abcd-ef1234567890" \
  -e APP_URL="https://your-production-url.com" \
  -e PLAYER_OWNER_SALT="a-long-random-secret" \
  -e MAILGUN_API_KEY="your-mailgun-api-key" \
  -e MAILGUN_DOMAIN="your-mailgun-domain.com" \
  -e BODY_SIZE_LIMIT=6291456 \
  -e LOG_LEVEL="info" \
  -e OPENAI_API_KEY="sk-..." \
  leagr:latest
```

Expose the app to the internet by configuring your web server or reverse proxy (e.g. Nginx, Apache) to forward requests to port 3000.

**Environment Variables:**

- `ALLOWED_ORIGIN`: Comma-separated allowed origins (required for CORS protection)
- `SESSION_SECRET`: Secret used to sign session cookies (required for API authentication)
- `APP_URL`: The base URL of your application (used for generating links in emails)
- `PLAYER_OWNER_SALT`: Secret salt for HMAC-based player-ownership hashing (optional but recommended; falls back to `APP_URL`, then an insecure default)
- `MAILGUN_API_KEY`: Mailgun API key for sending emails
- `MAILGUN_DOMAIN`: Mailgun domain for sending emails
- `BODY_SIZE_LIMIT`: Maximum request body size in bytes (default: 524288 / 512KB). Set to 6291456 (6MB) for avatar uploads
- `LOGS_DIR`: Directory path for application logs (default: /app/logs). Mount as volume for persistent logs
- `LOG_LEVEL`: The level of logging messages to keep in the application log. Possible values: debug, info, warn, or error (default: info)
- `OPENAI_API_KEY`: An active OpenAI API Key for team logo generation

**Notes:**

- Replace `/path/to/data/on/host` with the actual path to the data directory on your host machine
- Replace `/path/to/logs/on/host` with the actual path to the logs directory on your host machine
- Replace `a1b2c3d4-e5f6-7890-abcd-ef1234567890` with a secure, randomly generated secret
- Replace the allowed origins, app URL with your actual domain(s)
- Replace Mailgun credentials with your actual Mailgun account details
- The `BODY_SIZE_LIMIT` is set to 6MB (6291456 bytes) to support avatar uploads up to 5MB

### Scripted Deployment

`deploy.sh` automates the above: it runs the test suite, bumps and tags the version, builds the
image, ships it to a remote Docker host over SSH, and swaps the container over with automatic
rollback if any step fails.

All environment-specific configuration — target host, paths, port, domains and secrets — lives in
`deploy.env`, which is **gitignored**. The script itself contains no values, so it is safe to keep
in version control.

```bash
cp deploy.env.example deploy.env
chmod 600 deploy.env
# edit deploy.env with your own values
```

`REMOTE_HOST` is an alias defined in your `~/.ssh/config`, which keeps the real hostname, user, port
and key path out of the repo entirely:

```
Host my-deploy-alias
  HostName <your-host>
  User <your-user>
  IdentityFile ~/.ssh/<your-key>
```

Then deploy:

```bash
./deploy.sh                  # bump patch version, tag, deploy
./deploy.sh --minor          # bump minor version — marks this deploy as a release
./deploy.sh -v 2.30.0        # deploy a specific version
./deploy.sh --no-version     # deploy without versioning or tagging
```

The script refuses to run if `deploy.env` is missing or incomplete, listing every missing key. It
also requires a clean working tree when versioning, and pushes the version commit and tag to origin
once the deploy has succeeded — a push failure warns rather than rolling the live deploy back.

`copy-live-data.sh [league]` and `copy-live-logs.sh` read the same `deploy.env` to pull production
data and logs down to your dev environment.

**Note:** the deploy scripts target a Windows host running Docker (hence the `C:/` paths and
`cmd.exe`-style remote commands). Adjust `REMOTE_*` paths and the cleanup commands for a Linux host.

Deployment is intentionally operator-initiated and not wired into GitHub Actions — CI runs lint,
tests and a build only, so no CI system holds credentials to the production host.

### Releases

Every deploy tags a version, but only some of those versions are worth announcing. **A minor bump is
a release:**

| Tag                | Meaning                                  |
| ------------------ | ---------------------------------------- |
| `vX.Y.0`           | released — announced as a GitHub Release |
| `vX.Y.Z` (`Z` > 0) | a routine deploy                         |

The editorial call — "enough has accumulated to be worth announcing" — is made at deploy time, by
running `./deploy.sh --minor` instead of a plain `./deploy.sh`. Everything after that is mechanical.
Version numbers therefore mark release boundaries rather than change size: a large feature that is
not being announced still ships as a patch, and patch numbers can run high between releases.

Pushing a `vX.Y.0` tag fires `.github/workflows/release-draft.yml`, which scaffolds the notes and
opens a **draft** GitHub Release. Review the wording and publish it — the prose is the part worth
writing by hand. The workflow triggers on the tag push, so it runs from the tagged commit and needs
no merge to `main` first; it uses the built-in `GITHUB_TOKEN` and no secrets.

Since the release boundary is a tag, the range for the next set of notes is exact:

```bash
git log $(git describe --tags --match 'v*.0' --abbrev=0 HEAD^)..HEAD
```

(`HEAD^`, not `HEAD`: `git describe` returns a ref's own tag, so resolving from the release tag
itself would yield an empty range.)

`./release-notes-draft.sh` does that and scaffolds the notes, grouping commits by
conventional-commit type into the section headings the published notes use. The workflow runs it for
you; run it by hand to preview, or to write notes for a tag that was pushed before the workflow
existed:

```bash
./release-notes-draft.sh                        # draft for the package.json version
./release-notes-draft.sh -v 2.30.0 --to v2.30.0 # explicit version and range end
```

The output is a **draft** — bullets are raw commit subjects and need rewriting into user-facing
prose, and the appended raw log is there to write from, not to publish. `RELEASE-NOTES-v*.md` is
gitignored; the published release is the record.

**Note:** releases before `v2.27.0` predate this convention — minors were bumped for change size,
and 13 of the 26 releases published then were patch versions. The `v*.0` boundary query is accurate
going forward, not for archaeology.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

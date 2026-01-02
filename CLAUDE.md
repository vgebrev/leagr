# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Leagr is a SvelteKit 5 web application for managing Saturday social 5-a-side football sessions. It handles player registration, team generation, match scheduling, and player rankings using a file-based JSON storage system.

The application supports **multiple independent leagues** via subdomain-based routing (e.g., `pirates.leagr.co.za`), each with isolated data storage, settings, and access controls.

## Development Commands

```bash
# Install dependencies
npm ci

# Start development server (http://localhost:5173)
npm run dev

# Build production version
npm run build

# Preview production build
npm run preview

# Type checking
npm run check

# Code linting
npm run lint

# Code formatting
npm run format

# Run all tests (backend + frontend)
npm test

# Run backend tests only
npm run test:backend

# Run frontend tests only
npm run test:frontend
```

## Environment Variables

Required environment variables for production:

```bash
ALLOWED_ORIGIN      # CORS whitelist (supports wildcards, e.g., "*.leagr.co.za")
API_KEY             # API endpoint authentication key
APP_URL             # Base application URL
MAILGUN_API_KEY     # Email service API key
MAILGUN_DOMAIN      # Email service domain
BODY_SIZE_LIMIT     # Max request size (default: 6MB for avatar uploads)
LOGS_DIR            # Log directory path
```

## Architecture

### Technology Stack

- **SvelteKit 5** with Svelte 5 (runes syntax)
- **Tailwind CSS 4.0** + Flowbite Svelte for UI
- **Node.js** with file-based JSON storage
- **TypeScript** via JSDoc annotations

### Key Directories

- `src/routes/` - SvelteKit routes (pages + API endpoints)
- `src/routes/api/` - Server-side API endpoints
- `src/lib/client/` - Client-side utilities and stores
- `src/lib/server/` - Server-side utilities and business logic
- `src/lib/shared/` - Code shared between client and server
- `src/components/` - Reusable UI components
- `data/` - JSON data storage (league-specific subdirectories)
    - `data/{leagueId}/` - Per-league data isolation
    - `data/{leagueId}/YYYY-MM-DD.json` - Daily session files
    - `data/{leagueId}/rankings-YYYY.json` - Yearly rankings
    - `data/{leagueId}/info.json` - League metadata and settings
    - `data/{leagueId}/discipline.json` - Discipline records
    - `data/{leagueId}/avatars.json` - Avatar metadata
    - `data/{leagueId}/avatars/` - Avatar image files
- `test/` - Comprehensive test suite (1,039+ test cases)
- `tasks/` - Implementation documentation for major features

### Multi-League Architecture

Leagr supports multiple independent leagues via subdomain-based routing:

- **Subdomain routing**: Each league has a subdomain (e.g., `pirates.leagr.co.za`)
- **Data isolation**: Each league has its own data directory (`data/{leagueId}/`)
- **League registration**: Root domain (`leagr.co.za`) serves league creation page
- **League metadata**: Stored in `info.json` with:
    - `id`, `name`, `icon`, `accessCode`, `adminCode`, `ownerEmail`
    - League-level default settings
- **Validation**:
    - Subdomain format: 3-63 characters, alphanumeric + hyphens
    - Access code format: `XXXX-XXXX-XXXX`
    - Reserved/disallowed league names (see `reservedLeagueNames.js`, `disallowedLeagueNames.js`)

### Data Architecture

- **File-based JSON storage** with date-specific files (`YYYY-MM-DD.json`)
- **Yearly rankings files** (`rankings-YYYY.json`) for player statistics
- **Mutex-protected operations** using async-mutex for concurrent access safety
- **Structured data format**: players, teams, games, settings per session
- **Settings hierarchy**:
    - League-level defaults in `info.json`
    - Day-level overrides in daily JSON files
    - Settings cache for performance (must invalidate after updates)

### API Structure

All API endpoints require proper authentication (see Security section below):

- `/api/players` - Player registration and management
- `/api/teams` - Team generation (random or seeded)
- `/api/games` - Match scheduling and results
- `/api/rankings` - Player performance rankings (supports year parameter)
- `/api/champions` - League and cup winners (supports year parameter)
- `/api/settings` - Configuration management
- `/api/leagues` - League creation and access code management
- `/api/avatars` - Avatar upload and approval (admin only)
- `/api/discipline` - No-show tracking and suspensions (admin only)

### Security & Authentication

Multi-layer authentication system:

1. **CORS Origin Validation**
    - Validates `Origin` header against `ALLOWED_ORIGIN` env var
    - Supports wildcard patterns (e.g., `*.leagr.co.za`)

2. **API Key Authentication**
    - Requires `X-API-KEY` header matching `API_KEY` env var
    - Applied to all API endpoints

3. **Client ID Tracking**
    - Auto-generated UUID stored in localStorage
    - Used for player ownership and rate limiting
    - Sent via `X-CLIENT-ID` header

4. **League Access Code**
    - Required for league-specific operations
    - Sent via `Authorization` header
    - Format: `XXXX-XXXX-XXXX`

5. **Admin Code (Optional)**
    - Required for admin operations (avatars, discipline, settings)
    - Sent via `X-ADMIN-CODE` header
    - Configured per league in `info.json`

**Player Ownership**: Players are tied to client IDs via HMAC-SHA256 hashing, preventing unauthorized modifications.

**Rate Limiting**: Rule-based limiting per IP + clientId:

- POST `/api/players`: 1 request per hour
- General API: 60 requests per minute

**Input Validation**: All inputs validated with XSS protection via `$lib/shared/validation.js`

### Key Server Modules

Core business logic modules in `src/lib/server/`:

- **`data.js`**: Core data access layer
    - `get(key, date, leagueId)` - Read from JSON files
    - `set(key, date, value, defaultValue, overwrite, leagueId)` - Write to JSON files
    - `setMany(operations, date, leagueId)` - **Atomic multi-key updates** (race-free)
    - `remove(key, date, value, leagueId)` - Delete from JSON files
    - All operations are mutex-protected per file

- **`playerManager.js`**: Player operations
    - Factory function: `createPlayerManager()`
    - Immutable PlayerState management
    - Player movement between available/waiting lists
    - Team assignment management
    - ELO data enrichment for balancing
    - Access control integration

- **`teamGenerator.js`**: Team balancing algorithm
    - Pot-based seeding using ELO ratings
    - Provisional rating calculations for new players (<5 sessions)
    - Variance-conscious distribution (maximizes balance)
    - Teammate history tracking (last 12 sessions for variety)
    - Multi-iteration algorithm with best-fit selection
    - Draw history recording for replay functionality

- **`rankings.js`**: ELO and ranking calculations
    - Hybrid confidence interval algorithm
    - Separate factors: League (K=24), Cup (K=15)
    - ELO decay (2% per week for inactivity)
    - Attack/defense ratings derived from team performances
    - Yearly ranking files with annual reset
    - Championship tracking (league and cup winners)

- **`league.js`**: Multi-league management
    - League creation and validation
    - Access code reset with email notifications
    - Subdomain extraction from host header
    - Reserved/disallowed name checks

- **`discipline.js`**: No-show tracking system
    - Automatic suspension management
    - Fuzzy name matching for record consolidation
    - Configurable thresholds per league

### State Management

- **Svelte stores** in `src/lib/client/stores/`
- **API client service** in `src/lib/client/services/`
    - Authentication header management
    - Auto-redirect on 403 errors
    - Client ID persistence
- **Server-side data layer** with mutex protection

### Testing Architecture

- **Vitest** for unit and integration testing (1,039+ test cases across 25+ files)
- **Separate configs** for backend and frontend tests
- **Test structure** mirrors `src/` directory in `test/`
- **Backend tests** use Node environment (`test/**/*.{test,spec}.{js,ts}`)
- **Frontend tests** use jsdom environment (`test/**/*.svelte.{test,spec}.{js,ts}`)
- **Path aliases** (`$lib`) available in test files
- **Automated testing** integrated into deployment pipeline

## Core Features

### Player Management

- Player registration with availability/waiting list system
- Player limits per session (configurable, default: 24)
- Player renaming capability
- Player ownership tracking (HMAC-SHA256 with client ID)
- **Avatar system**: 5MB max, 512x512 webp output, admin approval queue
- **Discipline system**: Automatic suspensions for no-shows with fuzzy name matching

### Team Generation

- Random or seeded (ELO-based) team generation
- **Provisional ratings** for new players (<5 sessions)
- Multi-iteration algorithm maximizing team variance and balance
- **Teammate history tracking** (last 12 sessions) to maximize variety
- Attack/defense ratings per player
- **Draw replay functionality** with confetti effects
- Team colors: blue, white, orange, green, black

### Competition Management

- Round-robin match scheduling (home/away)
- League standings calculation (points, goal difference)
- Knockout tournament generation (seeded by standings)
- Score tracking for both league and cup matches
- Registration windows with configurable day/time settings

### Rankings & Performance

- **Hybrid ELO rating** with confidence intervals
- Separate league (K=24) and cup (K=15) factors
- **ELO decay** (2% per week) for inactive players
- **Yearly rankings** with annual reset (stored as `rankings-{year}.json`)
- Performance tracking: positions, cup progress, win streaks
- **Champions hall**: League and cup winners per year
- **Year recap feature**: Comprehensive annual statistics

## Development Notes

### Important Patterns & Conventions

**Server Module Usage:**

1. **Use factory functions** for server managers (e.g., `createPlayerManager()`)
2. **Set league context** before operations: `.setLeague(leagueId)`
3. **Use `setMany()` for atomic operations** when updating multiple keys to prevent race conditions
4. **Invalidate settings cache** after saving settings

Example:

```javascript
import { createPlayerManager } from '$lib/server/playerManager.js';

const manager = createPlayerManager();
manager.setLeague('pirates');
await manager.addPlayer('John Doe', date);
```

**Custom Error Handling:**

- Custom error classes preserve HTTP status codes
- Use `validation.js` helpers for input validation
- Always handle errors with appropriate status codes (400, 403, 404, etc.)

**Code Organization:**

- Service classes with fluent interfaces (method chaining)
- Immutable state management (e.g., PlayerState uses `structuredClone`)
- Shared validation logic in `$lib/shared/validation.js`

**Naming Conventions:**

- Server managers: `{Feature}Manager` (e.g., `PlayerManager`, `RankingsManager`)
- API routes: `/api/{resource}/+server.js`
- Server utilities: `/lib/server/{feature}.js`
- Client services: `/lib/client/services/{feature}.svelte.js`
- **Always use Svelte 5 runes syntax**: `$state`, `$derived`, `$effect`

### Data Flow

1. **Request Flow**: Client → SvelteKit hooks → API routes → Server managers → data.js → JSON files
2. **Authentication**: Multi-layer validation in `hooks.server.js` (CORS, API key, access codes)
3. **League Context**: Extracted from subdomain, passed to all server operations
4. **Mutex Protection**: All file operations are mutex-protected per file for thread safety
5. **Date-based Routing**: Session data organized by `YYYY-MM-DD` format
6. **Settings Hierarchy**: League defaults + day-level overrides with caching
7. **Rankings**: Calculated using hybrid ELO with yearly files

### Testing Best Practices

- **Test coverage**: 1,039+ test cases across backend and frontend
- **Unit tests**: PlayerManager, data layer, rankings, team generator, API endpoints
- **Integration tests**: Player-team relationships, multi-operation workflows
- **Race condition tests**: Verify atomic operations with concurrent access
- **Path aliases**: Use `$lib` imports in test files (configured in vitest configs)
- **Data isolation**: Use `structuredClone` for test data to prevent mutation
- **Mock external dependencies**: Email service, file system (when needed)
- **Test both happy path and error cases** for comprehensive coverage
- **Automated testing**: Runs before every deployment (CI/CD enforced)

### Docker Deployment

- **Multi-stage build** using Node.js 24 Alpine for minimal image size
- **Automated deployment** via `deploy.sh` script:
    - Runs full test suite before deployment
    - Creates backup of running container
    - Atomic deployment with automatic rollback on failure
    - Version tagging and git integration
    - Container backup and restoration
- **GitHub Actions CI/CD**:
    - Linting, backend tests, frontend tests, build verification
    - Runs on push/PR to `main` and `develop` branches
    - Tests must pass before merge
- **Production config**: Exposes port 3000, uses production adapter

## Standard Workflow

1. **Plan**: Think through the problem, read the codebase for relevant files, and create a plan using the TodoWrite tool.
2. **Review Plan**: Check in with the user to verify the plan before proceeding.
3. **Track Progress**: Use the TodoWrite tool during implementation to track todo items, marking them as complete as you go.
4. **Write tests first** - Create unit tests for new functionality before implementation
5. **Explain Changes**: Every step of the way, give high-level explanations of what changes you made
6. **Keep it Simple**: Make every task and code change as simple as possible. Avoid massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. **Run tests frequently** - Use `npm test` to verify changes don't break existing functionality
8. **Type checking**: Only run `npm run check` when explicitly requested or when type errors are blocking functionality. Focus on working code over perfect types. Add JSDoc type annotations pragmatically when they improve code clarity, not exhaustively.
9. **Document**: After completing a non-trivial feature or significant change, create a summary document in `tasks/[feature-name]-implementation.md` with:
    - Overview of what was implemented
    - Architecture decisions made
    - Files modified (with brief descriptions)
    - Testing approach
    - Any assumptions or limitations
10. Before marking any task complete, briefly verify the change works as intended **and tests pass**.
11. If a task becomes more complex than initially planned, pause and discuss alternatives.

**Important Notes:**

- **Always use Svelte 5 runes syntax** when editing .svelte components and svelte.js files (`$state`, `$derived`, `$effect`)
- **Use factory functions** for server managers and call `.setLeague(leagueId)` before operations
- **Use `setMany()` for atomic multi-key updates** to prevent race conditions
- **Validate all inputs** using `$lib/shared/validation.js` helpers
- **Remember authentication headers**: `X-API-KEY`, `Authorization` (access code), `X-ADMIN-CODE` (for admin ops)
- **Invalidate settings cache** after modifying league or day-level settings
- **Use TodoWrite tool** for in-session progress tracking
- **Create persistent summary docs** in `tasks/` folder for completed features
- **Consider multi-league context**: Most operations require a league ID parameter

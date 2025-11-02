# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Leagr is a SvelteKit 5 web application for managing Saturday social 5-a-side football sessions. It handles player registration, team generation, match scheduling, and player rankings using a file-based JSON storage system.

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
- `src/lib/server/` - Server-side utilities
- `src/components/` - Reusable UI components
- `data/` - JSON data storage (YYYY-MM-DD.json files)

### Data Architecture

- **File-based JSON storage** with date-specific files (`YYYY-MM-DD.json`)
- **Yearly rankings files** (`rankings-YYYY.json`) for player statistics
- **Mutex-protected operations** using async-mutex for concurrent access safety
- **Structured data format**: players, teams, games, settings per session

### API Structure

- `/api/players` - Player registration and management
- `/api/teams` - Team generation (random or seeded)
- `/api/games` - Match scheduling and results
- `/api/rankings` - Player performance rankings (supports year parameter)
- `/api/champions` - League and cup winners (supports year parameter)
- `/api/settings` - Configuration management

### State Management

- **Svelte stores** in `src/lib/client/stores/`
- **API client service** in `src/lib/client/services/`
- **Server-side data layer** with mutex protection

### Testing Architecture

- **Vitest** for unit and integration testing
- **Separate configs** for backend and frontend tests
- **Test structure** mirrors `src/` directory in `test/`
- **Backend tests** use Node environment (`test/**/*.{test,spec}.{js,ts}`)
- **Frontend tests** use jsdom environment (`test/**/*.svelte.{test,spec}.{js,ts}`)
- **Path aliases** (`$lib`) available in test files
- **Automated testing** integrated into deployment pipeline

## Development Notes

### Data Flow

1. Client → API routes → Server utilities → JSON files
2. All file operations are mutex-protected for thread safety
3. Date-based routing for session management
4. Rankings calculated using confidence intervals and support yearly filtering

### Testing

- **Vitest** with comprehensive test suite for backend logic
- **Unit tests** for PlayerManager, data layer, and API endpoints
- **Integration tests** for player-team relationship consistency
- **Race condition tests** to verify atomic operations
- **Path aliases** for clean imports in tests
- **Automated testing** runs before every deployment

### Docker Deployment

- Multi-stage build using Node.js 24 Alpine
- Production deployment via `deploy.sh` script with automated testing
- Tests run automatically before every deployment
- Atomic deployment with rollback on failure
- Exposes port 3000 in production

## Standard Workflow

1. **Plan**: Think through the problem, read the codebase for relevant files, and create a plan using the TodoWrite tool.
2. **Review Plan**: Check in with the user to verify the plan before proceeding.
3. **Track Progress**: Use the TodoWrite tool during implementation to track todo items, marking them as complete as you go.
4. **Write tests first** - Create unit tests for new functionality before implementation
5. **Explain Changes**: Every step of the way, give high-level explanations of what changes you made
6. **Keep it Simple**: Make every task and code change as simple as possible. Avoid massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. **Run tests frequently** - Use `npm test` to verify changes don't break existing functionality
8. **Document**: After completing a non-trivial feature or significant change, create a summary document in `tasks/[feature-name]-implementation.md` with:
    - Overview of what was implemented
    - Architecture decisions made
    - Files modified (with brief descriptions)
    - Testing approach
    - Any assumptions or limitations
9. Before marking any task complete, briefly verify the change works as intended **and tests pass**.
10. If a task becomes more complex than initially planned, pause and discuss alternatives.

**Important Notes:**

- Always use Svelte 5 runes syntax when editing .svelte components and svelte.js files
- Use TodoWrite tool for in-session progress tracking
- Create persistent summary docs in `tasks/` folder for completed features

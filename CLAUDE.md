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
- **Central rankings file** (`rankings.json`) for player statistics
- **Mutex-protected operations** using async-mutex for concurrent access safety
- **Structured data format**: players, teams, games, settings per session

### API Structure

- `/api/players` - Player registration and management
- `/api/teams` - Team generation (random or seeded)
- `/api/games` - Match scheduling and results
- `/api/rankings` - Player performance rankings
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
4. Rankings calculated using confidence intervals

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

1. First, think through the problem, read the codebase for relevant files, and write a plan to tasks/todo.md.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. **Write tests first** - Create unit tests for new functionality before implementation
6. Please every step of the way give me a high-level explanation of what changes you made
7. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
8. **Run tests frequently** - Use `npm test` to verify changes don't break existing functionality
9. Finally, add a review section to the todo.md file with a summary of the changes you made and any other relevant information.
10. Before marking any task complete, briefly verify the change works as intended **and tests pass**.
11. If a task becomes more complex than initially planned, pause and discuss alternatives.
12. Document any assumptions made during implementation in the review section.
- Always use Svelte 5 runes syntax when editing .svelte components and svelte.js files
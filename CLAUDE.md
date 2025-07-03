# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Pirates Footy Roster is a SvelteKit 5 web application for managing Saturday social 5-a-side football sessions. It handles player registration, team generation, match scheduling, and player rankings using a file-based JSON storage system.

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

## Development Notes

### Data Flow

1. Client → API routes → Server utilities → JSON files
2. All file operations are mutex-protected for thread safety
3. Date-based routing for session management
4. Rankings calculated using confidence intervals

### Testing

No formal testing framework configured. Relies on TypeScript checking, ESLint, and manual testing.

### Docker Deployment

- Multi-stage build using Node.js 24 Alpine
- Production deployment via `deploy.ps1` script
- Exposes port 3000 in production

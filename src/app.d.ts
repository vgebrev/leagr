// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
    namespace App {
        /** Shape returned by `handleError` in hooks.server.js and rendered by +error.svelte. */
        interface Error {
            message: string;
            errorId?: string;
        }
        interface Locals {
            leagueId: string | null;
            leagueInfo: LeagueInfo | null;
            isAdmin?: boolean;
            adminUnlockDate?: string | null;
            clientId?: string | null;
        }
        // interface PageData {}
        interface PageState {
            teamModal?: { teamName: string; date?: string };
            playerModal?: { playerName: string; date?: string };
            formTab?: boolean;
            fantasyEntry?: { teamName: string };
        }
        // interface Platform {}
    }
}

export {};

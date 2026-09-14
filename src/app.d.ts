// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
    type LeagueInfo = import('./lib/shared/types.js').LeagueInfo;

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
            teamModal?: { teamName: string };
            playerModal?: { playerName: string };
            formTab?: boolean;
        }
        // interface Platform {}
    }
}

export {};

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
declare global {
    type LeagueInfo = import('./lib/shared/types.js').LeagueInfo;

    namespace App {
        // interface Error {}
        interface Locals {
            leagueId: string | null;
            leagueInfo: LeagueInfo | null;
            isAdmin?: boolean;
            clientId?: string | null;
        }
        // interface PageData {}
        // interface PageState {}
        // interface Platform {}
    }
}

export {};

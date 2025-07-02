import { writable } from 'svelte/store';

export const defaultSettings = {
    playerLimit: 24,
    canRegenerateTeams: false,
    canResetSchedule: false,
    seedTeams: true
};

export const settings = writable(defaultSettings);

import { writable } from 'svelte/store';

export const settings = writable({
	playerLimit: 24,
	canRegenerateTeams: false,
	canResetSchedule: false
});

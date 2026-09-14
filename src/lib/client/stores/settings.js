import { writable } from 'svelte/store';
import { defaultSettings } from '$lib/shared/defaults.js';

export { defaultSettings };
/**
 * League settings for the session in view, including the day-override block the API
 * nests under the session date.
 * @type {import('svelte/store').Writable<ConsolidatedSettings>}
 */
export const settings = writable(defaultSettings);

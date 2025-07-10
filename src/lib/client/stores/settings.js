import { writable } from 'svelte/store';
import { defaultSettings } from '$lib/shared/defaults.js';

export { defaultSettings };
export const settings = writable(defaultSettings);

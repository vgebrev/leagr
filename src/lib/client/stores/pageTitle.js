import { writable } from 'svelte/store';

/** Page title segments, joined by the layout. Empty on routes that set no title. */
/** @type {import('svelte/store').Writable<string[]>} */
export const titleParts = writable([]);

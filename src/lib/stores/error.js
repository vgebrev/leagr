import { writable } from 'svelte/store';

export const error = writable('');

export function setError(message) {
	error.set(message);
	setTimeout(() => error.set(''), 5000);
}

import { writable } from 'svelte/store';

export const notification = writable(null);

export function setNotification(message, type = 'error') {
    notification.set({ message, type });
    setTimeout(() => notification.set(null), 5000);
}

import { writable } from 'svelte/store';

/**
 * Notification store to manage notifications in the application.
 *
 * @typedef {Object} Notification
 * @property {string} message - The notification message.
 * @property {'error' | 'success' | 'info'} type - The type of notification.
 */
/** @type {import('svelte/store').Writable<Notification|null>} */
export const notification = writable(null);

/**
 * Set a notification message with a specified type.
 * The notification will automatically clear after 5 seconds.
 * @param message
 * @param type
 */
export function setNotification(message, type = 'error') {
    notification.set({ message, type });
    setTimeout(() => notification.set(null), 5000);
}

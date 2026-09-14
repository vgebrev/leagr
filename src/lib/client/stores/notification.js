import { writable } from 'svelte/store';

/**
 * @typedef {'error' | 'success' | 'warning' | 'info'} NotificationType
 */

/**
 * Notification store to manage notifications in the application.
 *
 * @typedef {Object} Notification
 * @property {string} message - The notification message.
 * @property {NotificationType} type - The type of notification.
 */
/** @type {import('svelte/store').Writable<Notification|null>} */
export const notification = writable(null);

/**
 * Set a notification message with a specified type.
 * The notification will automatically clear after 5 seconds.
 * @param {string} message
 * @param {NotificationType} [type]
 */
export function setNotification(message, type = 'error') {
    notification.set({ message, type });
    setTimeout(() => notification.set(null), 5000);
}

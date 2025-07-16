import { derived, writable } from 'svelte/store';
import { setNotification } from '$lib/client/stores/notification.js';

export const loadingCount = writable(0);
export const isLoading = derived(loadingCount, ($loadingCount) => $loadingCount > 0);

export function pushLoading() {
    loadingCount.update((count) => count + 1);
}

export function popLoading() {
    loadingCount.update((count) => {
        return Math.max(count - 1, 0);
    });
}

/**
 * Executes a function with loading state management
 * @param {() => Promise<any>} fn - The async function to execute
 * @param {(error: Error) => void} [err] - Optional error handler function
 * @returns {Promise<any>} The result of the function execution
 */
export async function withLoading(fn, err) {
    pushLoading();
    try {
        return await fn();
    } catch (ex) {
        if (err) {
            err(ex);
        } else {
            console.error('Error in withLoading:', ex);
            setNotification(err.message || 'Something went wrong, please try again.', 'error');
        }
    } finally {
        popLoading();
    }
}

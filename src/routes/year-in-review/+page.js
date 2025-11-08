import { redirect } from '@sveltejs/kit';
import { MAX_YEAR } from '$lib/shared/yearConfig.js';

/**
 * Redirect from /year-in-review to /year-in-review/[current-year]
 */
export function load() {
    throw redirect(302, `/year-in-review/${MAX_YEAR}`);
}

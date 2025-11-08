import { redirect } from '@sveltejs/kit';
import { MAX_YEAR } from '$lib/shared/yearConfig.js';

/**
 * Redirect from /year-recap to /year-recap/[current-year]
 */
export function load() {
    throw redirect(302, `/year-recap/${MAX_YEAR}`);
}

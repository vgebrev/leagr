import { dateString } from '$lib/helpers.js';

export const load = async ({ url, fetch }) => {
    const date = url.searchParams.get('date') || dateString(new Date());
    const res = await fetch(`/api/settings?date=${date}`);
    const settings = await res.json();
    return {
        date,
        settings
    };
};

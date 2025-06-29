import { dateString } from '$lib/shared/helpers.js';

export const load = async ({ url, fetch, data }) => {
    const date = url.searchParams.get('date') || dateString(new Date());
    const res = await fetch(`/api/settings?date=${date}`, {
        headers: { 'x-api-key': data.apiKey, referer: url.origin }
    });
    const settings = await res.json();
    return {
        date,
        settings,
        apiKey: data.apiKey
    };
};

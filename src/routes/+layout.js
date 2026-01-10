import { goto } from '$app/navigation';
import { resolve } from '$app/paths';
import { browser } from '$app/environment';
import {
    extractAccessCodeFromQuery,
    storeAccessCode,
    validateAccessCode,
    removeStoredAccessCode
} from '$lib/client/services/auth.js';
import { setFetch } from '$lib/client/services/api-client.svelte.js';

export const load = async ({ data, url, fetch }) => {
    // Set SvelteKit's fetch for API client to avoid warnings
    setFetch(fetch);
    // Handle code-based authentication BEFORE anything else (client-side only)
    if (browser && data.leagueInfo && url.pathname !== '/auth/reset') {
        const codeFromQuery = extractAccessCodeFromQuery(url.searchParams);

        if (codeFromQuery) {
            // Validate the code with server
            const isValid = await validateAccessCode(codeFromQuery);

            if (isValid) {
                // Store the validated code
                storeAccessCode(data.leagueId, codeFromQuery);

                // Redirect to clean URL without code parameter
                const newUrl = new URL(url);
                newUrl.searchParams.delete('code');
                goto(resolve(newUrl.pathname + newUrl.search), { replaceState: true });
            } else {
                // Invalid code - remove any stored code and redirect to auth
                removeStoredAccessCode(data.leagueId);

                // Preserve other query params
                const newUrl = new URL(url);
                newUrl.searchParams.delete('code');
                const queryString = newUrl.searchParams.toString();
                const fullUrl = url.pathname + (queryString ? `?${queryString}` : '');
                const redirectUrl = encodeURIComponent(fullUrl);

                goto(resolve(`/auth?redirect=${redirectUrl}`), { replaceState: true });
            }
        }
    }

    return {
        date: data.date,
        settings: data.settings,
        apiKey: data.apiKey,
        appUrl: data.appUrl,
        leagueId: data.leagueId,
        leagueInfo: data.leagueInfo
    };
};

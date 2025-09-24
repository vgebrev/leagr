<script>
    import '../app.css';
    import { settings } from '$lib/client/stores/settings.js';
    import { dateString } from '$lib/shared/helpers.js';
    import {
        setApiKey,
        setLeagueId,
        setAdminCode as setAdminHeader
    } from '$lib/client/services/api-client.svelte.js';
    import { page } from '$app/state';
    import { generateFaviconDataUrl } from '$lib/shared/favicon.js';
    import { onMount } from 'svelte';
    import { goto, afterNavigate } from '$app/navigation';
    import { resolve } from '$app/paths';
    import TopNavBar from './components/TopNavBar.svelte';
    import BottomNavBar from './components/BottomNavBar.svelte';
    import DateSelector from './components/DateSelector.svelte';
    import Notification from '$components/Notification.svelte';
    import {
        extractAccessCodeFromQuery,
        storeAccessCode,
        isAuthenticated,
        validateAccessCode,
        removeStoredAccessCode
    } from '$lib/client/services/auth.js';

    let { data, children } = $props();
    setApiKey(data.apiKey);
    setLeagueId(data.leagueId);
    let selectedDate = $derived(new Date(data.date));
    let date = $derived(dateString(selectedDate));

    $settings = data.settings;

    // Construct page title with league name
    let pageTitle = $derived.by(() => {
        const leagueName = data.leagueInfo?.name || 'Social League Organiser';
        return `Leagr - ${leagueName}`;
    });

    // Track system theme changes
    let systemThemeIsDark = $state(false);

    onMount(() => {
        // Initialize admin header from stored code (if any)
        if (typeof window !== 'undefined' && data.leagueId) {
            import('$lib/client/services/auth.js').then((m) => {
                const stored = m.getStoredAdminCode(data.leagueId);
                if (stored) setAdminHeader(stored);
            });
        }
        if (typeof window !== 'undefined' && window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

            // Set initial value
            systemThemeIsDark = mediaQuery.matches;

            // Listen for changes
            const handler = (e) => {
                systemThemeIsDark = e.matches;
            };

            mediaQuery.addEventListener('change', handler);

            // Cleanup
            return () => mediaQuery.removeEventListener('change', handler);
        }
    });

    // Generate dynamic favicon based on league icon and system theme
    let faviconUrl = $derived.by(() => {
        const theme = systemThemeIsDark ? 'dark' : 'light';
        return generateFaviconDataUrl(data.leagueInfo?.icon || 'soccer', theme);
    });

    // Pages that need the date selector
    const datePages = ['/players', '/teams', '/games', '/knockout', '/table', '/settings'];
    let showDateSelector = $derived(datePages.includes(page.url.pathname));

    // Pages that should be accessible without authentication
    const publicPages = ['/', '/auth', '/auth/forgot', '/auth/reset'];
    let isPublicPage = $derived(publicPages.includes(page.url.pathname));

    // Handle authentication after navigation
    afterNavigate(async () => {
        // Only check authentication for league pages (not root domain)
        if (!data.leagueInfo) {
            return;
        }

        // Check for access code in query params (silent auth) - even for public pages
        // Skip this check for reset page as it uses 'code' for reset codes, not access codes
        if (page.url.pathname !== '/auth/reset') {
            const codeFromQuery = extractAccessCodeFromQuery(page.url.searchParams);
            if (codeFromQuery) {
                // Validate the code with server before storing
                const isValid = await validateAccessCode(codeFromQuery);
                if (isValid) {
                    storeAccessCode(data.leagueId, codeFromQuery);

                    // Remove code from URL and reload the page to refresh with authenticated state
                    const newUrl = new URL(page.url);
                    newUrl.searchParams.delete('code');
                    window.location.href = newUrl.toString();
                    return; // Page will reload
                } else {
                    // Invalid code in query params, redirect to auth page
                    removeStoredAccessCode(data.leagueId);
                    // Preserve query params except the invalid 'code' parameter
                    const searchParams = $state(new URLSearchParams(page.url.search));
                    searchParams.delete('code');
                    const queryString = searchParams.toString();
                    const fullUrl = page.url.pathname + (queryString ? `?${queryString}` : '');
                    const redirectUrl = encodeURIComponent(fullUrl);
                    goto(resolve(`/auth?redirect=${redirectUrl}`));
                    return;
                }
            }
        }

        // Skip authentication requirement for public pages
        if (isPublicPage) {
            return;
        }

        // Check if user is authenticated (has stored code)
        const authenticated = isAuthenticated(data.leagueId);
        if (!authenticated) {
            const redirectUrl = encodeURIComponent(page.url.pathname + page.url.search);
            goto(resolve(`/auth?redirect=${redirectUrl}`));
        }
    });
</script>

<svelte:head>
    <title>{pageTitle}</title>
    <meta
        name="description"
        content="Join {data.leagueInfo?.name ||
            'social leagues'} on Leagr. Easy player registration, team generation, and match scheduling." />

    <!-- Open Graph / Facebook -->
    <meta
        property="og:type"
        content="website" />
    <meta
        property="og:title"
        content={pageTitle} />
    <meta
        property="og:description"
        content="Join {data.leagueInfo?.name ||
            'social leagues'} on Leagr. Easy player registration, team generation, and match scheduling." />

    <!-- Twitter -->
    <meta
        property="twitter:card"
        content="summary" />
    <meta
        property="twitter:title"
        content={pageTitle} />
    <meta
        property="twitter:description"
        content="Join {data.leagueInfo?.name ||
            'social leagues'} on Leagr. Easy player registration, team generation, and match scheduling." />

    <link
        rel="icon"
        href={faviconUrl}
        type="image/svg+xml" />
</svelte:head>
<main class="relative flex h-[100dvh] flex-col overflow-hidden">
    <!-- Background layers (order matters) -->
    <div class="bg-aurora z-0"></div>
    <div class="bg-grain z-0"></div>
    <TopNavBar
        {date}
        leagueInfo={data.leagueInfo} />

    <div class="flex-1 overflow-y-auto pb-[4rem]">
        <div
            class="container mx-auto flex flex-col justify-between gap-2 p-2 md:w-2/3 lg:w-1/2 xl:w-1/3">
            {#if showDateSelector}
                <DateSelector {selectedDate} />
            {/if}
            {@render children()}
        </div>
    </div>

    {#if data.leagueInfo}
        <BottomNavBar {date} />
    {/if}

    <Notification />
</main>

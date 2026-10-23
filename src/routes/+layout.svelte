<script>
    import '../app.css';
    import { settings } from '#lib/client/stores/settings.js';
    import { dateString } from '#lib/shared/helpers.js';
    import { setAdminCode as setAdminHeader } from '#lib/client/services/api-client.svelte.js';
    import { page } from '$app/state';
    import { generateFaviconDataUrl } from '#lib/shared/favicon.js';
    import { onMount } from 'svelte';
    import { goto, afterNavigate } from '$app/navigation';
    import { resolve } from '$app/paths';
    import TopNavBar from './components/TopNavBar.svelte';
    import BottomNavBar from './components/BottomNavBar.svelte';
    import DateSelector from './components/DateSelector.svelte';
    import SessionUnlockBanner from '#components/SessionUnlockBanner.svelte';
    import Notification from '#components/Notification.svelte';
    import { isAuthenticated } from '#lib/client/services/auth.js';
    import { pageMeta } from '#lib/shared/pageMeta.js';

    let { data, children } = $props();
    // The league id is set in +layout.js, not here - see the note there.
    let selectedDate = $derived(new Date(data.date));
    let date = $derived(dateString(selectedDate));

    $effect(() => {
        $settings = data.settings;
    });

    // Title and share text come from the route, so SSR renders them for link previews
    let meta = $derived(
        pageMeta({
            routeId: page.route.id,
            params: page.params,
            leagueName: data.leagueInfo?.name ?? null,
            date: page.url.searchParams.get('date')
        })
    );
    let ogImageUrl = $derived(data.appUrl ? `${data.appUrl}/og-image.png` : '/og-image.png');

    // Track system theme changes
    let systemThemeIsDark = $state(false);

    onMount(() => {
        // Initialize admin header from stored code (if any)
        if (typeof window !== 'undefined' && data.leagueId) {
            import('#lib/client/services/auth.js').then((m) => {
                const stored = m.getStoredAdminCode(data.leagueId);
                if (stored) setAdminHeader(stored);
            });
        }
        if (typeof window !== 'undefined' && window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

            // Set initial value
            systemThemeIsDark = mediaQuery.matches;

            // Listen for changes
            /** @param {MediaQueryListEvent} e */
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
    const datePages = [
        '/players',
        '/teams',
        '/games',
        '/games/match',
        '/knockout',
        '/table',
        '/settings',
        '/fantasy',
        '/fantasy/team'
    ];
    let showDateSelector = $derived(datePages.includes(page.url.pathname));

    // Pages where an admin can unlock a closed session to make post-session fixes
    const unlockablePages = ['/players', '/teams', '/games', '/games/match', '/knockout'];
    let showSessionUnlock = $derived(unlockablePages.includes(page.url.pathname));

    // Pages that should be accessible without authentication
    const publicPages = ['/', '/auth', '/auth/forgot', '/auth/reset'];
    let isPublicPage = $derived(publicPages.includes(page.url.pathname));

    // Guard to prevent re-entrant auth redirects
    let isRedirecting = false;

    // Handle authentication after navigation (for regular page loads without code param)
    afterNavigate(async () => {
        // Only check authentication for league pages (not root domain)
        if (!data.leagueInfo) {
            return;
        }

        // If we've successfully landed on a public page, reset the redirect flag
        if (isPublicPage) {
            isRedirecting = false;
        }

        // Prevent re-entrant execution during redirects (after resetting flag for public pages)
        if (isRedirecting) {
            return;
        }

        // Skip authentication requirement for public pages
        if (isPublicPage) {
            return;
        }

        // Check if user is authenticated (has stored code)
        const authenticated = isAuthenticated(data.leagueId);
        if (!authenticated) {
            const redirectUrl = encodeURIComponent(page.url.pathname + page.url.search);
            isRedirecting = true;
            goto(resolve(`auth?redirect=${redirectUrl}`));
        }
    });
</script>

<svelte:head>
    <title>{meta.title}</title>
    <meta
        name="description"
        content={meta.description} />

    <!-- Open Graph / Facebook -->
    <meta
        property="og:type"
        content="website" />
    <meta
        property="og:site_name"
        content="Leagr" />
    <meta
        property="og:title"
        content={meta.title} />
    <meta
        property="og:description"
        content={meta.description} />
    <meta
        property="og:image"
        content={ogImageUrl} />
    <meta
        property="og:image:width"
        content="1200" />
    <meta
        property="og:image:height"
        content="630" />
    <meta
        property="og:image:alt"
        content="Leagr - Your social 5-a-side league, sorted." />

    <!-- Twitter -->
    <meta
        name="twitter:card"
        content="summary_large_image" />
    <meta
        name="twitter:title"
        content={meta.title} />
    <meta
        name="twitter:description"
        content={meta.description} />
    <meta
        name="twitter:image"
        content={ogImageUrl} />

    <link
        rel="icon"
        href={faviconUrl}
        type="image/svg+xml" />
</svelte:head>
<main class="relative flex h-dvh flex-col overflow-hidden">
    <!-- Background layers (order matters) -->
    <div class="bg-aurora z-0"></div>
    <div class="bg-grain z-0"></div>
    <TopNavBar
        {date}
        leagueInfo={data.leagueInfo} />

    <div class="flex-1 overflow-y-auto pb-16">
        <div class="app-container flex flex-col justify-between gap-2 p-2">
            {#if showDateSelector}
                <DateSelector {selectedDate} />
            {/if}
            {#if showSessionUnlock}
                <SessionUnlockBanner {date} />
            {/if}
            {@render children()}
        </div>
    </div>

    {#if data.leagueInfo}
        <BottomNavBar {date} />
    {/if}

    <Notification />
</main>

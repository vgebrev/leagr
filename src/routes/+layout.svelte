<script>
    import '../app.css';
    import { settings } from '$lib/client/stores/settings.js';
    import { dateString } from '$lib/shared/helpers.js';
    import { setApiKey } from '$lib/client/services/api-client.svelte.js';
    import { page } from '$app/state';
    import { generateFaviconDataUrl } from '$lib/shared/favicon.js';
    import TopNavBar from './components/TopNavBar.svelte';
    import BottomNavBar from './components/BottomNavBar.svelte';
    import DateSelector from './components/DateSelector.svelte';
    import Notification from '../components/Notification.svelte';

    let { data, children } = $props();
    setApiKey(data.apiKey);
    let selectedDate = $derived(new Date(data.date));
    let date = $derived(dateString(selectedDate));

    $settings = data.settings;

    // Construct page title with league name
    let pageTitle = $derived.by(() => {
        const leagueName = data.leagueInfo?.name || 'Social League Organizer';
        return `Leagr - ${leagueName}`;
    });

    // Generate dynamic favicon based on league icon
    let faviconUrl = $derived.by(() => {
        return generateFaviconDataUrl(data.leagueInfo?.icon || 'soccer');
    });

    // Pages that need the date selector
    const datePages = ['/players', '/teams', '/games', '/table', '/settings'];
    let showDateSelector = $derived(datePages.includes(page.url.pathname));
</script>

<svelte:head>
    <title>{pageTitle}</title>
    <link
        rel="icon"
        href={faviconUrl}
        type="image/svg+xml" />
</svelte:head>
<main class="flex h-[100dvh] flex-col overflow-hidden">
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

<script>
    import { AdjustmentsHorizontalSolid, ShareAllOutline } from 'flowbite-svelte-icons';
    import { DarkMode, Navbar, NavBrand, Spinner, Tooltip } from 'flowbite-svelte';
    import { scale } from 'svelte/transition';
    import { isLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { getStoredAccessCode } from '$lib/client/services/auth.js';
    import { copyToClipboard } from '$lib/client/services/clipboard.js';
    import LeagueInfo from '../../components/LeagueInfo.svelte';

    let { date, leagueInfo } = $props();

    async function shareCurrentPage() {
        const url = new URL(window.location.href);

        // Check if user is authenticated (has access code in localStorage)
        if (leagueInfo?.id) {
            const accessCode = getStoredAccessCode(leagueInfo.id);
            if (accessCode) {
                url.searchParams.set('code', accessCode);
            }
        }

        // Copy URL to clipboard
        const success = await copyToClipboard(url.toString());

        if (success) {
            setNotification('Link copied to clipboard!', 'success');
        } else {
            setNotification('Failed to copy link', 'error');
        }
    }
</script>

<Navbar class="z-10 shrink-0">
    <NavBrand href="/?date={date}">
        <LeagueInfo {leagueInfo} />
    </NavBrand>
    <div class="ml-auto flex items-center gap-2">
        {#if $isLoading}<Spinner size="6" />{/if}
        {#if leagueInfo}
            <button
                class="cursor-default rounded-lg p-2.5 whitespace-normal text-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-gray-400 focus:outline-hidden sm:inline-block dark:text-gray-400 dark:hover:bg-gray-700"
                onclick={shareCurrentPage}
                id="share-button"><ShareAllOutline /></button>
            <Tooltip
                triggeredBy="#share-button"
                transition={scale}>Share link</Tooltip>
            <a
                class="cursor-default rounded-lg p-2.5 whitespace-normal text-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-gray-400 focus:outline-hidden sm:inline-block dark:text-gray-400 dark:hover:bg-gray-700"
                href={`/settings?date=${date}`}
                id="settings-link"><AdjustmentsHorizontalSolid /></a>
            <Tooltip
                triggeredBy="#settings-link"
                transition={scale}>Settings</Tooltip>
        {/if}
        <DarkMode
            color="alternative"
            id="theme-picker" />
        <Tooltip
            triggeredBy="#theme-picker"
            transition={scale}>Toggle theme</Tooltip>
    </div>
</Navbar>

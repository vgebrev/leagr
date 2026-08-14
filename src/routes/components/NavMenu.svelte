<script>
    import {
        AdjustmentsHorizontalSolid,
        DotsVerticalOutline,
        MoonOutline,
        NewspaperOutline,
        ShareNodesSolid,
        SunOutline
    } from 'flowbite-svelte-icons';
    import { Dropdown, DropdownItem } from 'flowbite-svelte';
    import { get } from 'svelte/store';
    import { page } from '$app/state';
    import { resolve } from '$app/paths';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { getStoredAccessCode } from '$lib/client/services/auth.js';
    import { shareContent } from '$lib/client/services/clipboard.js';
    import { isDarkMode, toggleTheme } from '$lib/client/stores/theme.js';

    let { date, leagueInfo } = $props();

    let isOpen = $state(false);
    let activeUrl = $derived(`${page.url.pathname}${page.url.search}`);

    // The menu items only exist while the menu is open, so the theme label is snapshotted
    // on open rather than derived live: re-rendering content inside the popover while it is
    // closing leaves Flowbite's popover stuck open.
    let showsDarkMode = $state(false);
    $effect(() => {
        if (isOpen) showsDarkMode = get(isDarkMode);
    });

    // No background on the items: the glass panel supplies it, and an opaque item background
    // would show as a different shade against the group's top/bottom padding.
    const itemClass = 'w-full bg-transparent font-normal';

    async function shareCurrentPage() {
        const url = new URL(window.location.href);

        // Check if the user is authenticated (has access code in localStorage)
        if (leagueInfo?.id) {
            const accessCode = getStoredAccessCode(leagueInfo.id);
            if (accessCode) {
                url.searchParams.set('code', accessCode);
            }
        }

        // Prepare a share data object
        const shareData = {
            title: leagueInfo?.name ? `Leagr - ${leagueInfo.name}` : 'Leagr',
            text: `Join ${leagueInfo?.name || 'our league'} on Leagr`,
            url: url.toString()
        };

        // Share using native API or fallback to clipboard
        const result = await shareContent(shareData);

        if (result.success) {
            if (result.method === 'native') {
                setNotification('Shared successfully!', 'success');
            } else {
                setNotification('Link copied to clipboard!', 'success');
            }
        } else {
            setNotification('Failed to share link', 'error');
        }
    }
</script>

<button
    class="cursor-default rounded-lg p-1 whitespace-normal text-gray-600 hover:bg-gray-100 focus:ring-2 focus:ring-gray-400 focus:outline-hidden dark:text-gray-300 dark:hover:bg-gray-700"
    type="button"
    id="nav-menu-button"
    aria-label="Menu"
    aria-haspopup="menu"
    aria-expanded={isOpen}><DotsVerticalOutline size="lg" /></button>

<!-- triggerDelay is Flowbite's mutual open/close debounce, defaulting to 200ms to keep
     hover-triggered popovers from flickering. This menu opens on mousedown, so most of that
     is just lag; 50ms is still long enough to coalesce the mousedown/focusin pair. -->
<Dropdown
    class="glass-strong border border-gray-200 dark:border-gray-700"
    simple
    role="menu"
    placement="bottom-end"
    triggerDelay={50}
    {activeUrl}
    bind:isOpen>
    {#if leagueInfo}
        <DropdownItem
            class={itemClass}
            onclick={async () => {
                try {
                    await shareCurrentPage();
                } finally {
                    isOpen = false;
                }
            }}>
            <span class="flex items-center">
                <ShareNodesSolid class="me-2 h-4 w-4" />Share link
            </span>
        </DropdownItem>
        <DropdownItem
            class={itemClass}
            href={resolve(`/news?date=${date}`)}
            onclick={() => (isOpen = false)}>
            <span class="flex items-center">
                <NewspaperOutline class="me-2 h-4 w-4" />News
            </span>
        </DropdownItem>
        <DropdownItem
            class={itemClass}
            href={resolve(`/settings?date=${date}`)}
            onclick={() => (isOpen = false)}>
            <span class="flex items-center">
                <AdjustmentsHorizontalSolid class="me-2 h-4 w-4" />Settings
            </span>
        </DropdownItem>
    {/if}
    <DropdownItem
        class={itemClass}
        onclick={() => {
            toggleTheme();
            isOpen = false;
        }}>
        <span class="flex items-center">
            {#if showsDarkMode}
                <SunOutline class="me-2 h-4 w-4" />Light mode
            {:else}
                <MoonOutline class="me-2 h-4 w-4" />Dark mode
            {/if}
        </span>
    </DropdownItem>
</Dropdown>

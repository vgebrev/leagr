<script>
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import PlayerSummaryCard from './components/PlayerSummaryCard.svelte';
    import RankProgressionChart from './components/RankProgressionChart.svelte';
    import AppearanceHistorySection from './components/AppearanceHistorySection.svelte';
    import { Alert, Spinner, Dropdown, DropdownItem, Button } from 'flowbite-svelte';
    import { ChevronDownOutline } from 'flowbite-svelte-icons';
    import { ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { goto } from '$app/navigation';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';

    let player = $derived(page.params.player);
    let playerData = $state(null);
    let celebrating = $state(false);
    let loadingError = $state(false);
    // Get limit from URL query string, default to null (All)
    let selectedLimit = $derived.by(() => {
        const limitParam = page.url.searchParams.get('limit');
        if (!limitParam || limitParam === 'null') return null;
        const parsed = parseInt(limitParam, 10);
        return isNaN(parsed) ? null : parsed;
    });
    let dropdownOpen = $state(false);

    const limitOptions = [
        { value: 5, label: 'last 5' },
        { value: 10, label: 'last 10' },
        { value: 25, label: 'last 25' },
        { value: 50, label: 'last 50' },
        { value: null, label: 'all' }
    ];

    /**
     * Trigger celebration if player is #1
     */
    function checkForCelebration() {
        if (playerData && playerData.rank === 1) {
            celebrating = true;
        }
    }

    /**
     * Load player data with optional limit
     */
    async function loadPlayerData() {
        if (!player) {
            setNotification('Player name is required', 'error');
            return;
        }

        loadingError = false;
        await withLoading(
            async () => {
                const url = selectedLimit
                    ? `rankings/${encodeURIComponent(player)}?limit=${selectedLimit}`
                    : `rankings/${encodeURIComponent(player)}`;
                const response = await api.get(url);
                playerData = response.playerData;
                checkForCelebration();
            },
            (err) => {
                console.error('Error loading player profile:', err);
                loadingError = true;
                setNotification(
                    err.message || 'Failed to load player profile. Please try again.',
                    'error'
                );
            }
        );
    }

    /**
     * Handle limit change by updating URL and reloading data
     */
    async function handleLimitChange(newLimit) {
        dropdownOpen = false; // Close dropdown

        // Update URL with new limit parameter
        const url = new URL(page.url);
        if (newLimit === null) {
            url.searchParams.delete('limit');
        } else {
            url.searchParams.set('limit', newLimit.toString());
        }

        // Update URL and reload data
        await goto(url.toString(), { replaceState: true });
        await loadPlayerData();
    }

    onMount(loadPlayerData);
</script>

<svelte:head>
    <title>{player} - Player Rankings Detail | Leagr</title>
</svelte:head>

<div class="container mx-auto">
    <!-- Header -->
    <div class="mb-2">
        <h1 class="text-xl font-bold">{player || 'Loading...'}</h1>
        <h6 class="text-gray-500">Player Profile</h6>
    </div>

    {#if playerData}
        <PlayerSummaryCard {playerData} />
        <RankProgressionChart {playerData}>
            {#snippet limitDropdown()}
                {#if playerData}
                    <div class="flex items-center gap-1">
                        <span class="text-xs">Show</span>
                        <Button
                            color="light"
                            size="xs"
                            class="flex items-center gap-1">
                            {limitOptions.find((opt) => opt.value === selectedLimit)?.label} appearances
                            <ChevronDownOutline class="h-4 w-4" />
                        </Button>
                        <Dropdown
                            simple
                            class="w-20"
                            bind:isOpen={dropdownOpen}>
                            {#each limitOptions as option, i (i)}
                                <DropdownItem
                                    onclick={() => handleLimitChange(option.value)}
                                    classes={{ anchor: 'w-full' }}
                                    class={selectedLimit === option.value
                                        ? 'text-primary-600 w-full bg-gray-100 dark:bg-gray-600'
                                        : ''}>
                                    <span class="w-full">{option.label}</span>
                                </DropdownItem>
                            {/each}
                        </Dropdown>
                    </div>
                {/if}
            {/snippet}
        </RankProgressionChart>
        <AppearanceHistorySection
            {playerData}
            limit={selectedLimit} />
    {:else if loadingError}
        <Alert class="flex items-center border">
            <ExclamationCircleSolid />
            <span>Failed to load player data. Please check the player name and try again.</span>
        </Alert>
    {:else}
        <div class="flex items-center justify-center gap-2">
            <Spinner size="6" />
            <div class="text-gray-500">Loading player data...</div>
        </div>
    {/if}
</div>

<CelebrationOverlay
    bind:celebrating
    teamName={player}
    teamColour="default"
    icon="🥇"
    confettiColours={['#efb100', '#fff085']} />

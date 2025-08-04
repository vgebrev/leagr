<script>
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import PlayerSummaryCard from './components/PlayerSummaryCard.svelte';
    import RankProgressionChart from './components/RankProgressionChart.svelte';
    import AppearanceHistorySection from './components/AppearanceHistorySection.svelte';
    import { Alert, Spinner } from 'flowbite-svelte';
    import { ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { onMount } from 'svelte';
    import { page } from '$app/state';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';

    let player = $derived(page.params.player);
    let playerData = $state(null);
    let celebrating = $state(false);
    let loadingError = $state(false);

    /**
     * Trigger celebration if player is #1
     */
    function checkForCelebration() {
        if (playerData && playerData.rank === 1) {
            celebrating = true;
        }
    }

    onMount(async () => {
        if (!player) {
            setNotification('Player name is required', 'error');
            return;
        }

        loadingError = false;
        await withLoading(
            async () => {
                const response = await api.get(`rankings/${encodeURIComponent(player)}`);
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
    });
</script>

<svelte:head>
    <title>{player} - Player Rankings Detail | Leagr</title>
</svelte:head>

<div class="container mx-auto">
    <!-- Header -->
    <div class="mb-4">
        <h1 class="text-xl font-bold">{player || 'Loading...'}</h1>
        <h6 class="text-gray-500">Player Profile</h6>
    </div>

    {#if playerData}
        <PlayerSummaryCard {playerData} />
        <RankProgressionChart {playerData} />
        <AppearanceHistorySection {playerData} />
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

<script>
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import PlayerSummaryCard from './components/PlayerSummaryCard.svelte';
    import RankProgressionChart from './components/RankProgressionChart.svelte';
    import AppearanceHistorySection from './components/AppearanceHistorySection.svelte';
    import { onMount } from 'svelte';

    let { data } = $props();
    const { player, playerData } = data;

    let celebrating = $state(false);

    /**
     * Trigger celebration if player is #1
     */
    onMount(() => {
        if (playerData.rank === 1) {
            celebrating = true;
        }
    });
</script>

<svelte:head>
    <title>{player} - Player Rankings Detail | Leagr</title>
</svelte:head>

<div class="container mx-auto">
    <!-- Header -->
    <div class="mb-4">
        <h1 class="text-xl font-bold">{player}</h1>
        <h6 class="text-gray-500">Player Profile</h6>
    </div>
    <PlayerSummaryCard {playerData} />
    <RankProgressionChart {playerData} />
    <AppearanceHistorySection {playerData} />
</div>

<CelebrationOverlay
    bind:celebrating
    teamName={player}
    teamColour="default"
    icon="🥇"
    confettiColours={['#efb100', '#fff085']} />

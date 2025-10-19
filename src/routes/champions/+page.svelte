<script>
    import { onMount } from 'svelte';
    import {
        Alert,
        Spinner,
        Table,
        TableHead,
        TableHeadCell,
        TableBody,
        TableBodyRow,
        TableBodyCell
    } from 'flowbite-svelte';
    import { ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import CrownIcon from '$components/Icons/CrownIcon.svelte';
    import TrophyPopover from '$components/TrophyPopover.svelte';
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';

    let champions = $state([]);
    let loading = $state(true);
    let error = $state(false);
    let celebrating = $state(false);
    let topChampion = $derived(champions.length > 0 ? champions[0].playerName : '');
    /**
     * Load champions data
     */
    async function loadChampions() {
        error = false;
        await withLoading(
            async () => {
                const response = await api.get('champions');
                champions = response.champions || [];
            },
            (err) => {
                console.error('Error loading champions:', err);
                error = true;
                setNotification(err.message || 'Failed to load champions data', 'error');
            }
        );
        loading = false;
    }

    /**
     * Handle click on top champion's name
     */
    function handleTopChampionClick() {
        if (champions.length > 0) {
            celebrating = true;
        }
    }

    onMount(loadChampions);
</script>

<!-- Header -->
<div class="mb-2">
    <h5 class="flex items-center text-lg font-bold">Champions Hall</h5>
    <p class="text-sm text-gray-400">Players who have won at least one league or knockout cup</p>
</div>

{#if loading}
    <div class="flex items-center justify-center gap-2 p-8">
        <Spinner size="6" />
        <div class="text-gray-500">Loading champions data...</div>
    </div>
{:else if error}
    <Alert class="glass flex items-center border">
        <ExclamationCircleSolid />
        <span>Failed to load champions data. Please try again.</span>
    </Alert>
{:else if champions.length === 0}
    <div class="py-8 text-center">
        <TrophyIcon class="mx-auto mb-4 h-16 w-16 text-gray-300" />
        <p class="text-gray-500">No champions yet! Be the first to win a league or cup.</p>
    </div>
{:else}
    <Table
        classes={{ div: 'w-full text-xs' }}
        class="dark:text-gray-300"
        shadow>
        <TableHead class="dark:text-gray-300">
            <TableHeadCell class="px-1 py-1.5 text-center">#</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 font-bold text-gray-900 dark:text-gray-100"
                >Player</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">League Wins</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">Cup Wins</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">Total</TableHeadCell>
        </TableHead>
        <TableBody>
            {#each champions as champion, index (index)}
                <TableBodyRow>
                    <TableBodyCell class="px-1 py-1.5 text-center">{index + 1}</TableBodyCell>
                    <TableBodyCell
                        class="px-1 py-1.5 font-semibold text-gray-900 dark:text-gray-100">
                        {#if index === 0}
                            <button onclick={handleTopChampionClick}>
                                {champion.playerName}
                            </button>
                        {:else}
                            {champion.playerName}
                        {/if}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {#if champion.leagueWins > 0}
                            <button
                                class="mx-auto flex cursor-pointer items-center gap-1 text-yellow-600 hover:text-yellow-700"
                                id="league-{index}">
                                <CrownIcon class="h-4 w-4" />
                                {champion.leagueWins}
                            </button>
                            <TrophyPopover
                                triggerId="league-{index}"
                                playerName={champion.playerName}
                                trophyType="league" />
                        {:else}
                            <span class="text-gray-400 dark:text-gray-300">0</span>
                        {/if}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {#if champion.cupWins > 0}
                            <button
                                class="mx-auto flex cursor-pointer items-center gap-1 text-amber-600 hover:text-amber-700"
                                id="cup-{index}">
                                <TrophyIcon class="h-4 w-4" />
                                {champion.cupWins}
                            </button>
                            <TrophyPopover
                                triggerId="cup-{index}"
                                playerName={champion.playerName}
                                trophyType="cup" />
                        {:else}
                            <span class="text-gray-400 dark:text-gray-300">0</span>
                        {/if}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center font-medium"
                        >{champion.totalChampionships}</TableBodyCell>
                </TableBodyRow>
            {/each}
        </TableBody>
    </Table>
{/if}

<CelebrationOverlay
    bind:celebrating
    teamName={topChampion}
    teamColour="default"
    icon="👑"
    confettiColours={['#fbbf24', '#fde047', '#facc15']} />

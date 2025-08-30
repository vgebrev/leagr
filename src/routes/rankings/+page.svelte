<script>
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { onMount } from 'svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { Button, Toggle, Tooltip } from 'flowbite-svelte';
    import { QuestionCircleOutline } from 'flowbite-svelte-icons';
    import { page } from '$app/state';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import RankingInfoPanel from './components/RankingInfoPanel.svelte';
    import RankingsTable from './components/RankingsTable.svelte';
    import RankingActions from './components/RankingActions.svelte';

    let rankings = $state({ players: {}, rankingMetadata: {} });
    let sortBy = $state('rankingPoints'); // Default to ranking points
    let showActiveOnly = $state(true); // Default to showing active players only

    // Preserve date parameter when navigating to champions
    let championsUrl = $derived.by(() => {
        const dateParam = page.url.searchParams.get('date');
        return dateParam ? `/champions?date=${dateParam}` : '/champions';
    });

    /**
     * Check if a player is active (has appeared within last 2 months and has 2+ appearances)
     * @param {string|null} lastAppearance - Last appearance date (YYYY-MM-DD)
     * @param {number} appearances - Total number of appearances
     * @returns {boolean}
     */
    function isPlayerActive(lastAppearance, appearances) {
        if (!lastAppearance || appearances < 2) return false;

        const today = new Date();
        const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, today.getDate());
        const lastAppearanceDate = new Date(lastAppearance);

        return lastAppearanceDate >= twoMonthsAgo;
    }

    /**
     * Recalculate rank movement for filtered players
     * @param {Array} players - Filtered and sorted players array
     * @returns {Array} - Players with adjusted rank movement
     */
    function adjustRankMovement(players) {
        return players.map(([name, data], index) => {
            const currentRankInView = index + 1;

            // Find player's previous rank in the filtered view
            // For simplicity, we'll keep the original rank movement for now
            // A more sophisticated implementation would track filtered rankings over time

            return [
                name,
                {
                    ...data,
                    adjustedRank: currentRankInView
                }
            ];
        });
    }

    let sortedPlayers = $derived.by(() => {
        const filtered = Object.entries(rankings.players ?? {})
            .filter(([name, data]) => {
                // Apply active player filter if enabled (exclude inactive and provisional players)
                return !showActiveOnly || isPlayerActive(data.lastAppearance, data.appearances);
            })
            .sort((a, b) => {
                if (sortBy === 'rankingPoints') {
                    if (b[1].rankingPoints !== a[1].rankingPoints)
                        return b[1].rankingPoints - a[1].rankingPoints;
                    if (b[1].points !== a[1].points) 
                        return b[1].points - a[1].points;
                    // Tertiary tiebreaker: ELO rating
                    const aElo = a[1].elo?.rating || 0;
                    const bElo = b[1].elo?.rating || 0;
                    return bElo - aElo;
                } else if (sortBy === 'rawAverage') {
                    if (b[1].rawAverage !== a[1].rawAverage)
                        return b[1].rawAverage - a[1].rawAverage;
                    if (b[1].points !== a[1].points) return b[1].points - a[1].points;
                    return b[1].appearances - a[1].appearances;
                } else if (sortBy === 'points') {
                    if (b[1].points !== a[1].points) return b[1].points - a[1].points;
                    return b[1].appearances - a[1].appearances;
                } else if (sortBy === 'appearances') {
                    if (b[1].appearances !== a[1].appearances)
                        return b[1].appearances - a[1].appearances;
                    return b[1].points - a[1].points;
                } else if (sortBy === 'elo') {
                    const aElo = a[1].elo?.rating || 0;
                    const bElo = b[1].elo?.rating || 0;
                    if (bElo !== aElo) return bElo - aElo;
                    return b[1].rankingPoints - a[1].rankingPoints;
                } else {
                    return 0;
                }
            });

        return adjustRankMovement(filtered);
    });

    async function updateRankings() {
        await withLoading(
            async () => {
                rankings = await api.post('rankings');
            },
            (err) => {
                console.error(err);
                setNotification(
                    err.message || 'Unable to update rankings. Please try again.',
                    'error'
                );
            }
        );
    }

    /** Handle sort change event
     * @param {string} newSort */
    function handleSortChange(newSort) {
        sortBy = newSort;
    }

    onMount(async () => {
        await withLoading(
            async () => {
                rankings = await api.get('rankings');
            },
            (err) => {
                console.error(err);
                setNotification(
                    err.message || 'Unable to load rankings. Please try again.',
                    'error'
                );
            }
        );
    });
</script>

<div class="flex flex-col gap-2">
    <RankingInfoPanel rankingMetadata={rankings.rankingMetadata} />
    <Button
        href={championsUrl}
        color="primary"
        size="sm"
        class="flex items-center gap-2">
        <TrophyIcon class="h-4 w-4" />
        Champions Hall
    </Button>
    <div class="flex items-center gap-1">
        <Toggle
            bind:checked={showActiveOnly}
            class="text-sm">
            Regular players only
        </Toggle>
        <QuestionCircleOutline 
            class="h-4 w-4 text-gray-400 hover:text-gray-600 cursor-help" 
            id="regular-players-help" />
        <Tooltip triggeredBy="#regular-players-help" class="text-xs">
            2+ appearances in the last 2 months
        </Tooltip>
    </div>
    <div class="overflow-x-auto">
        <RankingsTable
            {sortedPlayers}
            currentSort={sortBy}
            onSortChange={handleSortChange} />
    </div>
    <RankingActions onUpdate={updateRankings} />
</div>

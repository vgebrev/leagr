<script>
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { onMount } from 'svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { Button } from 'flowbite-svelte';
    import { page } from '$app/state';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import RankingInfoPanel from './components/RankingInfoPanel.svelte';
    import RankingsTable from './components/RankingsTable.svelte';
    import RankingActions from './components/RankingActions.svelte';

    let rankings = $state({ players: {}, rankingMetadata: {} });
    let sortBy = $state('rankingPoints'); // Default to ranking points

    // Preserve date parameter when navigating to champions
    let championsUrl = $derived.by(() => {
        const dateParam = page.url.searchParams.get('date');
        return dateParam ? `/champions?date=${dateParam}` : '/champions';
    });

    let sortedPlayers = $derived(
        Object.entries(rankings.players ?? {}).sort((a, b) => {
            if (sortBy === 'rankingPoints') {
                if (b[1].rankingPoints !== a[1].rankingPoints)
                    return b[1].rankingPoints - a[1].rankingPoints;
                return b[1].points - a[1].points;
            } else if (sortBy === 'rawAverage') {
                if (b[1].rawAverage !== a[1].rawAverage) return b[1].rawAverage - a[1].rawAverage;
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
        })
    );

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
    <div class="overflow-x-auto">
        <RankingsTable
            {sortedPlayers}
            currentSort={sortBy}
            onSortChange={handleSortChange} />
    </div>
    <RankingActions onUpdate={updateRankings} />
</div>

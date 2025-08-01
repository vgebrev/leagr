<script>
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { onMount } from 'svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import RankingInfoPanel from './components/RankingInfoPanel.svelte';
    import RankingsTable from './components/RankingsTable.svelte';
    import RankingActions from './components/RankingActions.svelte';

    let rankings = $state({ players: {}, rankingMetadata: {} });
    let sortBy = $state('rankingPoints'); // Default to ranking points

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
            } else {
                return 0;
            }
        })
    );

    let celebrating = $state(false);
    /** @type {string} */
    let winner = $state('');

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

    /** @param {number} index */
    function celebrate(index) {
        if (index !== 0) return;
        winner = sortedPlayers[index][0];
        celebrating = true;
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
    <RankingsTable
        {sortedPlayers}
        currentSort={sortBy}
        onSortChange={handleSortChange}
        onPlayerClick={celebrate} />
    <RankingActions onUpdate={updateRankings} />
</div>
<CelebrationOverlay
    bind:celebrating
    teamName={winner}
    teamColour="default"
    icon="🥇"
    confettiColours={['#efb100', '#fff085']} />

<script>
    import { Modal, Spinner } from 'flowbite-svelte';
    import PlayerHeader from './PlayerHeader.svelte';
    import PlayerSummaryCard from '../routes/rankings/[player]/components/PlayerSummaryCard.svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { scale } from 'svelte/transition';
    import { SvelteURLSearchParams } from 'svelte/reactivity';

    /**
     * @type {{ playerName: string | null, open: boolean, date?: string | null }}
     */
    let { playerName = $bindable(null), open = $bindable(false), date = null } = $props();

    let playerData = $state(null);
    let playerDisplayData = $derived.by(() => {
        if (!playerData) return null;
        const detail = playerData.detailForDate;
        if (!detail) return playerData;
        return {
            ...playerData,
            rank: detail.rank ?? playerData.rank,
            totalPlayers: detail.totalPlayers ?? playerData.totalPlayers,
            rankingPoints: detail.rankingPoints ?? playerData.rankingPoints,
            points: detail.points ?? playerData.points,
            isSnapshot: true,
            goalsForPerSession: detail.goalsForPerSession ?? playerData.goalsForPerSession,
            goalsAgainstPerSession:
                detail.goalsAgainstPerSession ?? playerData.goalsAgainstPerSession,
            attackingRating: detail.attackingRating ?? playerData.attackingRating,
            controlRating: detail.controlRating ?? playerData.controlRating,
            gfRank: detail.gfRank ?? playerData.gfRank,
            gfCount: detail.gfCount ?? playerData.gfCount,
            gaRank: detail.gaRank ?? playerData.gaRank,
            gaCount: detail.gaCount ?? playerData.gaCount,
            elo: detail.elo ?? playerData.elo,
            asOfDate: detail.date ?? null
        };
    });
    let loadingError = $state(false);

    /**
     * Load player data
     */
    async function loadPlayerData() {
        if (!playerName) {
            setNotification('Player name is required', 'error');
            return;
        }

        loadingError = false;
        playerData = null;

        await withLoading(
            async () => {
                // Extract year from date (YYYY-MM-DD format) to load from correct rankings file
                const year = date ? date.substring(0, 4) : null;
                const params = new SvelteURLSearchParams({ limit: '0' });
                if (year) params.set('year', year);
                if (date) params.set('date', date);
                const response = await api.get(
                    `rankings/${encodeURIComponent(playerName)}?${params.toString()}`
                );
                playerData = response.playerData;
            },
            (err) => {
                console.error('Error loading player profile:', err);
                loadingError = true;
                setNotification(
                    err.message || 'Failed to load player profile. Please try again.',
                    'info'
                );
            }
        );
    }

    /**
     * Load player data when modal opens or playerName/date changes
     * Reset data when modal closes
     */
    $effect(() => {
        if (open && playerName) {
            loadPlayerData();
        } else if (!open) {
            // Reset state when modal closes
            playerData = null;
            loadingError = false;
        }
    });
</script>

<Modal
    transition={scale}
    bind:open
    size="md"
    class="glass-strong mx-auto w-[95vw] border backdrop:backdrop-blur-xs md:w-2/3 lg:w-1/2 xl:w-1/3"
    classes={{ body: 'p-4', close: 'p-0', header: '!min-w-0 !w-full' }}>
    {#snippet header()}
        {#if playerData || loadingError}
            <div class="w-full">
                <PlayerHeader
                    playerData={playerDisplayData}
                    {playerName}
                    asOfDate={playerDisplayData?.asOfDate ?? date}
                    showStatus={false} />
            </div>
        {:else}
            <div class="p-4">
                <h3 class="text-xl font-semibold">{playerName || 'Player Profile'}</h3>
            </div>
        {/if}
    {/snippet}

    {#if !playerData && !loadingError}
        <div class="flex items-center justify-center gap-2 p-4">
            <Spinner size="6" />
            <div class="text-gray-500">Loading...</div>
        </div>
    {:else if loadingError}
        <div class="p-4 text-center text-sm text-gray-400">New player - no stats yet</div>
    {:else if playerData}
        <PlayerSummaryCard
            playerData={playerDisplayData}
            showAverages={false} />
    {/if}
</Modal>

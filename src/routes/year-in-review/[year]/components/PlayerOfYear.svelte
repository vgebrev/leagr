<script>
    import SlideCard from './SlideCard.svelte';

    let { data } = $props();

    const medals = ['🥇', '🥈', '🥉'];
</script>

<SlideCard
    icon="⭐"
    heading="Player of the Year"
    description="Top Performers by Ranking Points">
    <div class="mt-4 space-y-3">
        {#if data && data.length > 0}
            {#each data as player, index (index)}
                <div
                    class="flex items-center justify-between rounded-lg bg-gradient-to-r from-gray-50 to-blue-50 p-3 transition-colors hover:from-gray-100 hover:to-blue-100 dark:from-gray-800 dark:to-blue-900/20 dark:hover:from-gray-700 dark:hover:to-blue-900/30 md:p-4">
                    <div class="flex items-center gap-2 md:gap-4">
                        <span class="text-2xl md:text-4xl">{medals[index]}</span>
                        <div class="text-left">
                            <div class="text-base font-bold text-gray-900 dark:text-white md:text-xl">
                                {player.name}
                            </div>
                            <div class="text-xs text-gray-600 dark:text-gray-400 md:text-sm">
                                Rank #{player.rank} • {player.appearances} Sessions
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-2xl font-bold text-blue-600 dark:text-blue-400 md:text-3xl">
                            {player.rankingPoints.toFixed(1)}
                        </div>
                        <div class="text-xs text-gray-600 dark:text-gray-400 md:text-sm">Ranking Points</div>
                    </div>
                </div>
            {/each}
        {:else}
            <div class="py-8 text-gray-500 dark:text-gray-400">No data available</div>
        {/if}
    </div>
</SlideCard>

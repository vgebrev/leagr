<script>
    import SlideCard from './SlideCard.svelte';

    let { data } = $props();

    const medals = ['🥇', '🥈', '🥉'];
</script>

<SlideCard
    icon="📈"
    heading="Most Improved"
    description="Biggest Rank Climbers">
    <div class="mt-4 space-y-3">
        {#if data && data.length > 0}
            {#each data as player, index (index)}
                <div
                    class="flex items-center justify-between rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 md:p-4">
                    <div class="flex items-center gap-2 md:gap-4">
                        <span class="text-2xl md:text-4xl">{medals[index]}</span>
                        <div class="text-left">
                            <div class="text-base font-bold text-gray-900 dark:text-white md:text-xl">
                                {player.name}
                            </div>
                            <div class="text-xs text-gray-600 dark:text-gray-400 md:text-sm">
                                Ranking Points: {player.rankingPoints.toFixed(1)}
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="flex items-center justify-end gap-1 md:gap-2">
                            <span class="text-sm text-gray-500 line-through md:text-base">
                                #{player.previousRank}
                            </span>
                            <span class="text-base md:text-xl">→</span>
                            <span class="text-xl font-bold text-green-600 dark:text-green-400 md:text-2xl">
                                #{player.currentRank}
                            </span>
                        </div>
                        <div class="text-xs font-semibold text-green-600 dark:text-green-400 md:text-sm">
                            +{player.rankImprovement} positions
                        </div>
                    </div>
                </div>
            {/each}
        {:else}
            <div class="py-8 text-gray-500 dark:text-gray-400">No data available</div>
        {/if}
    </div>
</SlideCard>

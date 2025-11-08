<script>
    import SlideCard from './SlideCard.svelte';

    let { data } = $props();

    const medals = ['🥇', '🥈', '🥉'];
</script>

<SlideCard>
    <div class="mb-8">
        <div class="mb-4 text-6xl">📈</div>
        <h2 class="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Most Improved</h2>
        <p class="text-gray-600 dark:text-gray-400">Biggest Rank Climbers</p>
    </div>

    <div class="mt-8 space-y-4">
        {#if data && data.length > 0}
            {#each data as player, index (index)}
                <div
                    class="flex items-center justify-between rounded-lg bg-gray-50 p-6 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700">
                    <div class="flex items-center gap-4">
                        <span class="text-4xl">{medals[index]}</span>
                        <div class="text-left">
                            <div class="text-2xl font-bold text-gray-900 dark:text-white">
                                {player.name}
                            </div>
                            <div class="text-sm text-gray-600 dark:text-gray-400">
                                Ranking Points: {player.rankingPoints.toFixed(1)}
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="flex items-center justify-end gap-2">
                            <span class="text-lg text-gray-500 line-through">
                                #{player.previousRank}
                            </span>
                            <span class="text-2xl">→</span>
                            <span class="text-3xl font-bold text-green-600 dark:text-green-400">
                                #{player.currentRank}
                            </span>
                        </div>
                        <div class="text-sm font-semibold text-green-600 dark:text-green-400">
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

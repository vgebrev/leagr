<script>
    import SlideCard from './SlideCard.svelte';

    let { data, slideDirection } = $props();
</script>

<SlideCard
    icon="👑"
    heading="Team of the Year"
    description="The Dream Team - Top 6 by Ranking Points">
    {#if data && data.length > 0}
        <div class="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {#each data as player, index (index)}
                <div
                    class="rounded-lg border-2 border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50 p-6 dark:border-yellow-700 dark:from-yellow-900/20 dark:to-amber-900/20">
                    <div class="flex items-center justify-between">
                        <div class="text-left">
                            <div class="mb-1 text-sm text-gray-600 dark:text-gray-400">
                                Position {index + 1}
                            </div>
                            <div class="text-xl font-bold text-gray-900 dark:text-white">
                                {player.name}
                            </div>
                            <div class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                                Rank #{player.rank}
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                                {player.rankingPoints.toFixed(1)}
                            </div>
                            <div class="text-xs text-gray-600 dark:text-gray-400">Points</div>
                        </div>
                    </div>
                </div>
            {/each}
        </div>

        <div
            class="mt-8 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/10">
            <p class="text-sm text-gray-700 dark:text-gray-300">
                🌟 This legendary lineup represents the peak of performance throughout the year
            </p>
        </div>
    {:else}
        <div class="py-8 text-gray-500 dark:text-gray-400">No data available</div>
    {/if}
</SlideCard>

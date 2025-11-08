<script>
    import SlideCard from './SlideCard.svelte';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';

    let { data } = $props();

    const medals = ['🥇', '🥈', '🥉'];
</script>

<SlideCard
    icon="🏆"
    heading="King of Kings"
    description="Most Championship Trophies">
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
                            <div class="mt-0.5 flex gap-2 md:mt-1 md:gap-3">
                                <div
                                    class="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 md:text-sm">
                                    <TrophyIcon
                                        type="league"
                                        size="sm" />
                                    {player.leagueWins} League
                                </div>
                                <div
                                    class="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 md:text-sm">
                                    <TrophyIcon
                                        type="cup"
                                        size="sm" />
                                    {player.cupWins} Cup
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="text-right">
                        <div class="text-3xl font-bold text-yellow-500 dark:text-yellow-400 md:text-4xl">
                            {player.totalTrophies}
                        </div>
                        <div class="text-xs text-gray-600 dark:text-gray-400 md:text-sm">Total Trophies</div>
                    </div>
                </div>
            {/each}
        {:else}
            <div class="py-8 text-gray-500 dark:text-gray-400">No champions this year</div>
        {/if}
    </div>
</SlideCard>

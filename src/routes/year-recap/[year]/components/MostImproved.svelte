<script>
    import SlideCard from './SlideCard.svelte';
    import AnimatedIn from './AnimatedIn.svelte';
    import Avatar from '$components/avatars/Avatar.svelte';

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
                <AnimatedIn
                    delay={index * 200}
                    type="scale"
                    duration={400}>
                    <div
                        class="glass flex items-center justify-between rounded-lg border border-gray-200 px-2 py-3 md:py-4 dark:border-gray-700">
                        <div class="flex items-center gap-2 md:gap-3">
                            <span class="text-2xl md:text-3xl">{medals[index]}</span>
                            <div class="mr-1 shrink-0 leading-[0] md:mr-2 [&>div]:block">
                                <Avatar
                                    avatarUrl={player.avatarUrl}
                                    size="md" />
                            </div>
                            <div class="text-left">
                                <div
                                    class="text-base font-bold text-gray-900 md:text-xl dark:text-white">
                                    {player.name}
                                </div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="flex items-center justify-end gap-1 md:gap-2">
                                <span class="text-sm text-gray-500 md:text-base">
                                    #{player.previousRank}
                                </span>
                                <span class="text-base md:text-xl">→</span>
                                <span
                                    class="text-primary-600 dark:text-primary-500 text-xl font-bold md:text-2xl">
                                    #{player.currentRank}
                                </span>
                            </div>
                            <div
                                class="text-xs font-semibold text-green-600 md:text-sm dark:text-green-400">
                                +{player.rankImprovement} positions
                            </div>
                        </div>
                    </div>
                </AnimatedIn>
            {/each}
        {:else}
            <div class="py-8 text-gray-500 dark:text-gray-400">No data available</div>
        {/if}
    </div>
</SlideCard>

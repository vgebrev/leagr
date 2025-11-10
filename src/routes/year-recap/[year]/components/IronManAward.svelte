<script>
    import SlideCard from './SlideCard.svelte';
    import AnimatedIn from './AnimatedIn.svelte';
    import Avatar from '$components/avatars/Avatar.svelte';

    let { data, initialDelay = 400, duration = 400 } = $props();

    const medals = ['🥇', '🥈', '🥉'];
    const itemStagger = 200; // Delay increment per medal
</script>

<SlideCard
    icon="👟"
    heading="Iron Man Award"
    description="Most Dedicated Players">
    <div class="mt-4 space-y-3">
        {#if data && data.length > 0}
            {#each data as player, index (index)}
                <AnimatedIn
                    delay={initialDelay + index * itemStagger}
                    type="scale"
                    {duration}>
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
                                <div class="text-xs text-gray-600 md:text-sm dark:text-gray-400">
                                    {player.totalGames} games played
                                </div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div
                                class="text-primary-600 dark:text-primary-500 text-2xl font-bold md:text-3xl">
                                {player.appearances}
                            </div>
                            <div class="text-xs text-gray-600 md:text-sm dark:text-gray-400">
                                Sessions
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

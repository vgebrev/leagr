<script>
    import SlideCard from './SlideCard.svelte';
    import AnimatedIn from './AnimatedIn.svelte';
    import Avatar from '$components/avatars/Avatar.svelte';

    let { data } = $props();
</script>

<SlideCard
    icon="🏆"
    heading="Team of the Year"
    description="Top 6 by Ranking Points">
    {#if data && data.length > 0}
        <div class="mt-4 grid grid-cols-2 gap-3">
            {#each data as player, index (index)}
                <AnimatedIn
                    delay={index * 150}
                    type="scale"
                    duration={400}>
                    <div
                        class="glass flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-3 dark:border-gray-700">
                        <div class="shrink-0 leading-[0] [&>div]:block">
                            <Avatar
                                avatarUrl={player.avatarUrl}
                                size="md" />
                        </div>
                        <div class="text-left">
                            <div
                                class="text-sm font-bold text-gray-900 md:text-base dark:text-white">
                                {player.name}
                            </div>
                            <div class="text-xs text-gray-600 dark:text-gray-400">
                                {player.rankingPoints.toFixed(1)} pts
                            </div>
                        </div>
                    </div>
                </AnimatedIn>
            {/each}
        </div>

        <AnimatedIn
            delay={900}
            type="fade"
            duration={600}>
            <div
                class="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
                <p class="text-xs text-gray-700 md:text-sm dark:text-gray-300">
                    🌟 This legendary lineup represents the peak of performance and consistency
                    throughout the year
                </p>
            </div>
        </AnimatedIn>
    {:else}
        <div class="py-8 text-gray-500 dark:text-gray-400">No data available</div>
    {/if}
</SlideCard>

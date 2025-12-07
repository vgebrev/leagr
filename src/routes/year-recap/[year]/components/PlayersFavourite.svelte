<script>
    import SlideCard from './SlideCard.svelte';
    import AnimatedIn from './AnimatedIn.svelte';
    import Avatar from '$components/avatars/Avatar.svelte';

    let { data, initialDelay = 400, duration = 400 } = $props();

    const medals = ['🥇', '🥈', '🥉'];
    const itemStagger = 200; // Delay increment per medal
</script>

<SlideCard
    icon="❤️"
    heading="Players' Player of the Year"
    description="Voted by the Players">
    <div class="mt-4 space-y-3">
        {#if data && data.topThree && data.topThree.length > 0}
            {#each data.topThree as player, index (index)}
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
                            </div>
                        </div>
                        <div class="text-right">
                            <div
                                class="text-primary-600 dark:text-primary-500 text-2xl font-bold md:text-3xl">
                                {player.votes}
                            </div>
                            <div class="text-xs text-gray-600 md:text-sm dark:text-gray-400">
                                {player.votes === 1 ? 'Vote' : 'Votes'}
                            </div>
                        </div>
                    </div>
                </AnimatedIn>
            {/each}

            {#if data.otherNominations && data.otherNominations.length > 0}
                <AnimatedIn
                    delay={initialDelay + data.topThree.length * itemStagger}
                    type="fade"
                    {duration}>
                    <div
                        class="mt-4 rounded-lg border border-gray-200 bg-gray-50/50 px-3 py-2 dark:border-gray-700 dark:bg-gray-800/30">
                        <div class="mb-1 text-xs font-semibold text-gray-600 dark:text-gray-400">
                            Other Nominations:
                        </div>
                        <div class="text-xs text-gray-600 dark:text-gray-400">
                            {data.otherNominations.map((p) => `${p.name} (${p.votes})`).join(', ')}
                        </div>
                    </div>
                </AnimatedIn>
            {/if}
        {:else}
            <div class="py-8 text-gray-500 dark:text-gray-400">No voting data available</div>
        {/if}
    </div>
</SlideCard>

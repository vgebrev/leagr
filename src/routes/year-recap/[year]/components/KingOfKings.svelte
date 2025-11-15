<script>
    import SlideCard from './SlideCard.svelte';
    import AnimatedIn from './AnimatedIn.svelte';
    import Avatar from '$components/avatars/Avatar.svelte';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import CrownIcon from '$components/Icons/CrownIcon.svelte';

    let { data, initialDelay = 400, duration = 400 } = $props();

    const medals = ['🥇', '🥈', '🥉'];
    const itemStagger = 200; // Delay increment per medal
</script>

<SlideCard
    icon="👑"
    heading="King of Kings"
    description="Most Trophies">
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
                                <div class="mt-0.5 flex gap-2 md:mt-1 md:gap-3">
                                    <div
                                        class="flex items-center gap-1 text-xs font-semibold text-yellow-600 md:text-sm dark:text-yellow-400">
                                        <CrownIcon class="h-3 w-3 md:h-4 md:w-4" />
                                        {player.leagueWins} Leagues
                                    </div>
                                    <span
                                        class="text-xs text-gray-500 md:text-sm dark:text-gray-400"
                                        >•</span>
                                    <div
                                        class="flex items-center gap-1 text-xs font-semibold text-orange-600 md:text-sm dark:text-orange-400">
                                        <TrophyIcon
                                            type="cup"
                                            class="h-3 w-3 md:h-4 md:w-4" />
                                        {player.cupWins} Cups
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div
                                class="text-primary-600 dark:text-primary-500 text-2xl font-bold md:text-3xl">
                                {player.totalTrophies}
                            </div>
                            <div class="text-xs text-gray-600 md:text-sm dark:text-gray-400">
                                Trophies
                            </div>
                        </div>
                    </div>
                </AnimatedIn>
            {/each}
        {:else}
            <div class="py-8 text-gray-500 dark:text-gray-400">No champions this year</div>
        {/if}
    </div>
</SlideCard>

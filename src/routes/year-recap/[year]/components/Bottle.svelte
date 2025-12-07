<script>
    import SlideCard from './SlideCard.svelte';
    import AnimatedIn from './AnimatedIn.svelte';
    import Avatar from '$components/avatars/Avatar.svelte';
    import CrownIcon from '$components/Icons/CrownIcon.svelte';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';

    let { data, initialDelay = 400, duration = 400 } = $props();

    const medals = ['🥇', '🥈', '🥉'];
    const itemStagger = 200; // Delay increment per item
</script>

<SlideCard
    icon="🍼"
    heading="The Bottle"
    description="So Close, Yet So Far">
    <div class="mt-4 grid grid-cols-2 gap-3 md:gap-4">
        <!-- League 2nd Place -->
        <div class="flex flex-col gap-2">
            <div
                class="text-center text-xs font-semibold text-yellow-600 md:text-sm dark:text-yellow-500">
                <CrownIcon class="mb-1 inline-block h-3 w-3 md:h-4 md:w-4" />
                League Runners-Up
            </div>
            {#if data && data.leagueSecond && data.leagueSecond.length > 0}
                {#each data.leagueSecond as player, index (index)}
                    <AnimatedIn
                        delay={initialDelay + index * itemStagger}
                        type="scale"
                        {duration}>
                        <div
                            class="glass flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-2 dark:border-gray-700">
                            <span class="text-lg md:text-xl">{medals[index]}</span>
                            <div class="shrink-0 leading-[0] [&>div]:block">
                                <Avatar
                                    avatarUrl={player.avatarUrl}
                                    size="sm" />
                            </div>
                            <div class="flex-1 text-left">
                                <div
                                    class="text-sm font-bold text-gray-900 md:text-base dark:text-white">
                                    {player.name}
                                </div>
                                <div class="text-xs text-gray-600 dark:text-gray-400">
                                    {player.count}
                                    {player.count === 1 ? 'time' : 'times'}
                                </div>
                            </div>
                        </div>
                    </AnimatedIn>
                {/each}
            {:else}
                <div class="py-4 text-xs text-gray-500 dark:text-gray-400">No data</div>
            {/if}
        </div>

        <!-- Cup Final Losses -->
        <div class="flex flex-col gap-2">
            <div
                class="text-center text-xs font-semibold text-amber-600 md:text-sm dark:text-amber-600">
                <TrophyIcon
                    type="cup"
                    class="mb-1 inline-block h-3 w-3 md:h-4 md:w-4" />
                Cup Final Losses
            </div>
            {#if data && data.cupFinalLosses && data.cupFinalLosses.length > 0}
                {#each data.cupFinalLosses as player, index (index)}
                    <AnimatedIn
                        delay={initialDelay + (index + 3) * itemStagger}
                        type="scale"
                        {duration}>
                        <div
                            class="glass flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-2 dark:border-gray-700">
                            <span class="text-lg md:text-xl">{medals[index]}</span>
                            <div class="shrink-0 leading-[0] [&>div]:block">
                                <Avatar
                                    avatarUrl={player.avatarUrl}
                                    size="sm" />
                            </div>
                            <div class="flex-1 text-left">
                                <div
                                    class="text-sm font-bold text-gray-900 md:text-base dark:text-white">
                                    {player.name}
                                </div>
                                <div class="text-xs text-gray-600 dark:text-gray-400">
                                    {player.count}
                                    {player.count === 1 ? 'time' : 'times'}
                                </div>
                            </div>
                        </div>
                    </AnimatedIn>
                {/each}
            {:else}
                <div class="py-4 text-xs text-gray-500 dark:text-gray-400">No data</div>
            {/if}
        </div>
    </div>
</SlideCard>

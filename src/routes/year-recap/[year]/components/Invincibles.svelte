<script>
    import SlideCard from './SlideCard.svelte';
    import TeamBadge from '$components/TeamBadge.svelte';

    let { data } = $props();
</script>

<SlideCard
    icon="💪"
    heading="The Invincibles"
    description="The Most Dominant Team">
    {#if data}
        <div class="mt-4 space-y-4">
            <!-- Team Name -->
            <div class="flex flex-col items-center justify-center gap-1 md:gap-2">
                <TeamBadge teamName={data.teamName} />
                <div class="text-xs text-gray-600 md:text-sm dark:text-gray-400">
                    Session: {data.sessionDate}
                </div>
            </div>

            <!-- Points Percentage Highlight -->
            <div
                class="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-4 dark:from-green-900/20 dark:to-emerald-900/20">
                <div class="text-center">
                    <div class="text-4xl font-bold text-green-600 md:text-5xl dark:text-green-400">
                        {data.pointsPercentage.toFixed(1)}%
                    </div>
                    <div class="text-sm text-gray-600 md:text-base dark:text-gray-400">
                        Points Won ({data.points}/{data.totalAvailablePoints})
                    </div>
                </div>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-3 gap-2 md:gap-3">
                <div class="rounded-lg bg-green-50 p-3 md:p-4 dark:bg-green-900/20">
                    <div class="text-xl font-bold text-green-600 md:text-2xl dark:text-green-400">
                        {data.wins}
                    </div>
                    <div class="text-xs text-gray-600 md:text-sm dark:text-gray-400">Wins</div>
                </div>
                <div class="rounded-lg bg-gray-50 p-3 md:p-4 dark:bg-gray-800">
                    <div class="text-xl font-bold text-gray-900 md:text-2xl dark:text-white">
                        {data.draws}
                    </div>
                    <div class="text-xs text-gray-600 md:text-sm dark:text-gray-400">Draws</div>
                </div>
                <div class="rounded-lg bg-red-50 p-3 md:p-4 dark:bg-red-900/20">
                    <div class="text-xl font-bold text-red-600 md:text-2xl dark:text-red-400">
                        {data.losses}
                    </div>
                    <div class="text-xs text-gray-600 md:text-sm dark:text-gray-400">Losses</div>
                </div>
            </div>

            <!-- Goal Stats -->
            <div class="grid grid-cols-3 gap-2 md:gap-3">
                <div class="rounded-lg bg-blue-50 p-3 md:p-4 dark:bg-blue-900/20">
                    <div class="text-xl font-bold text-blue-600 md:text-2xl dark:text-blue-400">
                        {data.goalsFor}
                    </div>
                    <div class="text-xs text-gray-600 md:text-sm dark:text-gray-400">Goals For</div>
                </div>
                <div class="rounded-lg bg-orange-50 p-3 md:p-4 dark:bg-orange-900/20">
                    <div class="text-xl font-bold text-orange-600 md:text-2xl dark:text-orange-400">
                        {data.goalsAgainst}
                    </div>
                    <div class="text-xs text-gray-600 md:text-sm dark:text-gray-400">
                        Goals Against
                    </div>
                </div>
                <div class="rounded-lg bg-green-50 p-3 md:p-4 dark:bg-green-900/20">
                    <div class="text-xl font-bold text-green-600 md:text-2xl dark:text-green-400">
                        +{data.goalDifference}
                    </div>
                    <div class="text-xs text-gray-600 md:text-sm dark:text-gray-400">
                        Goal Difference
                    </div>
                </div>
            </div>

            <!-- Players -->
            <div class="mt-3 md:mt-4">
                <h3 class="mb-2 text-base font-semibold text-gray-900 md:text-lg dark:text-white">
                    Players
                </h3>
                <div class="flex flex-wrap justify-center gap-1.5 md:gap-2">
                    {#each data.players as player, i (i)}
                        <span
                            class="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 md:px-3 md:text-sm dark:bg-gray-700 dark:text-gray-300">
                            {player}
                        </span>
                    {/each}
                </div>
            </div>

            <!-- Honorable Mentions -->
            {#if data.honorableMentions && data.honorableMentions.length > 0}
                <div class="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                    <h3
                        class="mb-3 text-center text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Honorable Mentions
                    </h3>
                    <div class="flex flex-col gap-2">
                        {#each data.honorableMentions as mention, index (index)}
                            <div
                                class="flex items-center justify-between rounded-lg bg-gray-50 p-2 dark:bg-gray-800">
                                <div class="flex items-center gap-2">
                                    <span
                                        class="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs font-semibold dark:bg-gray-700">
                                        #{index + 2}
                                    </span>
                                    <TeamBadge teamName={mention.teamName} />
                                </div>
                                <div class="text-right">
                                    <div class="text-xs text-gray-600 dark:text-gray-400">
                                        {mention.sessionDate}
                                    </div>
                                    <div
                                        class="text-xs font-semibold text-green-600 dark:text-green-400">
                                        {mention.pointsPercentage.toFixed(1)}%
                                    </div>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>
            {/if}
        </div>
    {:else}
        <div class="py-8 text-gray-500 dark:text-gray-400">No data available</div>
    {/if}
</SlideCard>

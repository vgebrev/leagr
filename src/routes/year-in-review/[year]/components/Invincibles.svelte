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
                <div class="text-xs text-gray-600 dark:text-gray-400 md:text-sm">
                    Session: {data.sessionDate}
                </div>
            </div>

            <!-- Stats Grid -->
            <div class="grid grid-cols-3 gap-2 md:gap-3">
                <div class="rounded-lg bg-green-50 p-3 dark:bg-green-900/20 md:p-4">
                    <div class="text-xl font-bold text-green-600 dark:text-green-400 md:text-2xl">
                        {data.wins}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 md:text-sm">Wins</div>
                </div>
                <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-800 md:p-4">
                    <div class="text-xl font-bold text-gray-900 dark:text-white md:text-2xl">
                        {data.draws}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 md:text-sm">Draws</div>
                </div>
                <div class="rounded-lg bg-red-50 p-3 dark:bg-red-900/20 md:p-4">
                    <div class="text-xl font-bold text-red-600 dark:text-red-400 md:text-2xl">
                        {data.losses}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 md:text-sm">Losses</div>
                </div>
            </div>

            <!-- Goal Stats -->
            <div class="grid grid-cols-3 gap-2 md:gap-3">
                <div class="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20 md:p-4">
                    <div class="text-xl font-bold text-blue-600 dark:text-blue-400 md:text-2xl">
                        {data.goalsFor}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 md:text-sm">Goals For</div>
                </div>
                <div class="rounded-lg bg-orange-50 p-3 dark:bg-orange-900/20 md:p-4">
                    <div class="text-xl font-bold text-orange-600 dark:text-orange-400 md:text-2xl">
                        {data.goalsAgainst}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 md:text-sm">Goals Against</div>
                </div>
                <div class="rounded-lg bg-green-50 p-3 dark:bg-green-900/20 md:p-4">
                    <div class="text-xl font-bold text-green-600 dark:text-green-400 md:text-2xl">
                        +{data.goalDifference}
                    </div>
                    <div class="text-xs text-gray-600 dark:text-gray-400 md:text-sm">Goal Difference</div>
                </div>
            </div>

            <!-- Players -->
            <div class="mt-3 md:mt-4">
                <h3 class="mb-2 text-base font-semibold text-gray-900 dark:text-white md:text-lg">
                    Players
                </h3>
                <div class="flex flex-wrap justify-center gap-1.5 md:gap-2">
                    {#each data.players as player, i (i)}
                        <span
                            class="rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700 dark:bg-gray-700 dark:text-gray-300 md:px-3 md:text-sm">
                            {player}
                        </span>
                    {/each}
                </div>
            </div>
        </div>
    {:else}
        <div class="py-8 text-gray-500 dark:text-gray-400">No data available</div>
    {/if}
</SlideCard>

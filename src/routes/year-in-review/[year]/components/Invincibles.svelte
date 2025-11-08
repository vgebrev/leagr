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
        <div class="mt-8 space-y-6">
            <!-- Team Name -->
            <div class="flex flex-col items-center justify-center gap-2">
                <TeamBadge teamName={data.teamName} />
                <div class="text-sm text-gray-600 dark:text-gray-400">
                    Session: {data.sessionDate}
                </div>
            </div>

            <!-- Stats Grid -->
            <div class="mt-6 grid grid-cols-3 gap-4">
                <div class="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                    <div class="text-3xl font-bold text-green-600 dark:text-green-400">
                        {data.wins}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400">Wins</div>
                </div>
                <div class="rounded-lg bg-gray-50 p-4 dark:bg-gray-800">
                    <div class="text-3xl font-bold text-gray-900 dark:text-white">
                        {data.draws}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400">Draws</div>
                </div>
                <div class="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
                    <div class="text-3xl font-bold text-red-600 dark:text-red-400">
                        {data.losses}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400">Losses</div>
                </div>
            </div>

            <!-- Goal Stats -->
            <div class="grid grid-cols-3 gap-4">
                <div class="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                    <div class="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {data.goalsFor}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400">Goals For</div>
                </div>
                <div class="rounded-lg bg-orange-50 p-4 dark:bg-orange-900/20">
                    <div class="text-3xl font-bold text-orange-600 dark:text-orange-400">
                        {data.goalsAgainst}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400">Goals Against</div>
                </div>
                <div class="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                    <div class="text-3xl font-bold text-green-600 dark:text-green-400">
                        +{data.goalDifference}
                    </div>
                    <div class="text-sm text-gray-600 dark:text-gray-400">Goal Difference</div>
                </div>
            </div>

            <!-- Players -->
            <div class="mt-6">
                <h3 class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">Players</h3>
                <div class="flex flex-wrap justify-center gap-2">
                    {#each data.players as player, i (i)}
                        <span
                            class="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700 dark:bg-gray-700 dark:text-gray-300">
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

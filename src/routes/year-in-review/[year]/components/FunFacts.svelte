<script>
    import SlideCard from './SlideCard.svelte';
    import TeamBadge from '$components/TeamBadge.svelte';

    let { data } = $props();
</script>

<SlideCard>
    <div class="mb-8">
        <div class="mb-4 text-6xl">🎯</div>
        <h2 class="mb-2 text-4xl font-bold text-gray-900 dark:text-white">Fun Facts</h2>
        <p class="text-gray-600 dark:text-gray-400">Memorable Moments from the Year</p>
    </div>

    {#if data}
        <div class="mt-8 space-y-6">
            <!-- Highest Scoring Match -->
            {#if data.highestScoringMatch}
                <div
                    class="rounded-lg bg-gradient-to-r from-orange-50 to-red-50 p-6 dark:from-orange-900/20 dark:to-red-900/20">
                    <div class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                        🔥 Highest Scoring Match
                    </div>
                    <div class="flex items-center justify-center gap-4">
                        <TeamBadge teamName={data.highestScoringMatch.home} />
                        <span class="text-3xl font-bold text-gray-900 dark:text-white">
                            {data.highestScoringMatch.homeScore} - {data.highestScoringMatch
                                .awayScore}
                        </span>
                        <TeamBadge teamName={data.highestScoringMatch.away} />
                    </div>
                    <div class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {data.highestScoringMatch.totalGoals} total goals on {data
                            .highestScoringMatch.date}
                    </div>
                </div>
            {/if}

            <!-- Biggest Margin Win -->
            {#if data.biggestMarginWin}
                <div
                    class="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-6 dark:from-green-900/20 dark:to-emerald-900/20">
                    <div class="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
                        💥 Biggest Margin Win
                    </div>
                    <div class="flex items-center justify-center gap-4">
                        <TeamBadge teamName={data.biggestMarginWin.home} />
                        <span class="text-3xl font-bold text-gray-900 dark:text-white">
                            {data.biggestMarginWin.homeScore} - {data.biggestMarginWin.awayScore}
                        </span>
                        <TeamBadge teamName={data.biggestMarginWin.away} />
                    </div>
                    <div class="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {data.biggestMarginWin.margin} goal margin on {data.biggestMarginWin.date}
                    </div>
                </div>
            {/if}

            <!-- Most & Fewest Goals -->
            <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                {#if data.mostGoalsSession}
                    <div class="rounded-lg bg-blue-50 p-6 dark:bg-blue-900/20">
                        <div class="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                            ⚽ Most Goals in a Session
                        </div>
                        <div class="text-4xl font-bold text-blue-600 dark:text-blue-400">
                            {data.mostGoalsSession.goals}
                        </div>
                        <div class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {data.mostGoalsSession.date}
                        </div>
                    </div>
                {/if}

                {#if data.fewestGoalsSession}
                    <div class="rounded-lg bg-purple-50 p-6 dark:bg-purple-900/20">
                        <div class="mb-2 text-lg font-semibold text-gray-900 dark:text-white">
                            🛡️ Fewest Goals in a Session
                        </div>
                        <div class="text-4xl font-bold text-purple-600 dark:text-purple-400">
                            {data.fewestGoalsSession.goals}
                        </div>
                        <div class="mt-1 text-sm text-gray-600 dark:text-gray-400">
                            {data.fewestGoalsSession.date}
                        </div>
                    </div>
                {/if}
            </div>
        </div>
    {:else}
        <div class="py-8 text-gray-500 dark:text-gray-400">No data available</div>
    {/if}
</SlideCard>

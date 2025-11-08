<script>
    import SlideCard from './SlideCard.svelte';
    import TeamBadge from '$components/TeamBadge.svelte';

    let { data } = $props();
</script>

<SlideCard
    icon="🎯"
    heading="Fun Facts"
    description="Memorable Moments from the Year">
    {#if data}
        <div class="mt-4 space-y-3">
            <!-- Highest Scoring Match -->
            {#if data.highestScoringMatch}
                <div
                    class="rounded-lg bg-gradient-to-r from-orange-50 to-red-50 p-3 dark:from-orange-900/20 dark:to-red-900/20 md:p-4">
                    <div class="mb-2 text-sm font-semibold text-gray-900 dark:text-white md:text-base">
                        🔥 Highest Scoring Match
                    </div>
                    <div class="flex items-center justify-center gap-2 md:gap-4">
                        <TeamBadge teamName={data.highestScoringMatch.home} />
                        <span class="text-xl font-bold text-gray-900 dark:text-white md:text-2xl">
                            {data.highestScoringMatch.homeScore} - {data.highestScoringMatch
                                .awayScore}
                        </span>
                        <TeamBadge teamName={data.highestScoringMatch.away} />
                    </div>
                    <div class="mt-1 text-xs text-gray-600 dark:text-gray-400 md:text-sm">
                        {data.highestScoringMatch.totalGoals} total goals on {data
                            .highestScoringMatch.date}
                    </div>
                </div>
            {/if}

            <!-- Biggest Margin Win -->
            {#if data.biggestMarginWin}
                <div
                    class="rounded-lg bg-gradient-to-r from-green-50 to-emerald-50 p-3 dark:from-green-900/20 dark:to-emerald-900/20 md:p-4">
                    <div class="mb-2 text-sm font-semibold text-gray-900 dark:text-white md:text-base">
                        💥 Biggest Margin Win
                    </div>
                    <div class="flex items-center justify-center gap-2 md:gap-4">
                        <TeamBadge teamName={data.biggestMarginWin.home} />
                        <span class="text-xl font-bold text-gray-900 dark:text-white md:text-2xl">
                            {data.biggestMarginWin.homeScore} - {data.biggestMarginWin.awayScore}
                        </span>
                        <TeamBadge teamName={data.biggestMarginWin.away} />
                    </div>
                    <div class="mt-1 text-xs text-gray-600 dark:text-gray-400 md:text-sm">
                        {data.biggestMarginWin.margin} goal margin on {data.biggestMarginWin.date}
                    </div>
                </div>
            {/if}

            <!-- Most & Fewest Goals -->
            <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
                {#if data.mostGoalsSession}
                    <div class="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/20 md:p-4">
                        <div class="mb-1 text-sm font-semibold text-gray-900 dark:text-white md:text-base">
                            ⚽ Most Goals in a Session
                        </div>
                        <div class="text-2xl font-bold text-blue-600 dark:text-blue-400 md:text-3xl">
                            {data.mostGoalsSession.goals}
                        </div>
                        <div class="mt-0.5 text-xs text-gray-600 dark:text-gray-400 md:text-sm">
                            {data.mostGoalsSession.date}
                        </div>
                    </div>
                {/if}

                {#if data.fewestGoalsSession}
                    <div class="rounded-lg bg-purple-50 p-3 dark:bg-purple-900/20 md:p-4">
                        <div class="mb-1 text-sm font-semibold text-gray-900 dark:text-white md:text-base">
                            🛡️ Fewest Goals in a Session
                        </div>
                        <div class="text-2xl font-bold text-purple-600 dark:text-purple-400 md:text-3xl">
                            {data.fewestGoalsSession.goals}
                        </div>
                        <div class="mt-0.5 text-xs text-gray-600 dark:text-gray-400 md:text-sm">
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

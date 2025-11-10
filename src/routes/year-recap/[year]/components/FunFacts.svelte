<script>
    import SlideCard from './SlideCard.svelte';
    import AnimatedIn from './AnimatedIn.svelte';
    import TeamBadge from '$components/TeamBadge.svelte';
    import { resolve } from '$app/paths';

    let { data, initialDelay = 400, duration = 400 } = $props();

    // Calculate delays
    const delays = {
        highestScoring: initialDelay,
        biggestMargin: initialDelay + 200,
        mostGoals: initialDelay + 400,
        fewestGoals: initialDelay + 500
    };
</script>

<SlideCard
    icon="🎯"
    heading="Fun Facts"
    description="Memorable Moments from the Year">
    {#if data}
        <div class="mt-4 space-y-3">
            <!-- Highest Scoring Match -->
            {#if data.highestScoringMatch}
                <AnimatedIn
                    delay={delays.highestScoring}
                    type="scale"
                    {duration}>
                    <a
                        href={resolve(`/table?date=${data.highestScoringMatch.date}`)}
                        data-sveltekit-preload-data="hover"
                        class="glass block rounded-lg border border-gray-200 px-2 py-3 transition-opacity hover:opacity-80 md:px-3 md:py-4 dark:border-gray-700">
                        <div
                            class="mb-2 text-sm font-semibold text-gray-900 md:text-base dark:text-white">
                            🔥 Highest Scoring Match
                        </div>
                        <div class="flex flex-nowrap items-center justify-center gap-2">
                            <div class="shrink-0">
                                <TeamBadge teamName={data.highestScoringMatch.home} />
                            </div>
                            <span
                                class="shrink-0 px-2 text-base font-semibold text-gray-900 md:px-3 md:text-2xl dark:text-white">
                                {data.highestScoringMatch.homeScore} - {data.highestScoringMatch
                                    .awayScore}
                            </span>
                            <div class="shrink-0">
                                <TeamBadge teamName={data.highestScoringMatch.away} />
                            </div>
                        </div>
                        <div
                            class="mt-1 text-center text-xs text-gray-600 md:text-sm dark:text-gray-400">
                            {data.highestScoringMatch.totalGoals} total goals on {data
                                .highestScoringMatch.date}
                        </div>
                    </a>
                </AnimatedIn>
            {/if}

            <!-- Biggest Margin Win -->
            {#if data.biggestMarginWin}
                <AnimatedIn
                    delay={delays.biggestMargin}
                    type="scale"
                    {duration}>
                    <a
                        href={resolve(`/table?date=${data.biggestMarginWin.date}`)}
                        data-sveltekit-preload-data="hover"
                        class="glass block rounded-lg border border-gray-200 px-2 py-3 transition-opacity hover:opacity-80 md:px-3 md:py-4 dark:border-gray-700">
                        <div
                            class="mb-2 text-sm font-semibold text-gray-900 md:text-base dark:text-white">
                            💥 Biggest Margin Win
                        </div>
                        <div class="flex flex-nowrap items-center justify-center gap-2">
                            <div class="shrink-0">
                                <TeamBadge teamName={data.biggestMarginWin.home} />
                            </div>
                            <span
                                class="shrink-0 px-2 text-base font-semibold text-gray-900 md:px-3 md:text-2xl dark:text-white">
                                {data.biggestMarginWin.homeScore} - {data.biggestMarginWin
                                    .awayScore}
                            </span>
                            <div class="shrink-0">
                                <TeamBadge teamName={data.biggestMarginWin.away} />
                            </div>
                        </div>
                        <div
                            class="mt-1 text-center text-xs text-gray-600 md:text-sm dark:text-gray-400">
                            {data.biggestMarginWin.margin} goal margin on {data.biggestMarginWin
                                .date}
                        </div>
                    </a>
                </AnimatedIn>
            {/if}

            <!-- Most & Fewest Goals -->
            <div class="grid grid-cols-2 gap-2">
                {#if data.mostGoalsSession}
                    <AnimatedIn
                        delay={delays.mostGoals}
                        type="scale"
                        {duration}>
                        <a
                            href={resolve(`/table?date=${data.mostGoalsSession.date}`)}
                            data-sveltekit-preload-data="hover"
                            class="glass block rounded-lg border border-gray-200 p-3 transition-opacity hover:opacity-80 dark:border-gray-700">
                            <div
                                class="mb-1 text-xs font-semibold text-gray-900 md:text-sm dark:text-white">
                                ⚽ Most Goals
                            </div>
                            <div
                                class="text-xl font-bold text-gray-900 md:text-2xl dark:text-white">
                                {data.mostGoalsSession.goals}
                            </div>
                            <div
                                class="mt-0.5 text-[10px] text-gray-600 md:text-xs dark:text-gray-400">
                                {data.mostGoalsSession.date}
                            </div>
                        </a>
                    </AnimatedIn>
                {/if}

                {#if data.fewestGoalsSession}
                    <AnimatedIn
                        delay={delays.fewestGoals}
                        type="scale"
                        {duration}>
                        <a
                            href={resolve(`/table?date=${data.fewestGoalsSession.date}`)}
                            data-sveltekit-preload-data="hover"
                            class="glass block rounded-lg border border-gray-200 p-3 transition-opacity hover:opacity-80 dark:border-gray-700">
                            <div
                                class="mb-1 text-xs font-semibold text-gray-900 md:text-sm dark:text-white">
                                🛡️ Fewest Goals
                            </div>
                            <div
                                class="text-xl font-bold text-gray-900 md:text-2xl dark:text-white">
                                {data.fewestGoalsSession.goals}
                            </div>
                            <div
                                class="mt-0.5 text-[10px] text-gray-600 md:text-xs dark:text-gray-400">
                                {data.fewestGoalsSession.date}
                            </div>
                        </a>
                    </AnimatedIn>
                {/if}
            </div>
        </div>
    {:else}
        <div class="py-8 text-gray-500 dark:text-gray-400">No data available</div>
    {/if}
</SlideCard>

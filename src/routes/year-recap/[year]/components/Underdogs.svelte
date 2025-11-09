<script>
    import SlideCard from './SlideCard.svelte';
    import AnimatedIn from './AnimatedIn.svelte';
    import Avatar from '$components/avatars/Avatar.svelte';
    import TeamBadge from '$components/TeamBadge.svelte';
    import CrownIcon from '$components/Icons/CrownIcon.svelte';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';

    let { data } = $props();
</script>

<SlideCard
    icon="🎭"
    heading="The Underdogs"
    description="Making Everyone Else Look Good">
    {#if data}
        <div class="mt-4 space-y-4">
            <!-- Team Badge and Session -->
            <AnimatedIn
                delay={0}
                type="fade"
                duration={400}>
                <a
                    href="/table?date={data.sessionDate}"
                    class="flex flex-col items-center justify-center gap-1 transition-opacity hover:opacity-80 md:gap-2">
                    <TeamBadge teamName={data.teamName} />
                    <div class="text-xs text-gray-600 md:text-sm dark:text-gray-400">
                        Session: {data.sessionDate}
                    </div>
                </a>
            </AnimatedIn>

            <!-- Players Grid (2 rows x 3 columns) -->
            <div class="grid grid-cols-3 gap-2">
                {#each data.players as player, index (index)}
                    <AnimatedIn
                        delay={200 + index * 100}
                        type="scale"
                        duration={400}>
                        <div
                            class="glass flex flex-col items-center gap-1 rounded-lg border border-gray-200 px-2 py-2 dark:border-gray-700">
                            <div class="shrink-0 leading-[0] [&>div]:block">
                                <Avatar
                                    avatarUrl={player.avatarUrl}
                                    size="sm" />
                            </div>
                            <div
                                class="text-center text-xs font-medium text-gray-900 dark:text-white">
                                {player.name}
                            </div>
                        </div>
                    </AnimatedIn>
                {/each}
            </div>

            <!-- League and Cup Records -->
            <div class="grid grid-cols-2 gap-2">
                <!-- League Record -->
                <AnimatedIn
                    delay={800}
                    type="scale"
                    duration={400}>
                    <div class="glass rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                        <div class="mb-2 flex items-center justify-center gap-1.5">
                            <CrownIcon
                                class="h-3 w-3 text-yellow-600 md:h-4 md:w-4 dark:text-yellow-400" />
                            <div
                                class="text-xs font-semibold text-yellow-600 md:text-sm dark:text-yellow-400">
                                League
                            </div>
                        </div>
                        <div class="flex items-end justify-center gap-1 text-xs">
                            <div class="flex flex-col items-center gap-0.5">
                                <div
                                    class="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                    PTS
                                </div>
                                <div class="font-bold text-gray-900 dark:text-white">
                                    {data.leagueRecord.wins * 3 + data.leagueRecord.draws}
                                </div>
                            </div>
                            <div class="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                            <div class="flex flex-col items-center gap-0.5">
                                <div
                                    class="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                    W
                                </div>
                                <div class="font-bold text-gray-900 dark:text-white">
                                    {data.leagueRecord.wins}
                                </div>
                            </div>
                            <div class="flex flex-col items-center gap-0.5">
                                <div
                                    class="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                    D
                                </div>
                                <div class="font-bold text-gray-900 dark:text-white">
                                    {data.leagueRecord.draws}
                                </div>
                            </div>
                            <div class="flex flex-col items-center gap-0.5">
                                <div
                                    class="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                    L
                                </div>
                                <div class="font-bold text-gray-900 dark:text-white">
                                    {data.leagueRecord.losses}
                                </div>
                            </div>
                            <div class="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                            <div class="flex flex-col items-center gap-0.5">
                                <div
                                    class="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                    GF
                                </div>
                                <div class="font-bold text-gray-900 dark:text-white">
                                    {data.leagueRecord.goalsFor}
                                </div>
                            </div>
                            <div class="flex flex-col items-center gap-0.5">
                                <div
                                    class="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                    GA
                                </div>
                                <div class="font-bold text-gray-900 dark:text-white">
                                    {data.leagueRecord.goalsAgainst}
                                </div>
                            </div>
                        </div>
                    </div>
                </AnimatedIn>

                <!-- Cup Record -->
                <AnimatedIn
                    delay={900}
                    type="scale"
                    duration={400}>
                    <div class="glass rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                        <div class="mb-2 flex items-center justify-center gap-1.5">
                            <TrophyIcon
                                class="h-3 w-3 text-orange-600 md:h-4 md:w-4 dark:text-orange-400" />
                            <div
                                class="text-xs font-semibold text-orange-600 md:text-sm dark:text-orange-400">
                                Cup
                            </div>
                        </div>
                        <div class="flex items-end justify-center gap-1 text-xs">
                            <div class="flex flex-col items-center gap-0.5">
                                <div
                                    class="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                    W
                                </div>
                                <div class="font-bold text-gray-900 dark:text-white">
                                    {data.cupRecord.wins}
                                </div>
                            </div>
                            <div class="flex flex-col items-center gap-0.5">
                                <div
                                    class="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                    D
                                </div>
                                <div class="font-bold text-gray-900 dark:text-white">
                                    {data.cupRecord.draws}
                                </div>
                            </div>
                            <div class="flex flex-col items-center gap-0.5">
                                <div
                                    class="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                    L
                                </div>
                                <div class="font-bold text-gray-900 dark:text-white">
                                    {data.cupRecord.losses}
                                </div>
                            </div>
                            <div class="mx-1 h-4 w-px bg-gray-300 dark:bg-gray-600"></div>
                            <div class="flex flex-col items-center gap-0.5">
                                <div
                                    class="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                    GF
                                </div>
                                <div class="font-bold text-gray-900 dark:text-white">
                                    {data.cupRecord.goalsFor}
                                </div>
                            </div>
                            <div class="flex flex-col items-center gap-0.5">
                                <div
                                    class="text-[10px] font-medium text-gray-500 dark:text-gray-400">
                                    GA
                                </div>
                                <div class="font-bold text-gray-900 dark:text-white">
                                    {data.cupRecord.goalsAgainst}
                                </div>
                            </div>
                        </div>
                    </div>
                </AnimatedIn>
            </div>
        </div>
    {:else}
        <div class="py-8 text-gray-500 dark:text-gray-400">No data available</div>
    {/if}
</SlideCard>

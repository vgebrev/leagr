<script>
    import { Toggle } from 'flowbite-svelte';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import CrownIcon from '$components/Icons/CrownIcon.svelte';

    let { playerData } = $props();

    let showMissedSessions = $state(false);

    /**
     * Format cup round name to human-readable label
     * @param {string|null} round - Raw round name from bracket
     * @returns {string} Display label
     */
    function formatCupRound(round) {
        if (!round) return null;

        switch (round) {
            case 'winner':
                return 'Cup Winner';
            case 'final':
                return 'Final';
            case 'semi':
                return 'Semi Finals';
            case 'quarter':
                return 'Quarter Finals';
            case 'round-of-16':
                return 'Round of 16';
            default:
                // Handle 'round-of-32', 'round-of-64', etc.
                if (round.startsWith('round-of-')) {
                    const num = round.replace('round-of-', '');
                    return `Round of ${num}`;
                }
                return round;
        }
    }

    /**
     * Calculate league position distribution from player details
     */
    const leagueDistribution = $derived.by(() => {
        const distribution = {};
        const appearances = (playerData.details || []).filter(
            (d) => d.played && d.leaguePosition !== null
        );

        appearances.forEach((detail) => {
            const position = detail.leaguePosition;
            distribution[position] = (distribution[position] || 0) + 1;
        });

        // Sort by position (1st, 2nd, 3rd, etc.)
        return Object.entries(distribution)
            .map(([position, count]) => ({ label: position, value: parseInt(position), count }))
            .sort((a, b) => a.value - b.value);
    });

    /**
     * Count missed league sessions (sessions where player didn't participate)
     */
    const leagueMissedCount = $derived.by(() => {
        return (playerData.details || []).filter((d) => !d.played).length;
    });

    /**
     * Calculate cup progress distribution from player details
     */
    const cupDistribution = $derived.by(() => {
        const distribution = {};
        const appearances = (playerData.details || []).filter(
            (d) => d.played && d.cupProgress !== null && d.cupProgress !== undefined
        );

        appearances.forEach((detail) => {
            const progress = detail.cupProgress;
            const label = formatCupRound(progress);
            if (label) {
                distribution[label] = (distribution[label] || 0) + 1;
            }
        });

        // Define order for cup rounds (furthest to earliest)
        const roundOrder = {
            'Cup Winner': 0,
            Final: 1,
            'Semi Finals': 2,
            'Quarter Finals': 3,
            'Round of 16': 4
        };

        return Object.entries(distribution)
            .map(([label, count]) => ({
                label,
                count,
                order: roundOrder[label] ?? 999
            }))
            .sort((a, b) => a.order - b.order);
    });

    /**
     * Count missed cup sessions (sessions where player didn't participate)
     */
    const cupMissedCount = $derived.by(() => {
        return (playerData.details || []).filter((d) => !d.played).length;
    });

    /**
     * Calculate longest streak of consecutive league wins
     */
    const longestLeagueStreak = $derived.by(() => {
        const details = (playerData.details || []).filter((d) => d.played);
        let currentStreak = 0;
        let maxStreak = 0;

        for (const detail of details) {
            if (detail.leaguePosition === 1) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        }

        return maxStreak;
    });

    /**
     * Calculate longest streak of consecutive cup wins
     */
    const longestCupStreak = $derived.by(() => {
        const details = (playerData.details || []).filter((d) => d.played);
        let currentStreak = 0;
        let maxStreak = 0;

        for (const detail of details) {
            if (detail.cupProgress === 'winner') {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 0;
            }
        }

        return maxStreak;
    });

    /**
     * Count number of times player won both league and cup in same session
     */
    const doubleWinnerCount = $derived.by(() => {
        return (playerData.details || []).filter(
            (d) => d.played && d.leaguePosition === 1 && d.cupProgress === 'winner'
        ).length;
    });

    const hasLeagueData = $derived(leagueDistribution.length > 0);
    const hasCupData = $derived(cupDistribution.length > 0);
    const hasStreakData = $derived(
        longestLeagueStreak > 0 || longestCupStreak > 0 || doubleWinnerCount > 0
    );

    /**
     * Render a simple SVG bar chart
     * @param {Array} data - Array of {label, count} objects
     * @param {number} missedCount - Count of missed sessions
     * @param {boolean} includeMissed - Whether to include missed sessions bar
     */
    function renderBarChart(data, missedCount, includeMissed) {
        const barHeight = 24;
        const barSpacing = 8;
        const itemCount = data.length + (includeMissed && missedCount > 0 ? 1 : 0);
        const chartHeight = itemCount * (barHeight + barSpacing);
        const chartWidth = 400;
        const labelWidth = 95;
        const maxBarWidth = chartWidth - labelWidth - 50;

        // Calculate max count including missed sessions if enabled
        const counts = data.map((d) => d.count);
        if (includeMissed && missedCount > 0) {
            counts.push(missedCount);
        }
        const maxCount = Math.max(...counts, 1);

        return {
            barHeight,
            barSpacing,
            chartHeight,
            chartWidth,
            labelWidth,
            maxBarWidth,
            maxCount
        };
    }

    const leagueChartData = $derived(
        hasLeagueData
            ? renderBarChart(leagueDistribution, leagueMissedCount, showMissedSessions)
            : null
    );

    const cupChartData = $derived(
        hasCupData ? renderBarChart(cupDistribution, cupMissedCount, showMissedSessions) : null
    );
</script>

<div class="mb-2">
    <div class="mb-2 flex items-center justify-between">
        <h2 class="text-lg font-semibold">Performance</h2>
        {#if hasLeagueData || hasCupData}
            <div class="flex items-center gap-1">
                <Toggle
                    bind:checked={showMissedSessions}
                    size="small"
                    class="text-xs font-normal"
                    >{#snippet offLabel()}
                        Show missed sessions{/snippet}
                </Toggle>
            </div>
        {/if}
    </div>

    {#if !hasLeagueData && !hasCupData && !hasStreakData}
        <div class="py-8 text-center text-gray-400 dark:text-gray-300">
            No performance data available for this player.
        </div>
    {:else}
        <!-- Distribution Charts -->
        <div class="grid gap-2 sm:grid-cols-2">
            <!-- League Position Chart -->
            {#if hasLeagueData}
                <div class="glass rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                    <h3
                        class="mb-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                        League Position Finishes
                    </h3>
                    <svg
                        width="100%"
                        height={leagueChartData.chartHeight}
                        viewBox="0 0 {leagueChartData.chartWidth} {leagueChartData.chartHeight}"
                        class="overflow-visible">
                        {#each leagueDistribution as item, i (i)}
                            {@const y =
                                i * (leagueChartData.barHeight + leagueChartData.barSpacing)}
                            {@const barWidth =
                                (item.count / leagueChartData.maxCount) *
                                leagueChartData.maxBarWidth}

                            <!-- Label -->
                            <text
                                x={leagueChartData.labelWidth - 10}
                                y={y + leagueChartData.barHeight / 2}
                                text-anchor="end"
                                dominant-baseline="middle"
                                class="fill-gray-700 text-sm dark:fill-gray-300">
                                {item.label}{item.value === 1
                                    ? 'st'
                                    : item.value === 2
                                      ? 'nd'
                                      : item.value === 3
                                        ? 'rd'
                                        : 'th'}
                            </text>

                            <!-- Bar -->
                            <rect
                                x={leagueChartData.labelWidth}
                                {y}
                                width={barWidth}
                                height={leagueChartData.barHeight}
                                class="fill-primary-500"
                                rx="10"
                                ry="10" />

                            <!-- Count label -->
                            <text
                                x={leagueChartData.labelWidth + barWidth + 8}
                                y={y + leagueChartData.barHeight / 2}
                                dominant-baseline="middle"
                                class="fill-gray-700 text-sm font-medium dark:fill-gray-200">
                                {item.count}
                            </text>
                        {/each}

                        <!-- Missed Sessions Bar (if enabled and has missed sessions) -->
                        {#if showMissedSessions && leagueMissedCount > 0}
                            {@const i = leagueDistribution.length}
                            {@const y =
                                i * (leagueChartData.barHeight + leagueChartData.barSpacing)}
                            {@const barWidth =
                                (leagueMissedCount / leagueChartData.maxCount) *
                                leagueChartData.maxBarWidth}

                            <!-- Label -->
                            <text
                                x={leagueChartData.labelWidth - 10}
                                y={y + leagueChartData.barHeight / 2}
                                text-anchor="end"
                                dominant-baseline="middle"
                                class="fill-gray-700 text-sm dark:fill-gray-300">
                                Missed
                            </text>

                            <!-- Dashed Bar -->
                            <rect
                                x={leagueChartData.labelWidth}
                                {y}
                                width={barWidth}
                                height={leagueChartData.barHeight}
                                class="fill-gray-200/70 dark:fill-gray-700"
                                rx="10"
                                ry="10" />

                            <!-- Count label -->
                            <text
                                x={leagueChartData.labelWidth + barWidth + 8}
                                y={y + leagueChartData.barHeight / 2}
                                dominant-baseline="middle"
                                class="fill-gray-700 text-sm font-medium dark:fill-gray-200">
                                {leagueMissedCount}
                            </text>
                        {/if}
                    </svg>
                </div>
            {/if}

            <!-- Cup Progress Chart -->
            {#if hasCupData}
                <div class="glass rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                    <h3
                        class="mb-3 text-center text-sm font-medium text-gray-700 dark:text-gray-300">
                        Cup Progress
                    </h3>
                    <svg
                        width="100%"
                        height={cupChartData.chartHeight}
                        viewBox="0 0 {cupChartData.chartWidth} {cupChartData.chartHeight}"
                        class="overflow-visible">
                        {#each cupDistribution as item, i (i)}
                            {@const y = i * (cupChartData.barHeight + cupChartData.barSpacing)}
                            {@const barWidth =
                                (item.count / cupChartData.maxCount) * cupChartData.maxBarWidth}

                            <!-- Label -->
                            <text
                                x={cupChartData.labelWidth - 10}
                                y={y + cupChartData.barHeight / 2}
                                text-anchor="end"
                                dominant-baseline="middle"
                                class="fill-gray-700 text-sm dark:fill-gray-300">
                                {item.label}
                            </text>

                            <!-- Bar -->
                            <rect
                                x={cupChartData.labelWidth}
                                {y}
                                width={barWidth}
                                height={cupChartData.barHeight}
                                class="fill-primary-500"
                                rx="10"
                                ry="10" />

                            <!-- Count label -->
                            <text
                                x={cupChartData.labelWidth + barWidth + 8}
                                y={y + cupChartData.barHeight / 2}
                                dominant-baseline="middle"
                                class="fill-gray-700 text-sm font-medium dark:fill-gray-200">
                                {item.count}
                            </text>
                        {/each}

                        <!-- Missed Sessions Bar (if enabled and has missed sessions) -->
                        {#if showMissedSessions && cupMissedCount > 0}
                            {@const i = cupDistribution.length}
                            {@const y = i * (cupChartData.barHeight + cupChartData.barSpacing)}
                            {@const barWidth =
                                (cupMissedCount / cupChartData.maxCount) * cupChartData.maxBarWidth}

                            <!-- Label -->
                            <text
                                x={cupChartData.labelWidth - 10}
                                y={y + cupChartData.barHeight / 2}
                                text-anchor="end"
                                dominant-baseline="middle"
                                class="fill-gray-700 text-sm dark:fill-gray-300">
                                Missed
                            </text>

                            <!-- Dashed Bar -->
                            <rect
                                x={cupChartData.labelWidth}
                                {y}
                                width={barWidth}
                                height={cupChartData.barHeight}
                                class="fill-gray-200/70 dark:fill-gray-700"
                                rx="10"
                                ry="10" />

                            <!-- Count label -->
                            <text
                                x={cupChartData.labelWidth + barWidth + 8}
                                y={y + cupChartData.barHeight / 2}
                                dominant-baseline="middle"
                                class="fill-gray-700 text-sm font-medium dark:fill-gray-200">
                                {cupMissedCount}
                            </text>
                        {/if}
                    </svg>
                </div>
            {/if}
        </div>

        <!-- Achievements Section -->
        <div class="glass mt-2 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
            <div class="grid grid-cols-2 gap-2 md:grid-cols-3">
                <div class="text-center">
                    <div
                        class="shrink-0 overflow-hidden text-sm text-nowrap text-ellipsis text-gray-600 dark:text-gray-300">
                        Longest League Win Streak
                    </div>
                    <div class="flex items-center justify-center gap-1">
                        <CrownIcon class="h-5 w-5 text-yellow-500" />
                        <div class="text-2xl font-bold dark:text-gray-200">
                            {longestLeagueStreak}
                        </div>
                    </div>
                </div>
                <div class="text-center">
                    <div
                        class="shrink-0 overflow-hidden text-sm text-nowrap text-ellipsis text-gray-600 dark:text-gray-300">
                        Longest Cup Win Streak
                    </div>
                    <div class="flex items-center justify-center gap-1">
                        <TrophyIcon class="h-5 w-5 text-amber-600" />
                        <div class="text-2xl font-bold dark:text-gray-200">
                            {longestCupStreak}
                        </div>
                    </div>
                </div>
                <div class="col-span-2 text-center md:col-span-1">
                    <div class="text-sm text-gray-600 dark:text-gray-300">Doubles</div>
                    <div class="text-2xl font-bold dark:text-gray-200">
                        {doubleWinnerCount}
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>

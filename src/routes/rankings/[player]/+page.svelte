<script>
    import { Card, Badge } from 'flowbite-svelte';
    import TeamBadge from '$components/TeamBadge.svelte';
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import { goto } from '$app/navigation';
    import { onMount } from 'svelte';

    let { data } = $props();
    const { player, playerData } = data;

    let celebrating = $state(false);
    let scrollContainer = $state();

    /**
     * Format date for display
     * @param {string} date - Date in YYYY-MM-DD format
     * @returns {string} Formatted date
     */
    function formatDate(date) {
        return new Date(date).toLocaleDateString('en-GB', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    /**
     * Navigate to table page for a specific date
     * @param {string} date - Date in YYYY-MM-DD format
     */
    function goToTableDate(date) {
        goto(`/table?date=${date}`);
    }

    /**
     * Generate SVG path for the rank progression line
     */
    function generateLinePath(progression, width, height, maxRank) {
        if (!progression || progression.length < 2) return '';

        const points = progression.map((point, index) => {
            const x = (index / (progression.length - 1)) * width;
            // Invert Y axis so lower ranks (higher numbers) are at top
            const y = ((point.rank - 1) / (maxRank - 1)) * height;
            return `${x},${y}`;
        });

        return `M ${points.join(' L ')}`;
    }

    /**
     * Trigger celebration if player is #1 and scroll chart to latest data
     */
    onMount(() => {
        if (playerData.rank === 1) {
            celebrating = true;
        }

        // Scroll chart to show latest data (right side)
        if (scrollContainer) {
            scrollContainer.scrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        }
    });
</script>

<svelte:head>
    <title>{player} - Player Rankings Detail | Leagr</title>
</svelte:head>

<div class="container mx-auto">
    <!-- Header -->
    <div class="mb-4">
        <h1 class="text-2xl font-bold">{player}</h1>
        <p class="text-gray-600">Ranking Detail History</p>
    </div>

    <!-- Player Summary Card -->
    <div class="mb-6">
        <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div class="text-center">
                <div class="text-sm text-gray-600 dark:text-gray-400">Current Rank</div>
                <div class="text-2xl font-bold">#{playerData.rank}</div>
            </div>
            <div class="text-center">
                <div class="text-sm text-gray-600 dark:text-gray-400">Ranking Points</div>
                <div class="text-2xl font-bold">{playerData.rankingPoints}</div>
            </div>
            <div class="text-center">
                <div class="text-sm text-gray-600 dark:text-gray-400">Total Points</div>
                <div class="text-2xl font-bold">{playerData.points}</div>
            </div>
            <div class="text-center">
                <div class="text-sm text-gray-600 dark:text-gray-400">Appearances</div>
                <div class="text-2xl font-bold">{playerData.appearances}</div>
            </div>
        </div>

        {#if playerData.rawAverage && playerData.weightedAverage}
            <div
                class="mt-4 grid grid-cols-3 gap-4 border-t border-t-gray-200 pt-4 dark:border-t-gray-700">
                <div class="text-center">
                    <div class="text-sm text-gray-600 dark:text-gray-400">Raw Average</div>
                    <div class="text-lg font-semibold">{playerData.rawAverage}</div>
                </div>
                <div class="text-center">
                    <div class="text-sm text-gray-600 dark:text-gray-400">Weighted Average</div>
                    <div class="text-lg font-semibold">{playerData.weightedAverage}</div>
                </div>
                <div class="text-center">
                    <div class="text-sm text-gray-600 dark:text-gray-400">Full Confidence</div>
                    <div class="text-lg font-semibold">
                        {playerData.hasFullConfidence
                            ? 'Yes'
                            : `${playerData.gamesUntilFullConfidence} more`}
                    </div>
                </div>
            </div>
        {/if}
    </div>

    <!-- Rank Progression Chart -->
    {#if playerData.rankProgression && playerData.rankProgression.length > 1}
        {@const maxRank = Math.max(...playerData.rankProgression.map((p) => p.totalPlayers))}
        {@const chartWidth = 400}
        {@const chartHeight = 200}
        {@const padding = { top: 20, right: 20, bottom: 40, left: 40 }}
        {@const linePath = generateLinePath(
            playerData.rankProgression,
            chartWidth,
            chartHeight,
            maxRank
        )}
        <div class="mb-6">
            <h2 class="mb-4 text-xl font-semibold">Rank Progression</h2>
            <div
                class="w-full rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
                <div
                    class="overflow-x-auto"
                    bind:this={scrollContainer}>
                    <svg
                        width={Math.max(
                            chartWidth + padding.left + padding.right,
                            playerData.rankProgression.length * 60
                        )}
                        height={chartHeight + padding.top + padding.bottom}
                        class="min-w-full">
                        <!-- Y-axis labels (ranks) -->
                        {#each Array.from({ length: Math.min(10, maxRank) }, (_, i) => {
                            if (maxRank <= 10) {
                                return i + 1;
                            } else {
                                return i === 0 ? 1 : Math.round(1 + (i * (maxRank - 1)) / 9);
                            }
                        }) as rank, i (i)}
                            {@const y = padding.top + ((rank - 1) / (maxRank - 1)) * chartHeight}
                            <text
                                x={padding.left - 5}
                                y={y + 4}
                                class="fill-gray-600 text-xs dark:fill-gray-400"
                                text-anchor="end">
                                {rank}
                            </text>
                            <line
                                x1={padding.left}
                                y1={y}
                                x2={padding.left + chartWidth}
                                y2={y}
                                stroke="currentColor"
                                stroke-opacity="0.1"
                                stroke-width="1" />
                            <!-- Right-side rank labels -->
                            <text
                                x={padding.left + chartWidth + 5}
                                y={y + 4}
                                class="fill-gray-600 text-xs dark:fill-gray-400"
                                text-anchor="start">
                                {rank}
                            </text>
                        {/each}

                        <!-- Chart area -->
                        <g transform="translate({padding.left}, {padding.top})">
                            <!-- Rank progression line -->
                            <path
                                d={linePath}
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                class="text-blue-500" />

                            <!-- Data points -->
                            {#each playerData.rankProgression as point, index (index)}
                                {@const x =
                                    (index / (playerData.rankProgression.length - 1)) * chartWidth}
                                {@const y = ((point.rank - 1) / (maxRank - 1)) * chartHeight}
                                <circle
                                    cx={x}
                                    cy={y}
                                    r="4"
                                    fill="currentColor"
                                    class="text-blue-500">
                                    <title>
                                        {formatDate(point.date)}: Rank #{point.rank} ({point.points}
                                        pts)
                                    </title>
                                </circle>
                                <!-- Rank number label -->
                                <text
                                    {x}
                                    y={y - 8}
                                    class="fill-gray-700 text-xs font-medium dark:fill-gray-300"
                                    text-anchor="middle">
                                    {point.rank}
                                </text>
                            {/each}
                        </g>

                        <!-- X-axis labels (dates) -->
                        {#each playerData.rankProgression as point, index (index)}
                            {@const x =
                                padding.left +
                                (index / (playerData.rankProgression.length - 1)) * chartWidth}
                            <text
                                {x}
                                y={chartHeight + padding.top + 20}
                                class="fill-gray-600 text-xs dark:fill-gray-400"
                                text-anchor="middle"
                                transform="rotate(-45, {x}, {chartHeight + padding.top + 20})">
                                {new Date(point.date).toLocaleDateString('en-GB', {
                                    month: 'short',
                                    day: 'numeric'
                                })}
                            </text>
                        {/each}
                    </svg>
                </div>

                <div class="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
                    Historical rank progression over {playerData.rankProgression.length} appearances
                </div>
            </div>
        </div>
    {/if}

    <!-- Detailed History -->
    <div>
        <div class="mb-4">
            <h2 class="text-xl font-semibold">Appearance History</h2>
            <p class="text-sm text-gray-600 dark:text-gray-400">
                Detailed breakdown of points earned per appearance
            </p>
        </div>

        {#if playerData.sortedDetails.length === 0}
            <div class="py-8 text-center text-gray-500 dark:text-gray-400">
                No appearance data found for this player.
            </div>
        {:else}
            <!-- Session Cards Grid -->
            <div class="grid gap-4 sm:grid-cols-2">
                {#each playerData.sortedDetails as detail (detail.date)}
                    <Card class="p-4">
                        <!-- Date and Team Header -->
                        <div class="mb-3 flex items-center justify-between gap-2">
                            <div class="shrink-0 text-sm font-semibold">
                                {formatDate(detail.date)}
                            </div>
                            <div class="flex w-full items-center justify-end space-x-2">
                                <button
                                    type="button"
                                    class="cursor-pointer transition-opacity hover:opacity-80"
                                    onclick={() => goToTableDate(detail.date)}
                                    title="View table for {formatDate(detail.date)}">
                                    <TeamBadge
                                        teamName={detail.team}
                                        className="text-sm w-full" />
                                </button>
                            </div>
                        </div>

                        <!-- Points Breakdown -->
                        <div class="space-y-2">
                            {#if detail.appearancePoints > 0}
                                <div class="flex justify-between text-sm">
                                    <span class="text-gray-600 dark:text-gray-400"
                                        >Appearance:</span>
                                    <Badge color="gray">
                                        +{detail.appearancePoints}
                                    </Badge>
                                </div>
                            {/if}

                            {#if detail.matchPoints > 0}
                                <div class="flex justify-between text-sm">
                                    <span class="text-gray-600 dark:text-gray-400"
                                        >Match Points:</span>
                                    <Badge color="gray">
                                        +{detail.matchPoints}
                                    </Badge>
                                </div>
                            {/if}

                            {#if detail.bonusPoints > 0}
                                <div class="flex justify-between text-sm">
                                    <span class="text-gray-600 dark:text-gray-400"
                                        >Bonus Points:</span>
                                    <Badge color="gray">
                                        +{detail.bonusPoints}
                                    </Badge>
                                </div>
                            {/if}

                            {#if detail.knockoutPoints > 0}
                                <div class="flex justify-between text-sm">
                                    <span class="text-gray-600 dark:text-gray-400"
                                        >Knockout Points:</span>
                                    <Badge color="gray">
                                        +{detail.knockoutPoints}
                                    </Badge>
                                </div>
                            {/if}
                        </div>

                        <!-- Total -->
                        <div
                            class="mt-2 flex justify-between border-t border-t-gray-200 pt-2 font-semibold dark:border-t-gray-700">
                            <span>Total:</span>
                            <Badge
                                color="gray"
                                class="font-bold">
                                {detail.totalPoints}
                            </Badge>
                        </div>
                    </Card>
                {/each}
            </div>

            <!-- Summary Footer -->
            <div class="mt-4 border-t border-t-gray-200 pt-4 dark:border-t-gray-700">
                <div class="grid grid-cols-5 gap-4 text-sm">
                    <div class="text-center">
                        <div class="text-gray-600 dark:text-gray-400">Total Appearance</div>
                        <div class="font-semibold">
                            {playerData.sortedDetails.reduce(
                                (sum, d) => sum + d.appearancePoints,
                                0
                            )}
                        </div>
                    </div>
                    <div class="text-center">
                        <div class="text-gray-600 dark:text-gray-400">Total Match</div>
                        <div class="font-semibold">
                            {playerData.sortedDetails.reduce((sum, d) => sum + d.matchPoints, 0)}
                        </div>
                    </div>
                    <div class="text-center">
                        <div class="text-gray-600 dark:text-gray-400">Total Bonus</div>
                        <div class="font-semibold">
                            {playerData.sortedDetails.reduce((sum, d) => sum + d.bonusPoints, 0)}
                        </div>
                    </div>
                    <div class="text-center">
                        <div class="text-gray-600 dark:text-gray-400">Total Knockout</div>
                        <div class="font-semibold">
                            {playerData.sortedDetails.reduce((sum, d) => sum + d.knockoutPoints, 0)}
                        </div>
                    </div>
                    <div class="text-center">
                        <div class="text-gray-600 dark:text-gray-400">Grand Total</div>
                        <div class="font-semibold">
                            {playerData.points}
                        </div>
                    </div>
                </div>
            </div>
        {/if}
    </div>
</div>

<CelebrationOverlay
    bind:celebrating
    teamName={player}
    teamColour="default"
    icon="🥇"
    confettiColours={['#efb100', '#fff085']} />

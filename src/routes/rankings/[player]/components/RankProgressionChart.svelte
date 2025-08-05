<script>
    import { onMount } from 'svelte';
    import { Tooltip } from 'flowbite-svelte';

    let { playerData } = $props();
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
     * Scroll chart to show latest data
     */
    onMount(() => {
        // Scroll chart to show latest data (right side)
        if (scrollContainer) {
            scrollContainer.scrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        }
    });
</script>

{#if playerData.rankProgression && playerData.rankProgression.length > 1}
    {@const maxRank = Math.max(...playerData.rankProgression.map((p) => p.totalPlayers))}
    {@const chartHeight = 200}
    {@const segmentWidth = 60}
    {@const appearanceCount = playerData.rankProgression.length}
    {@const naturalWidth = appearanceCount * segmentWidth}
    {@const minChartWidth = appearanceCount <= 5 ? naturalWidth : 400}
    {@const chartWidth = Math.max(minChartWidth, naturalWidth)}
    {@const padding = { top: 20, right: 30, bottom: 40, left: 30 }}
    <div class="mb-4">
        <h2 class="mb-4 text-lg font-semibold">Rank Progression</h2>
        <div
            class="w-full rounded-lg border border-gray-200 bg-white p-4 shadow-lg dark:border-gray-700 dark:bg-gray-800">
            <div
                class="overflow-x-auto"
                bind:this={scrollContainer}>
                <svg
                    width={chartWidth + padding.left + padding.right}
                    height={chartHeight + padding.top + padding.bottom}
                    class={appearanceCount <= 5 ? 'w-full' : 'min-w-full'}>
                    <!-- Y-axis grid lines and labels -->
                    {#each [1, ...Array.from({ length: Math.floor(maxRank / 5) }, (_, i) => (i + 1) * 5).filter((rank) => rank <= maxRank)] as rank, i (i)}
                        {@const y = padding.top + ((rank - 1) / (maxRank - 1)) * chartHeight}
                        {@const isMultipleOf10 = rank === 1 || rank % 10 === 0}
                        {@const isMultipleOf5 = rank % 5 === 0 && !isMultipleOf10}

                        <!-- Show labels only for 1, 10, 20, etc. -->
                        {#if isMultipleOf10}
                            <!-- Left-side rank labels -->
                            <text
                                x={padding.left - 15}
                                y={y + 4}
                                class="fill-gray-600 text-xs dark:fill-gray-400"
                                text-anchor="end">
                                {rank}
                            </text>
                            <!-- Right-side rank labels -->
                            <text
                                x={padding.left + chartWidth + 15}
                                y={y + 4}
                                class="fill-gray-600 text-xs dark:fill-gray-400"
                                text-anchor="start">
                                {rank}
                            </text>
                        {/if}

                        <!-- Grid lines: solid for 1,10,20... dotted for 5,15,25... -->
                        <line
                            x1={padding.left}
                            y1={y}
                            x2={padding.left + chartWidth}
                            y2={y}
                            stroke="currentColor"
                            stroke-opacity="0.1"
                            stroke-width="1"
                            stroke-dasharray={isMultipleOf5 ? '2,2' : 'none'} />
                    {/each}

                    <!-- Chart area -->
                    <g transform="translate({padding.left}, {padding.top})">
                        <!-- Rank progression lines (individual segments) -->
                        {#each playerData.rankProgression.slice(0, -1) as point, index (point.date)}
                            {@const nextPoint = playerData.rankProgression[index + 1]}
                            {@const x1 =
                                (index / (playerData.rankProgression.length - 1)) * chartWidth}
                            {@const y1 = ((point.rank - 1) / (maxRank - 1)) * chartHeight}
                            {@const x2 =
                                ((index + 1) / (playerData.rankProgression.length - 1)) *
                                chartWidth}
                            {@const y2 = ((nextPoint.rank - 1) / (maxRank - 1)) * chartHeight}
                            {@const currentPlayed = point.played !== false}
                            {@const nextPlayed = nextPoint.played !== false}
                            {@const segmentIsGray = !currentPlayed || !nextPlayed}
                            <line
                                {x1}
                                {y1}
                                {x2}
                                {y2}
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-dasharray={segmentIsGray ? '4,4' : 'none'}
                                class="text-primary-500" />
                        {/each}

                        <!-- Data points -->
                        {#each playerData.rankProgression as point, index (index)}
                            {@const x =
                                (index / (playerData.rankProgression.length - 1)) * chartWidth}
                            {@const y = ((point.rank - 1) / (maxRank - 1)) * chartHeight}
                            {@const played = point.played !== false}
                            <!-- Default to true for backward compatibility -->
                            <circle
                                cx={x}
                                cy={y}
                                r="4"
                                fill={played ? 'currentColor' : 'white'}
                                class={played
                                    ? 'text-primary-700 dark:text-primary-700'
                                    : 'dark:fill-gray-800'}
                                stroke={played ? 'none' : 'currentColor'}
                                stroke-width={played ? '0' : '2'}
                                id="chart-point-{index}">
                            </circle>
                            <Tooltip triggeredBy="#chart-point-{index}">
                                {formatDate(point.date)}: Rank #{point.rank} ({point.points}
                                pts) {played ? '' : '(No appearance)'}
                            </Tooltip>
                            <!-- Rank number label -->
                            <text
                                {x}
                                y={y - 8}
                                class={played
                                    ? 'fill-gray-700 text-xs font-medium dark:fill-gray-300'
                                    : 'fill-gray-400 text-xs font-medium dark:fill-gray-500'}
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
                Complete rank progression over {playerData.rankProgression.length} sessions
                <br />
                <span class="text-xs">Filled circles: played • Empty circles: missed session</span>
            </div>
        </div>
    </div>
{/if}

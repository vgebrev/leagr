<script>
    import { onMount } from 'svelte';
    import RankProgressionChartNode from './RankProgressionChartNode.svelte';

    let { playerData } = $props();

    // Use details for chart progression (already in chronological order)
    const progression = $derived(playerData.details || []);
    let scrollContainer = $state();

    /**
     * Scroll chart to show the latest data
     */
    onMount(() => {
        if (scrollContainer) {
            scrollContainer.scrollLeft = scrollContainer.scrollWidth - scrollContainer.clientWidth;
        }
    });
</script>

{#if progression && progression.length > 1}
    {@const maxRank = Math.max(...progression.map((p) => p.totalPlayers))}
    {@const chartHeight = 200}
    {@const segmentWidth = 60}
    {@const appearanceCount = progression.length}
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
                        {#each progression.slice(0, -1) as point, index (point.date)}
                            {@const nextPoint = progression[index + 1]}
                            {@const x1 = (index / (progression.length - 1)) * chartWidth}
                            {@const y1 = ((point.rank - 1) / (maxRank - 1)) * chartHeight}
                            {@const x2 = ((index + 1) / (progression.length - 1)) * chartWidth}
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
                        {#each progression as point, index (point.date)}
                            {@const x = (index / (progression.length - 1)) * chartWidth}
                            {@const y = ((point.rank - 1) / (maxRank - 1)) * chartHeight}
                            <RankProgressionChartNode
                                {point}
                                {x}
                                {y} />
                        {/each}
                    </g>

                    <!-- X-axis labels (dates) -->
                    {#each progression as point, index (point.date)}
                        {@const x = padding.left + (index / (progression.length - 1)) * chartWidth}
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
                Complete rank progression over {progression.length} sessions
                <br />
                <span class="text-xs">Filled circles: played • Empty circles: missed session</span>
            </div>
        </div>
    </div>
{/if}

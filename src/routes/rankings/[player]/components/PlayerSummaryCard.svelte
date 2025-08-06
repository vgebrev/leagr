<script>
    import { Tooltip } from 'flowbite-svelte';
    import { AngleUpOutline, AngleDownOutline, MinusOutline } from 'flowbite-svelte-icons';
    import { scale } from 'svelte/transition';

    let { playerData } = $props();
</script>

<div
    class="mb-2 w-full rounded-lg border border-gray-200 bg-white p-2 shadow-lg dark:border-gray-700 dark:bg-gray-800">
    <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div class="text-center">
            <div class="text-sm text-gray-600 dark:text-gray-400">Current Rank</div>
            <div class="flex items-center justify-center gap-2">
                <div class="text-2xl font-bold">#{playerData.rank}</div>
                {#if playerData.rankMovement > 0}
                    <span
                        class="flex items-center text-sm text-green-500"
                        id="player-rank-up">
                        <AngleUpOutline class="h-4 w-4 shrink-0" /><sub
                            >{playerData.rankMovement}</sub>
                    </span>
                    <Tooltip
                        class="shadow-lg"
                        triggeredBy="#player-rank-up"
                        transition={scale}>Moved up {playerData.rankMovement} places</Tooltip>
                {:else if playerData.rankMovement < 0}
                    <span
                        class="flex items-center text-sm text-red-500"
                        id="player-rank-down">
                        <AngleDownOutline class="h-4 w-4 shrink-0" /><sub
                            >{Math.abs(playerData.rankMovement)}</sub>
                    </span>
                    <Tooltip
                        class="shadow-lg"
                        triggeredBy="#player-rank-down"
                        transition={scale}
                        >Moved down {Math.abs(playerData.rankMovement)} places</Tooltip>
                {:else}
                    <span
                        class="text-sm text-gray-500"
                        id="player-rank-same"><MinusOutline class="h-4 w-4 shrink-0" /></span>
                    <Tooltip
                        class="shadow-lg"
                        triggeredBy="#player-rank-same"
                        transition={scale}>No rank movement</Tooltip>
                {/if}
            </div>
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
        <div class="mt-2 grid grid-cols-3 border-t border-t-gray-200 pt-2 dark:border-t-gray-700">
            <div class="text-center">
                <div class="text-sm text-gray-600 dark:text-gray-400">Raw Average</div>
                <div class="text-lg font-semibold">{playerData.rawAverage}</div>
            </div>
            <div class="text-center">
                <div
                    class="shrink-0 overflow-hidden text-sm text-nowrap text-ellipsis text-gray-600 dark:text-gray-400">
                    Weighted Average
                </div>
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

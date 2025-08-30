<script>
    import { TableBodyCell, TableBodyRow, Tooltip } from 'flowbite-svelte';
    import { AngleUpOutline, AngleDownOutline, MinusOutline } from 'flowbite-svelte-icons';
    import { goto } from '$app/navigation';
    import { page } from '$app/state';
    import { scale } from 'svelte/transition';

    let { player, data, index, currentSort, onSortChange } = $props();

    let showRankMovement = $derived(currentSort === 'rankingPoints');
    /**
     * Sanitize player name for use as CSS selector ID
     * @param {string} name - Player name
     * @returns {string} - Sanitized name safe for CSS selectors
     */
    function sanitizeId(name) {
        return name.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9-_]/g, '');
    }

    function handlePlayerClick() {
        // Navigate to player detail page, preserving date query parameter
        const dateParam = page.url.searchParams.get('date');
        const url = dateParam ? `/rankings/${player}?date=${dateParam}` : `/rankings/${player}`;
        goto(url);
    }

    /** Handles sorting when a column header is clicked.
     * @param {string} sortBy - The column to sort by.
     */
    function handleSort(sortBy) {
        if (onSortChange) {
            onSortChange(sortBy);
        }
    }

    /** Returns the class for the sort column header.
     * @param {string} sortBy - The column to check.
     * @returns {string} The class string for the column header.
     */
    function getSortClass(sortBy) {
        return `cursor-default px-1 py-1.5 text-center ${currentSort === sortBy ? 'font-bold text-gray-900 dark:text-gray-100' : ''}`;
    }
</script>

<TableBodyRow>
    <TableBodyCell class="px-1 py-1.5 text-center">
        <div class="flex items-center justify-evenly gap-1">
            <span>{index + 1}</span>
            {#if showRankMovement}
                {#if data.rankMovement > 0}
                    <span
                        class="flex items-center text-xs text-green-500"
                        id="rank-up-{sanitizeId(player)}">
                        <AngleUpOutline class="h-4 w-4 shrink-0" /><sub>{data.rankMovement}</sub>
                    </span>
                    <Tooltip
                        class="shadow-lg"
                        triggeredBy="#rank-up-{sanitizeId(player)}"
                        transition={scale}>Moved up {data.rankMovement} places</Tooltip>
                {:else if data.rankMovement < 0}
                    <span
                        class="flex items-center text-xs text-red-500"
                        id="rank-down-{sanitizeId(player)}">
                        <AngleDownOutline class="h-4 w-4 shrink-0" /><sub
                            >{Math.abs(data.rankMovement)}</sub>
                    </span>
                    <Tooltip
                        class="shadow-lg"
                        triggeredBy="#rank-down-{sanitizeId(player)}"
                        transition={scale}>Moved down {Math.abs(data.rankMovement)} places</Tooltip>
                {:else}
                    <span
                        class="text-xs text-gray-500"
                        id="rank-same-{sanitizeId(player)}"
                        ><MinusOutline class="h-4 w-4 shrink-0" /></span>
                    <Tooltip
                        class="shadow-lg"
                        triggeredBy="#rank-same-{sanitizeId(player)}"
                        transition={scale}>No rank movement</Tooltip>
                {/if}
            {/if}
        </div>
    </TableBodyCell>
    <TableBodyCell class="text-bold flex max-w-24 overflow-hidden px-1 py-1.5 font-bold">
        <span
            class="cursor-pointer overflow-hidden text-ellipsis whitespace-nowrap text-gray-900 hover:underline dark:text-gray-100"
            role="button"
            tabindex="0"
            onclick={handlePlayerClick}
            onkeydown={handlePlayerClick}>{player}</span>
    </TableBodyCell>
    <TableBodyCell class={getSortClass('appearances')}>
        <span
            role="button"
            aria-label="Sort by appearances"
            tabindex="0"
            onkeydown={() => handleSort('appearances')}
            onclick={() => handleSort('appearances')}>
            {data.appearances}</span>
    </TableBodyCell>
    <TableBodyCell class={getSortClass('elo')}>
        <span
            class="w-full"
            role="button"
            aria-label="Sort by ELO rating"
            tabindex="0"
            onkeydown={() => handleSort('elo')}
            onclick={() => handleSort('elo')}>
            {data.elo?.rating ? Math.round(data.elo.rating) : '-'}</span>
    </TableBodyCell>
    <TableBodyCell class="hidden md:table-cell {getSortClass('points')}">
        <span
            class="w-full"
            role="button"
            aria-label="Sort by total points"
            tabindex="0"
            onkeydown={() => handleSort('points')}
            onclick={() => handleSort('points')}>{data.points}</span>
    </TableBodyCell>
    <TableBodyCell class="hidden md:table-cell {getSortClass('rawAverage')}">
        <span
            class="w-full"
            role="button"
            aria-label="Sort by raw average"
            tabindex="0"
            onkeydown={() => handleSort('rawAverage')}
            onclick={() => handleSort('rawAverage')}>
            {data.rawAverage}</span>
    </TableBodyCell>
    <TableBodyCell class={getSortClass('rankingPoints')}>
        <span
            class="w-full"
            role="button"
            aria-label="Sort by ranking points"
            tabindex="0"
            onkeydown={() => handleSort('rankingPoints')}
            onclick={() => handleSort('rankingPoints')}>
            {data.rankingPoints}</span>
    </TableBodyCell>
</TableBodyRow>

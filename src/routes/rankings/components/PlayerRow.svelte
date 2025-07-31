<script>
    import { TableBodyCell, TableBodyRow } from 'flowbite-svelte';

    let { player, data, index, currentSort, onPlayerClick, onSortChange } = $props();

    function handlePlayerClick() {
        if (onPlayerClick) {
            onPlayerClick(index);
        }
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
        return `cursor-default px-1 py-1.5 text-center ${currentSort === sortBy ? 'font-bold text-black dark:text-white' : ''}`;
    }
</script>

<TableBodyRow>
    <TableBodyCell class="px-1 py-1.5 text-center">
        {index + 1}
    </TableBodyCell>
    <TableBodyCell class="text-bold flex px-1 py-1.5 font-bold text-black dark:text-white">
        <span
            class="w-full"
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
    <TableBodyCell class={getSortClass('points')}>
        <span
            class="w-full"
            role="button"
            aria-label="Sort by total points"
            tabindex="0"
            onkeydown={() => handleSort('points')}
            onclick={() => handleSort('points')}>{data.points}</span>
    </TableBodyCell>
    <TableBodyCell class={getSortClass('rawAverage')}>
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

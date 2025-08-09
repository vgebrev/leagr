<script>
    import { Table, TableBody, TableHead, TableHeadCell } from 'flowbite-svelte';
    import SortableTableHeader from './SortableTableHeader.svelte';
    import PlayerRow from './PlayerRow.svelte';

    let { sortedPlayers = [], currentSort = 'rankingPoints', onSortChange } = $props();
</script>

<Table
    classes={{ div: 'w-full text-xs' }}
    shadow>
    <TableHead>
        <TableHeadCell class="w-8 px-0.5 py-1 text-center text-xs">#</TableHeadCell>
        <TableHeadCell
            class="max-w-32 overflow-hidden px-0.5 py-1 text-xs font-bold text-ellipsis whitespace-nowrap text-gray-900 dark:text-gray-100">
            Player
        </TableHeadCell>
        <SortableTableHeader
            column="appearances"
            label="Apps"
            {currentSort}
            onSort={onSortChange} />
        <SortableTableHeader
            column="points"
            label="Points"
            {currentSort}
            onSort={onSortChange} />
        <SortableTableHeader
            column="rawAverage"
            label="Pts/App"
            {currentSort}
            onSort={onSortChange} />
        <SortableTableHeader
            column="rankingPoints"
            label="Ranking Pts"
            {currentSort}
            onSort={onSortChange} />
    </TableHead>
    <TableBody>
        {#each sortedPlayers as [player, data], index (index)}
            <PlayerRow
                {player}
                {data}
                {index}
                {currentSort}
                {onSortChange} />
        {/each}
    </TableBody>
</Table>

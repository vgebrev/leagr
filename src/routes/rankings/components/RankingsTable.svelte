<script>
    import { Table, TableBody, TableHead, TableHeadCell } from 'flowbite-svelte';
    import SortableTableHeader from './SortableTableHeader.svelte';
    import PlayerRow from './PlayerRow.svelte';

    let {
        sortedPlayers = [],
        currentSort = 'rankingPoints',
        onSortChange,
        onPlayerClick
    } = $props();
</script>

<Table
    class="w-full text-xs"
    shadow>
    <TableHead>
        <TableHeadCell class="px-1 py-1.5 text-center">#</TableHeadCell>
        <TableHeadCell class="px-1 py-1.5 font-bold text-black dark:text-white">
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
                {onPlayerClick}
                {onSortChange} />
        {/each}
    </TableBody>
</Table>

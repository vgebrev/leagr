<script>
    import {
        Table,
        TableBody,
        TableBodyCell,
        TableBodyRow,
        TableHead,
        TableHeadCell
    } from 'flowbite-svelte';
    import { Badge } from 'flowbite-svelte';

    let { players = [] } = $props();

    function getRatingBadgeColor(rating) {
        if (rating >= 1200) return 'purple';
        if (rating >= 1100) return 'blue';
        if (rating >= 1000) return 'green';
        if (rating >= 900) return 'yellow';
        return 'red';
    }

    function formatLastPlayed(dateString) {
        if (!dateString) return 'Never';
        const date = new Date(dateString);
        return date.toLocaleDateString();
    }
</script>

<div class="w-full">
    <div class="mb-4">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-white">Elo Rankings</h2>
        <p class="text-sm text-gray-600 dark:text-gray-400">
            Players ranked by Elo rating with decay and activity weighting
        </p>
    </div>

    <div class="overflow-x-auto">
        <Table hoverable={true}>
            <TableHead>
                <TableHeadCell class="px-1 py-1.5 text-center">#</TableHeadCell>
                <TableHeadCell class="px-1 py-1.5">Player</TableHeadCell>
                <TableHeadCell class="px-1 py-1.5 text-center">Seed Score</TableHeadCell>
                <TableHeadCell class="px-1 py-1.5 text-center">Elo Rating</TableHeadCell>
                <TableHeadCell class="px-1 py-1.5 text-center">Games</TableHeadCell>
                <TableHeadCell class="px-1 py-1.5 text-center">Sessions</TableHeadCell>
                <TableHeadCell class="px-1 py-1.5 text-center">Last Played</TableHeadCell>
            </TableHead>
            <TableBody>
                {#each players as player (player.playerId)}
                    <TableBodyRow>
                        <TableBodyCell class="px-1 py-1.5 text-center font-medium">
                            {player.rank}
                        </TableBodyCell>
                        <TableBodyCell class="px-1 py-1.5">
                            <div class="font-medium text-gray-900 dark:text-white">
                                {player.playerId}
                            </div>
                        </TableBodyCell>
                        <TableBodyCell class="px-1 py-1.5 text-center">
                            <Badge
                                color={getRatingBadgeColor(player.seedScore)}
                                class="font-mono font-bold">
                                {player.seedScore}
                            </Badge>
                        </TableBodyCell>
                        <TableBodyCell class="px-1 py-1.5 text-center">
                            <Badge
                                color="gray"
                                class="font-mono">
                                {player.rating}
                            </Badge>
                        </TableBodyCell>
                        <TableBodyCell class="px-1 py-1.5 text-center">
                            {player.gamesPlayed}
                        </TableBodyCell>
                        <TableBodyCell class="px-1 py-1.5 text-center">
                            {player.sessionsPlayed}
                        </TableBodyCell>
                        <TableBodyCell
                            class="px-1 py-1.5 text-center text-sm text-gray-600 dark:text-gray-400">
                            {formatLastPlayed(player.lastPlayedAt)}
                        </TableBodyCell>
                    </TableBodyRow>
                {:else}
                    <TableBodyRow>
                        <TableBodyCell
                            colspan="7"
                            class="text-center py-8 text-gray-500 dark:text-gray-400 px-1">
                            No Elo rankings data available
                        </TableBodyCell>
                    </TableBodyRow>
                {/each}
            </TableBody>
        </Table>
    </div>
</div>

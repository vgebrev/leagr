<script>
    import {
        Table,
        TableHead,
        TableHeadCell,
        TableBody,
        TableBodyRow,
        TableBodyCell,
        Alert,
        Button
    } from 'flowbite-svelte';
    import {
        CalendarMonthSolid,
        ExclamationCircleSolid,
        RectangleListSolid
    } from 'flowbite-svelte-icons';
    import TeamBadge from '$components/TeamBadge.svelte';

    let { standings = [], date, onTeamClick = null } = $props();

    /**
     * Handle team click event
     * @param {number} index
     */
    function handleTeamClick(index) {
        if (onTeamClick) {
            onTeamClick(index);
        }
    }
</script>

<div class="mb-2 flex items-center gap-2">
    <RectangleListSolid class="h-5 w-5" />
    <h3 class="text-lg font-semibold">League Table</h3>
</div>

{#if standings.length > 0}
    <Table
        class="w-full text-xs"
        shadow>
        <TableHead>
            <TableHeadCell class="px-1 py-1.5 text-center">#</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">Team</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">P</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">W</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">D</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">L</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center text-black dark:text-white"
                >Pts</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">GF</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">GA</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">GD</TableHeadCell>
        </TableHead>
        <TableBody>
            {#each standings as team, index (index)}
                <TableBodyRow>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {index + 1}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center"
                        ><div
                            class="flex justify-between"
                            onclick={() => handleTeamClick(index)}
                            onkeydown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    handleTeamClick(index);
                                }
                            }}
                            tabindex="0"
                            role="button">
                            <TeamBadge
                                className="w-full"
                                teamName={team.team} />
                        </div>
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {team.played}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {team.wins}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {team.draws}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {team.losses}
                    </TableBodyCell>
                    <TableBodyCell
                        class="px-1 py-1.5 text-center font-bold text-black dark:text-white">
                        {team.points}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {team.goalsFor}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {team.goalsAgainst}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {team.goalsFor - team.goalsAgainst}
                    </TableBodyCell>
                </TableBodyRow>
            {/each}
        </TableBody>
    </Table>
{:else}
    <Alert class="flex items-center border py-2"
        ><ExclamationCircleSolid /><span>
            Schedule some <Button
                color="alternative"
                href="/games?date={date}"
                size="xs"
                ><CalendarMonthSolid class="me-2 h-4 w-4"></CalendarMonthSolid>Games</Button> and enter
            their scores to see the standings.</span>
    </Alert>
{/if}

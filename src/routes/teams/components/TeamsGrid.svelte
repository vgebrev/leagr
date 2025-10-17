<script>
    import TeamTable from './TeamTable.svelte';

    let {
        teams,
        waitingList,
        unassignedPlayers,
        canModifyList,
        onremove,
        onassign,
        onPlayerClick,
        showPlayerRankings = false,
        date = null
    } = $props();

    // Combine all assignable players for dropdown selection
    const assignablePlayers = $derived([...unassignedPlayers, ...waitingList]);
</script>

<div class="grid grid-cols-2 gap-2">
    {#each Object.entries(teams) as [teamName, team], i (i)}
        <TeamTable
            {team}
            {teamName}
            color={teamName.split(' ')[0].toLowerCase()}
            {canModifyList}
            {onassign}
            {onremove}
            {onPlayerClick}
            {assignablePlayers}
            {showPlayerRankings}
            {date} />
    {/each}
    {#if (unassignedPlayers?.length > 0 || waitingList?.length > 0) && Object.entries(teams).length > 0}
        <div class="flex flex-col gap-2">
            {#if unassignedPlayers?.length > 0}
                <TeamTable
                    team={unassignedPlayers}
                    color="gray"
                    teamName="Unassigned Players"
                    {canModifyList}
                    allTeams={teams}
                    {onassign}
                    {onremove}
                    {onPlayerClick}
                    {showPlayerRankings}
                    {date} />
            {/if}
            {#if waitingList?.length > 0}
                <TeamTable
                    team={waitingList}
                    color="gray"
                    teamName="Waiting List"
                    {canModifyList}
                    allTeams={teams}
                    {onassign}
                    {onremove}
                    {onPlayerClick}
                    {showPlayerRankings}
                    {date} />
            {/if}
        </div>
    {/if}
</div>

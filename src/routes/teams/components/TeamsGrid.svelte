<script>
    import TeamTable from './TeamTable.svelte';
    let {
        teams,
        players,
        waitingList,
        unassignedPlayers,
        onremove,
        onfillempty,
        onfillemptyWithPlayer,
        onremoveFromList
    } = $props();
</script>

<div class="grid grid-cols-2 gap-2">
    {#each Object.entries(teams) as [teamName, team], i (i)}
        <TeamTable
            {team}
            {teamName}
            teamIndex={i}
            {onfillempty}
            {onfillemptyWithPlayer}
            {onremove}
            {players}
            waitingList={unassignedPlayers}
            allWaitingPlayers={waitingList} />
    {/each}
    {#if (unassignedPlayers?.length > 0 || waitingList?.length > 0) && Object.entries(teams).length > 0}
        <div class="flex flex-col gap-2">
            {#if unassignedPlayers?.length > 0}
                <TeamTable
                    team={unassignedPlayers}
                    color="gray"
                    teamName="Unassigned Players"
                    players={unassignedPlayers}
                    availableTeams={Object.keys(teams)}
                    allTeams={teams}
                    onassignToTeam={onfillemptyWithPlayer}
                    onremovePlayer={onremoveFromList} />
            {/if}
            {#if waitingList?.length > 0}
                <TeamTable
                    team={waitingList}
                    color="gray"
                    teamName="Waiting List"
                    players={waitingList}
                    availableTeams={Object.keys(teams)}
                    allTeams={teams}
                    onassignToTeam={onfillemptyWithPlayer}
                    onremovePlayer={onremoveFromList} />
            {/if}
        </div>
    {/if}
</div>

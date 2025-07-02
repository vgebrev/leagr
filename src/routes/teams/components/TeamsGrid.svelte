<script>
    import TeamTable from './TeamTable.svelte';
    let { teams, waitingList, allPlayers, onremove, onfillempty } = $props();
</script>

<div class="grid grid-cols-2 gap-2">
    {#each Object.entries(teams) as [teamName, team], i (i)}
        <TeamTable
            {team}
            {teamName}
            teamIndex={i}
            {onfillempty}
            {onremove}
            players={allPlayers} />
    {/each}
    {#if waitingList?.length > 0}
        <TeamTable
            team={waitingList}
            color="gray"
            teamName="Waiting List"
            players={allPlayers} />
    {/if}
</div>

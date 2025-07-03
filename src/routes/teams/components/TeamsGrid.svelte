<script>
    import TeamTable from './TeamTable.svelte';
    let { teams, players, waitingList, onremove, onfillempty } = $props();
</script>

<div class="grid grid-cols-2 gap-2">
    {#each Object.entries(teams) as [teamName, team], i (i)}
        <TeamTable
            {team}
            {teamName}
            teamIndex={i}
            {onfillempty}
            {onremove}
            {players} />
    {/each}
    {#if waitingList?.length > 0 && Object.entries(teams).length > 0}
        <TeamTable
            team={waitingList}
            color="gray"
            teamName="Waiting List"
            players={waitingList} />
    {/if}
</div>

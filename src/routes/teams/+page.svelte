<script>
    import { onMount } from 'svelte';
    import { teamsService } from '$lib/client/services/teams.svelte.js';
    import { playersService } from '$lib/client/services/players.svelte.js';
    import PlayerSummary from './components/PlayerSummary.svelte';
    import TeamGeneration from './components/TeamGeneration.svelte';
    import TeamsGrid from './components/TeamsGrid.svelte';
    import DrawReplay from './components/DrawReplay.svelte';

    let { data } = $props();
    const date = data.date;

    // Use the Teams service for all team-related data and operations
    let teams = $derived(teamsService.teams);
    let teamConfig = $derived(teamsService.teamConfig);
    let drawHistory = $derived(teamsService.drawHistory);

    // Use the Players service for player data
    let waitingList = $derived(playersService.waitingList);
    let unassignedPlayers = $derived(teamsService.unassignedPlayers);
    let canModifyList = $derived(playersService.canModifyList);

    // Get summary data
    let playerSummary = $derived(teamsService.playerSummary);

    /**
     * Generate teams based on the current configuration and player data.
     * @param {Object} options
     */
    async function generateTeams(options) {
        await teamsService.generateTeams(options);
    }

    let showReplay = $state(false);
    let replayData = $state(null);

    function handleReplay(history) {
        replayData = history;
        showReplay = true;
    }

    onMount(async () => {
        await teamsService.loadTeams(date);
    });
</script>

<div class="flex flex-col gap-2">
    <PlayerSummary {playerSummary} />
    <TeamGeneration
        {teamConfig}
        {playerSummary}
        {drawHistory}
        date={teamsService.currentDate}
        canGenerateTeams={teamsService.canGenerateTeams}
        hasExistingTeams={teamsService.hasExistingTeams}
        ongenerate={generateTeams}
        onreplay={handleReplay} />
    <TeamsGrid
        {teams}
        {waitingList}
        {unassignedPlayers}
        {canModifyList}
        onremove={teamsService.removePlayer.bind(teamsService)}
        onassign={teamsService.assignPlayerToTeam.bind(teamsService)} />

    {#if replayData}
        <DrawReplay
            drawHistory={replayData}
            bind:open={showReplay} />
    {/if}
</div>

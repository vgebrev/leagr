<script>
    import { onMount } from 'svelte';
    import { teamsService } from '$lib/client/services/teams.svelte.js';
    import { playersService } from '$lib/client/services/players.svelte.js';
    import PlayerSummary from './components/PlayerSummary.svelte';
    import TeamGeneration from './components/TeamGeneration.svelte';
    import TeamsGrid from './components/TeamsGrid.svelte';

    let { data } = $props();
    const date = data.date;

    // Use teams service for all team-related data and operations
    let teams = $derived(teamsService.teams);
    let teamConfig = $derived(teamsService.teamConfig);

    // Use players service for player data
    let waitingList = $derived(playersService.waitingList);
    let players = $derived(playersService.players);
    let unassignedPlayers = $derived(teamsService.unassignedPlayers);
    let canModifyList = $derived(playersService.canModifyList);

    // Get summary data
    let playerSummary = $derived(teamsService.playerSummary);

    async function generateTeams(options) {
        await teamsService.generateTeams(options);
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
        date={teamsService.currentDate}
        canGenerateTeams={teamsService.canGenerateTeams}
        hasExistingTeams={teamsService.hasExistingTeams}
        ongenerate={generateTeams} />
    <TeamsGrid
        {teams}
        {players}
        {waitingList}
        {unassignedPlayers}
        {canModifyList}
        onremove={teamsService.removePlayer.bind(teamsService)}
        onassign={teamsService.assignPlayerToTeam.bind(teamsService)} />
</div>

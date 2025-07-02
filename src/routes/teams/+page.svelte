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

    // Get summary data
    let playerSummary = $derived(teamsService.getPlayerSummary());
    let allPlayers = $derived(teamsService.getAllPlayers());

    async function generateTeams(options) {
        await teamsService.generateTeams(options);
    }

    async function removePlayer({ player, teamIndex }) {
        await teamsService.removePlayer(player, teamIndex);
    }

    async function fillEmptySpotFromWaitingList({ playerIndex, teamIndex }) {
        await teamsService.fillEmptySpotFromWaitingList(playerIndex, teamIndex);
    }

    onMount(async () => {
        await teamsService.loadTeams(date);
    });
</script>

<div class="flex flex-col gap-2">
    <PlayerSummary {playerSummary} />
    <TeamGeneration
        {teamConfig}
        date={teamsService.currentDate}
        canGenerateTeams={teamsService.canGenerateTeams}
        hasExistingTeams={teamsService.hasExistingTeams}
        ongenerate={generateTeams} />
    <TeamsGrid
        {teams}
        {waitingList}
        {allPlayers}
        onremove={removePlayer}
        onfillempty={fillEmptySpotFromWaitingList} />
</div>

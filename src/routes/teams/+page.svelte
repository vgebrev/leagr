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

    // Get summary data
    let playerSummary = $derived(teamsService.getPlayerSummary());

    async function generateTeams(options) {
        await teamsService.generateTeams(options);
    }

    async function removePlayer({ player, teamIndex, action }) {
        await teamsService.removePlayerFromTeam(player, teamIndex, action);
    }

    async function fillEmptySpotFromWaitingList({ playerIndex, teamIndex }) {
        await teamsService.fillEmptySpotFromWaitingList(playerIndex, teamIndex);
    }

    async function fillEmptySpotWithPlayer(data) {
        if (data.playerName && data.teamName) {
            // Direct assignment by team name
            await teamsService.assignPlayerToTeam(data.playerName, data.teamName);
        } else {
            // Legacy slot-based assignment
            await teamsService.fillEmptySpotWithPlayer(
                data.playerIndex,
                data.teamIndex,
                data.selectedPlayer
            );
        }
    }

    async function removePlayerFromList(playerName, list) {
        await playersService.removePlayer(playerName, list);
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
        {players}
        {waitingList}
        {unassignedPlayers}
        onremove={removePlayer}
        onfillempty={fillEmptySpotFromWaitingList}
        onfillemptyWithPlayer={fillEmptySpotWithPlayer}
        onremoveFromList={removePlayerFromList} />
</div>

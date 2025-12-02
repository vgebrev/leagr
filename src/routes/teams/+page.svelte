<script>
    import { onMount } from 'svelte';
    import { Toggle } from 'flowbite-svelte';
    import { teamsService } from '$lib/client/services/teams.svelte.js';
    import { playersService } from '$lib/client/services/players.svelte.js';
    import PlayerSummary from './components/PlayerSummary.svelte';
    import TeamGeneration from './components/TeamGeneration.svelte';
    import TeamsGrid from './components/TeamsGrid.svelte';
    import DrawReplay from './components/DrawReplay.svelte';
    import PlayerModal from '$components/PlayerModal.svelte';
    import TeamModal from '$components/TeamModal.svelte';

    let { data } = $props();
    const date = data.date;
    let showPlayerModal = $state(false);
    let selectedPlayer = $state(null);
    let showTeamModal = $state(false);
    let selectedTeam = $state(null);

    function handlePlayerClick(player) {
        selectedPlayer = player;
        showPlayerModal = true;
    }

    function handleTeamClick(teamName) {
        selectedTeam = teamName;
        showTeamModal = true;
    }

    // Use the Teams service for all team-related data and operations
    let teams = $derived(teamsService.teams);
    let teamConfig = $derived(teamsService.teamConfig);
    let drawHistory = $derived(teamsService.drawHistory);

    // Use enhanced player data with ELO when available, fallback to legacy format
    let waitingList = $derived(
        teamsService.waitingListWithElo.length > 0
            ? teamsService.waitingListWithElo
            : playersService.waitingList
    );
    let unassignedPlayers = $derived(
        teamsService.unassignedPlayersWithElo.length > 0
            ? teamsService.unassignedPlayersWithElo
            : teamsService.unassignedPlayers
    );
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
    let showPlayerRankings = $state(false);

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

    {#if Object.keys(teams).length > 0}
        <div class="mb-2 flex items-center gap-2">
            <Toggle
                bind:checked={showPlayerRankings}
                size="small">
                Show ELO
            </Toggle>
        </div>
    {/if}

    <TeamsGrid
        {teams}
        {waitingList}
        {unassignedPlayers}
        {canModifyList}
        {showPlayerRankings}
        {date}
        onremove={teamsService.removePlayer.bind(teamsService)}
        onassign={teamsService.assignPlayerToTeam.bind(teamsService)}
        onPlayerClick={handlePlayerClick}
        onTeamClick={handleTeamClick} />

    {#if replayData}
        <DrawReplay
            drawHistory={replayData}
            bind:open={showReplay} />
    {/if}
</div>

<PlayerModal
    bind:playerName={selectedPlayer}
    bind:open={showPlayerModal}
    {date} />

<TeamModal
    bind:teamName={selectedTeam}
    {date}
    bind:open={showTeamModal} />

<script>
    import { Alert, Button, Label, Radio } from 'flowbite-svelte';
    import { ExclamationCircleSolid, UsersGroupSolid, UserSolid } from 'flowbite-svelte-icons';
    import { onMount } from 'svelte';
    import { teamsService } from '$lib/client/services/teams.svelte.js';
    import { playersService } from '$lib/client/services/players.svelte.js';
    import { settings } from '$lib/client/stores/settings.js';
    import TeamTable from './components/TeamTable.svelte';
    import PlayerSummary from './components/PlayerSummary.svelte';
    import TeamGeneration from './components/TeamGeneration.svelte';

    let { data } = $props();
    const date = data.date;

    // Use teams service for all team-related data and operations
    let teams = $derived(teamsService.teams);
    let teamConfig = $derived(teamsService.teamConfig);
    let confirmRegenerate = $derived(teamsService.confirmRegenerate);
    let canGenerateTeams = $derived(teamsService.canGenerateTeams);
    let isPast = $derived(teamsService.isPast);

    // Use players service for player data
    let waitingList = $derived(playersService.waitingList);

    // Get summary data
    let playerSummary = $derived(teamsService.getPlayerSummary());
    let allPlayers = $derived(teamsService.getAllPlayers());

    async function generateTeams(options, regenerate = false) {
        await teamsService.generateTeams(options, regenerate);
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
        {canGenerateTeams}
        {confirmRegenerate}
        ongenerate={generateTeams} />
    <div class="grid grid-cols-2 gap-2">
        {#each Object.entries(teams) as [teamName, team], i (i)}
            <TeamTable
                {team}
                {teamName}
                teamIndex={i}
                onfillempty={fillEmptySpotFromWaitingList}
                onremove={removePlayer}
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
</div>

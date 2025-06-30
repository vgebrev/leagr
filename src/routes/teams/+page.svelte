<script>
    import { Alert, Button, Label, Radio } from 'flowbite-svelte';
    import { ExclamationCircleSolid, UsersGroupSolid, UserSolid } from 'flowbite-svelte-icons';
    import { onMount } from 'svelte';
    import { teamsService } from '$lib/client/services/teams.svelte.js';
    import { playersService } from '$lib/client/services/players.svelte.js';
    import { settings } from '$lib/client/stores/settings.js';
    import TeamTable from './components/TeamTable.svelte';

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

    async function generateTeams(regenerate = false) {
        const success = await teamsService.generateTeams(regenerate);
        // Additional logic can be added here if needed after team generation
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
    <div class="flex gap-2 text-nowrap">
        <span>Players:</span>
        <span>{playerSummary.available} available.</span>
        <span>{playerSummary.eligible} eligible.</span>
        {#if playerSummary.excess > 0}
            <span>{playerSummary.excess} excess.</span>
        {/if}
        {#if playerSummary.waitingList > 0}
            <span>{playerSummary.waitingList} on waiting list.</span>
        {/if}
    </div>

    {#if waitingList.length > 0}
        <Alert class="flex items-center border py-2">
            <ExclamationCircleSolid />
            <span>
                {waitingList.length} player{waitingList.length === 1 ? '' : 's'}
                on waiting list: {waitingList.join(', ')}
            </span>
        </Alert>
    {/if}

    <Label>Choose team option</Label>
    <div class="flex w-full flex-col gap-2">
        {#each teamConfig as config, i (i)}
            <div class="rounded-md border p-2">
                <Radio
                    bind:group={teamsService.selectedTeamConfig}
                    value={config}
                    disabled={isPast ||
                        (!$settings.canRegenerateTeams && Object.keys(teams).length > 0)}
                    ><div class="items-between flex gap-2">
                        <span class="semi-bold">{config.teams} Teams</span><span
                            >({config.teamSizes.join(', ')} Players)</span>
                    </div></Radio>
            </div>
        {/each}
        {#if teamConfig.length === 0}
            <Alert class="flex items-center border py-2"
                ><ExclamationCircleSolid /><span
                    >More <Button
                        color="alternative"
                        href="/players?date={data.date}"
                        size="xs"><UserSolid class="me-2 h-4 w-4"></UserSolid>Players</Button> are needed
                    to make teams.</span
                ></Alert>
        {/if}
    </div>
    <Button
        onclick={() => generateTeams(false)}
        disabled={!canGenerateTeams}
        ><UsersGroupSolid class="me-2 h-4 w-4" /> Generate Teams</Button>
    {#if confirmRegenerate}
        <Alert class="flex items-center border"
            ><ExclamationCircleSolid /><span
                >Teams have already been generated. Are you sure you want to regenerate them?
                <Button
                    size="sm"
                    onclick={async () => await generateTeams(true)}>Yes</Button
                ></span
            ></Alert>
    {/if}
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

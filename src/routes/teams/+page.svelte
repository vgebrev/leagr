<script>
    import { Alert, Button, Label, Radio } from 'flowbite-svelte';
    import { ExclamationCircleSolid, UsersGroupSolid } from 'flowbite-svelte-icons';
    import { onMount } from 'svelte';
    import { api } from '$lib/api-client.js';
    import { setError } from '$lib/stores/error.js';
    import { isLoading } from '$lib/stores/loading.js';
    import { settings } from '$lib/stores/settings.js';
    import { nouns } from '$lib/nouns.js';
    import { teamColours } from '$lib/helpers.js';
    import TeamTable from '../../components/TeamTable.svelte';

    let { data } = $props();
    const date = data.date;

    let players = $state([]);
    let teamConfig = $derived.by(() =>
        calculateTeamConfig(Math.min(players.length, $settings.playerLimit))
    );
    let selectedTeamConfig = $state(null);
    let waitingList = $state([]);
    let teams = $state({});
    let confirmRegenerate = $state(false);

    function calculateTeamConfig(playerCount) {
        const config = [];
        for (let t = 2; t <= 4 && t * 5 <= playerCount; t++) {
            const minPlayers = Math.floor(playerCount / t);
            const extraPlayers = playerCount % t;
            const teamSizes = Array(t).fill(minPlayers);

            for (let i = 0; i < extraPlayers; i++) {
                teamSizes[i]++;
            }

            if (teamSizes.every((size) => size >= 5 && size <= 7)) {
                config.push({
                    teams: t,
                    teamSizes: teamSizes
                });
            }
        }
        return config;
    }

    async function generateTeams(regenerate = false) {
        if (!selectedTeamConfig) {
            setError('Please choose a team option.');
            return;
        }
        if (Object.keys(teams).length > 0 && !regenerate) {
            confirmRegenerate = true;
            return;
        }
        $isLoading = true;
        const restoreTeams = { ...teams };
        const restoreWaitingList = [...waitingList];
        const eligiblePlayers = players.slice(0, Math.min(players.length, $settings.playerLimit));
        waitingList = players.slice(Math.min(players.length, $settings.playerLimit));
        teams = {};
        const teamSizes = selectedTeamConfig.teamSizes;
        const shuffledPlayers = eligiblePlayers.sort(() => Math.random() - 0.5);
        for (let i = 0; i < teamSizes.length; i++) {
            const noun = nouns[Math.floor(Math.random() * nouns.length)];
            const name = `${teamColours[i]} ${noun}`;
            teams[name] = [...shuffledPlayers.splice(0, teamSizes[i])];
        }
        try {
            await api.post('teams', date, { teams, waitingList });
            confirmRegenerate = false;
        } catch (ex) {
            console.error('Error generating teams:', ex);
            setError('Failed to generate teams. Please try again.');
            teams = restoreTeams;
            waitingList = restoreWaitingList;
        } finally {
            $isLoading = false;
        }
    }

    async function removePlayer({ player, teamIndex }) {
        $isLoading = true;
        const restoreTeams = { ...teams };
        const restoreWaitingList = [...waitingList];
        try {
            teams[Object.keys(teams)[teamIndex]] = teams[Object.keys(teams)[teamIndex]].filter(
                (p) => p !== player
            );
            if (waitingList.length > 0) {
                const nextPlayer = waitingList.shift();
                teams[Object.keys(teams)[teamIndex]].push(nextPlayer);
            } else {
                teams[Object.keys(teams)[teamIndex]].push(null);
            }
            await api.post('teams', date, { teams, waitingList });
        } catch (ex) {
            console.error('Error removing player:', ex);
            setError('Failed to remove player. Please try again.');
            teams = restoreTeams;
            waitingList = restoreWaitingList;
        } finally {
            $isLoading = false;
        }
    }

    onMount(async () => {
        try {
            $isLoading = true;
            players = await api.get('players', date);
            const teamData = await api.get('teams', date);
            teams = teamData.teams || {};
            waitingList = teamData.waitingList || [];
        } catch (ex) {
            console.error('Error fetching players:', ex);
            setError('Failed to load player data. Please try again.');
        } finally {
            $isLoading = false;
        }
    });
</script>

<div class="flex flex-col gap-2">
    <div class="flex gap-2 text-nowrap">
        <span>Players:</span>
        <span>{players.length} available.</span>
        <span>{Math.min(players.length, $settings.playerLimit)} eligible.</span>
        {#if players.length > $settings.playerLimit}
            <span>{players.length - $settings.playerLimit} waiting list.</span>
        {/if}
    </div>
    <Label>Choose team options</Label>
    <div class="flex w-full flex-col gap-2">
        {#each teamConfig as config, i (i)}
            <div class="rounded-md border p-2">
                <Radio
                    bind:group={selectedTeamConfig}
                    value={config}
                    ><div class="items-between flex gap-2">
                        <span class="semi-bold">{config.teams} Teams</span><span
                            >({config.teamSizes} Players)</span>
                    </div></Radio>
            </div>
        {/each}
        {#if teamConfig.length === 0}
            <Alert class="flex items-center border"
                ><ExclamationCircleSolid />More players are needed to make teams.</Alert>
        {/if}
    </div>
    <Button
        onclick={async () => await generateTeams(false)}
        disabled={(!$settings.canRegenerateTeams && Object.keys(teams).length > 0) ||
            !selectedTeamConfig}><UsersGroupSolid class="me-2 h-4 w-4" /> Generate Teams</Button>
    {#if confirmRegenerate}
        <Alert class="flex items-center border"
            ><ExclamationCircleSolid />Teams have already been generated. Are you sure you want to
            regenerate them?
            <Button
                size="sm"
                onclick={async () => await generateTeams(true)}>Yes</Button
            ></Alert>
    {/if}
    <div class="grid grid-cols-2 gap-2">
        {#each Object.entries(teams) as [teamName, team], i (i)}
            <TeamTable
                {team}
                {teamName}
                teamIndex={i}
                onremove={removePlayer}
                {players} />
        {/each}
        {#if waitingList?.length > 0}
            <TeamTable
                team={waitingList}
                color="gray"
                teamName="Waiting List"
                {players} />
        {/if}
    </div>
</div>

<script>
    import { Alert, Button, Label, Radio } from 'flowbite-svelte';
    import { ExclamationCircleSolid, UsersGroupSolid, UserSolid } from 'flowbite-svelte-icons';
    import { onMount } from 'svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { playersService } from '$lib/client/services/players.svelte.js';
    import { setError } from '$lib/client/stores/error.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { settings } from '$lib/client/stores/settings.js';
    import { nouns } from '$lib/client/nouns.js';
    import { isDateInPast, teamColours } from '$lib/shared/helpers.js';
    import TeamTable from './components/TeamTable.svelte';

    let { data } = $props();
    const date = data.date;
    let isPast = $derived(isDateInPast(date));

    // Use players service for player data
    let players = $derived(playersService.players);
    let waitingList = $derived(playersService.waitingList);

    let rankings = $state({});
    let teamConfig = $derived.by(() =>
        calculateTeamConfig(Math.min(players.length, $settings.playerLimit))
    );
    let selectedTeamConfig = $state(null);
    let teams = $state({});
    let confirmRegenerate = $state(false);

    function calculateTeamConfig(playerCount) {
        const teamLimits = { min: 2, max: 5 };
        const playerLimits = { min: 5, max: 7 };
        const config = [];
        for (
            let t = teamLimits.min;
            t <= teamLimits.max && t * playerLimits.min <= playerCount;
            t++
        ) {
            const minPlayers = Math.floor(playerCount / t);
            const extraPlayers = playerCount % t;
            const teamSizes = Array(t).fill(minPlayers);

            for (let i = 0; i < extraPlayers; i++) {
                teamSizes[i]++;
            }

            if (teamSizes.every((size) => size >= playerLimits.min && size <= playerLimits.max)) {
                config.push({
                    teams: t,
                    teamSizes: teamSizes
                });
            }
        }
        return config;
    }

    function generateRandomTeams() {
        const eligiblePlayers = players.slice(0, Math.min(players.length, $settings.playerLimit));
        const result = {};
        const teamSizes = selectedTeamConfig.teamSizes;
        const shuffledPlayers = eligiblePlayers.sort(() => Math.random() - 0.5);

        for (let i = 0; i < teamSizes.length; i++) {
            const noun = nouns[Math.floor(Math.random() * nouns.length)];
            const name = `${teamColours[i]} ${noun}`;
            result[name] = [...shuffledPlayers.splice(0, teamSizes[i])];
        }
        return result;
    }

    function generateSeededTeams() {
        const eligiblePlayers = players.slice(0, Math.min(players.length, $settings.playerLimit));
        const teamSizes = selectedTeamConfig.teamSizes;
        const numTeams = teamSizes.length;
        const result = {};

        // Sort players by ranking points first, then total points, then appearances
        const sortedPlayers = [...eligiblePlayers].sort((a, b) => {
            const playerA = rankings?.players?.[a];
            const playerB = rankings?.players?.[b];

            // Primary sort: ranking points (if available)
            if (playerA?.rankingPoints !== undefined && playerB?.rankingPoints !== undefined) {
                if (playerA.rankingPoints !== playerB.rankingPoints) {
                    return playerB.rankingPoints - playerA.rankingPoints;
                }
            }

            // Secondary sort: total points
            if ((playerA?.points || 0) !== (playerB?.points || 0)) {
                return (playerB?.points || 0) - (playerA?.points || 0);
            }

            // Tertiary sort: appearances
            return (playerB?.appearances || 0) - (playerA?.appearances || 0);
        });

        // Create pots for snake draft
        const pots = [];
        for (let i = 0; i < Math.max(...teamSizes); i++) {
            pots.push([...sortedPlayers.splice(0, numTeams)]);
            while (pots[i].length < numTeams) {
                pots[i].push(null);
            }
        }

        // Randomize within each pot to prevent predictable team assignments
        for (let pot of pots) {
            pot.sort(() => Math.random() - 0.5);
        }

        // Create team structure
        for (let i = 0; i < numTeams; i++) {
            const noun = nouns[Math.floor(Math.random() * nouns.length)];
            const name = `${teamColours[i]} ${noun}`;
            result[name] = [];
        }

        // Distribute players from pots to teams
        const teamNames = Object.keys(result);
        for (let i = 0; i < teamNames.length; i++) {
            const teamName = teamNames[i];
            const teamSize = Math.max(...teamSizes);
            for (let j = 0; j < teamSize; j++) {
                if (pots[j] && pots[j].length > 0) {
                    const player = pots[j].shift();
                    if (player) result[teamName].push(player);
                }
            }
        }

        return result;
    }

    async function generateTeams(regenerate = false) {
        if (isPast) {
            setError('The date is in the past. Teams cannot be changed.');
            return;
        }
        if (!selectedTeamConfig) {
            setError('Please choose a team option.');
            return;
        }
        if (Object.keys(teams).length > 0 && !regenerate) {
            confirmRegenerate = true;
            return;
        }

        const restoreTeams = { ...teams };

        teams = $settings.seedTeams ? generateSeededTeams() : generateRandomTeams();

        await withLoading(
            async () => {
                teams = (await api.post('teams', date, teams)) || {};
                confirmRegenerate = false;
            },
            (err) => {
                console.error('Error generating teams:', err);
                setError('Failed to generate teams. Please try again.');
                teams = restoreTeams;
            }
        );
    }

    async function removePlayer({ player, teamIndex }) {
        if (isPast) {
            setError('The date is in the past. Teams cannot be changed.');
            return;
        }
        const restoreTeams = { ...teams };

        await withLoading(
            async () => {
                const teamNames = Object.keys(teams);
                teams[teamNames[teamIndex]] = teams[teamNames[teamIndex]].filter(
                    (p) => p !== player
                );

                if (waitingList.length > 0) {
                    const nextPlayer = waitingList[0];
                    teams[teamNames[teamIndex]].push(nextPlayer);
                    // Remove from waiting list via players service
                    await playersService.removePlayer(nextPlayer, 'waitingList');
                } else {
                    teams[teamNames[teamIndex]].push(null);
                }

                teams = (await api.post('teams', date, teams)) || {};
            },
            (err) => {
                console.error('Error removing player:', err);
                setError('Failed to remove player. Please try again.');
                teams = restoreTeams;
            }
        );
    }

    async function fillEmptySpotFromWaitingList({ playerIndex, teamIndex }) {
        if (isPast) {
            setError('The date is in the past. Teams cannot be changed.');
            return;
        }
        const restoreTeams = { ...teams };

        await withLoading(
            async () => {
                const teamNames = Object.keys(teams);
                if (teams[teamNames[teamIndex]][playerIndex] !== null) {
                    setError('This spot is already filled.');
                    return;
                }
                if (waitingList.length > 0) {
                    const nextPlayer = waitingList[0];
                    teams[teamNames[teamIndex]][playerIndex] = nextPlayer;
                    // Remove from waiting list via players service
                    await playersService.removePlayer(nextPlayer, 'waitingList');
                }

                teams = (await api.post('teams', date, teams)) || {};
            },
            (err) => {
                console.error('Error filling empty spot with a player:', err);
                setError('Failed to assign waiting list player to empty spot. Please try again.');
                teams = restoreTeams;
            }
        );
    }

    // Removed functions that are no longer needed since we use players service waiting list

    onMount(async () => {
        await withLoading(
            async () => {
                // Load players using the service
                await playersService.loadPlayers(date);

                // Load rankings with enhanced data
                rankings = await api.get('rankings');

                // Load existing teams data
                teams = (await api.get('teams', date)) || {};
            },
            (err) => {
                console.error('Error fetching data:', err);
                setError('Failed to load data. Please try again.');
            }
        );
    });
</script>

<div class="flex flex-col gap-2">
    <div class="flex gap-2 text-nowrap">
        <span>Players:</span>
        <span>{players.length} available.</span>
        <span>{Math.min(players.length, $settings.playerLimit)} eligible.</span>
        {#if players.length > $settings.playerLimit}
            <span>{players.length - $settings.playerLimit} excess.</span>
        {/if}
        {#if waitingList.length > 0}
            <span>{waitingList.length} on waiting list.</span>
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
                    bind:group={selectedTeamConfig}
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
        onclick={async () => await generateTeams(false)}
        disabled={(!$settings.canRegenerateTeams && Object.keys(teams).length > 0) ||
            !selectedTeamConfig ||
            isPast}><UsersGroupSolid class="me-2 h-4 w-4" /> Generate Teams</Button>
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
                players={[...players, ...waitingList]} />
        {/each}
        {#if waitingList?.length > 0}
            <TeamTable
                team={waitingList}
                color="gray"
                teamName="Waiting List"
                players={[...players, ...waitingList]} />
        {/if}
    </div>
</div>

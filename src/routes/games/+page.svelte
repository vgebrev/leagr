<script>
    import { Listgroup, ListgroupItem, Input, Button, Alert } from 'flowbite-svelte';
    import { CalendarMonthSolid } from 'flowbite-svelte-icons';
    import { onMount } from 'svelte';
    import { api } from '$lib/api-client.js';
    import { setError } from '$lib/stores/error.js';
    import { isLoading } from '$lib/stores/loading.js';
    import { settings } from '$lib/stores/settings.js';
    import TeamBadge from '../../components/TeamBadge.svelte';
    import { CirclePlusSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';

    let { data } = $props();
    const date = data.date;
    let schedule = $state([]);
    let teams = $state({});
    let teamNames = $derived(Object.keys(teams));
    let confirmRegenerate = $derived(false);

    function generateRoundRobinRounds(teams) {
        const totalTeams = [...teams];
        if (totalTeams.length % 2 !== 0) {
            totalTeams.push(null);
        }
        const n = totalTeams.length;
        const rounds = [];

        for (let round = 0; round < n - 1; round++) {
            let matches = [];
            for (let i = 0; i < n / 2; i++) {
                const home = totalTeams[i];
                const away = totalTeams[n - 1 - i];
                if (home !== null && away !== null) {
                    const match =
                        round % 2 === 0
                            ? { home, away, homeScore: null, awayScore: null }
                            : { home: away, away: home, homeScore: null, awayScore: null };
                    matches.push(match);
                } else {
                    const byeTeam = home ?? away;
                    matches.push({ bye: byeTeam });
                }
            }
            if (round % 2 !== 0) {
                const [first, ...rest] = matches;
                matches = [...rest, first];
            }
            rounds.push(matches);
            const fixed = totalTeams[0];
            const rotated = [fixed, ...totalTeams.slice(-1), ...totalTeams.slice(1, -1)];
            totalTeams.splice(0, totalTeams.length, ...rotated);
        }

        return rounds;
    }

    function generateFullRoundRobinSchedule(teams) {
        const firstLeg = generateRoundRobinRounds(teams);
        const secondLeg = firstLeg.map((round) =>
            round.map((match) => {
                if (match.bye) return match;
                return { home: match.away, away: match.home, homeScore: null, awayScore: null };
            })
        );
        return [...firstLeg, ...secondLeg];
    }

    async function scheduleGames(regenerate = false) {
        if (schedule.length > 0 && !regenerate) {
            confirmRegenerate = true;
            return;
        }
        const restoreSchedule = schedule;
        try {
            $isLoading = true;
            schedule = generateFullRoundRobinSchedule(teamNames);
            await api.post('games', date, { rounds: schedule });
            confirmRegenerate = false;
        } catch (ex) {
            console.error(ex);
            setError('Failed to generate schedule. Please try again.');
            schedule = restoreSchedule;
        } finally {
            $isLoading = false;
        }
    }

    async function addMoreGames() {
        const restoreSchedule = schedule;
        try {
            $isLoading = true;
            schedule = schedule.concat(generateFullRoundRobinSchedule(teamNames));
            await api.post('games', date, { rounds: schedule });
        } catch (ex) {
            console.error(ex);
            setError('Failed to add more games. Please try again.');
            schedule = restoreSchedule;
        } finally {
            $isLoading = false;
        }
    }

    async function saveScore() {
        const restoreSchedule = schedule;
        try {
            $isLoading = true;
            await api.post('games', date, { rounds: schedule });
        } catch (ex) {
            console.error(ex);
            setError('Failed to add more games. Please try again.');
            schedule = restoreSchedule;
        } finally {
            $isLoading = false;
        }
    }

    onMount(async () => {
        try {
            $isLoading = true;
            const teamData = await api.get('teams', date);
            teams = teamData.teams;
            const scheduleData = await api.get('games', date);
            schedule = scheduleData.rounds || [];
        } catch (ex) {
            console.error('Error fetching teams:', ex);
            setError('Failed to load team and schedule data. Please try again.');
        } finally {
            $isLoading = false;
        }
    });
</script>

{#if teamNames.length === 0}
    <Alert class="flex items-center border"
        ><ExclamationCircleSolid />Make some teams before scheduling games.</Alert>
{/if}

<Button
    onclick={async () => await scheduleGames(false)}
    disabled={(!$settings.canResetSchedule && schedule.length > 0) || teamNames.length === 0}
    ><CalendarMonthSolid class="me-2 h-4 w-4" /> Schedule Games</Button>
{#if confirmRegenerate}
    <Alert class="flex items-center border"
        ><ExclamationCircleSolid />Games have already been schedule. Are you sure you want to reset
        the schedule?
        <Button
            size="sm"
            onclick={async () => await scheduleGames(true)}>Yes</Button
        ></Alert>
{/if}

<div class="flex w-full flex-col gap-2">
    {#each schedule as round, i (i)}
        <Listgroup class="w-full shadow">
            <ListgroupItem class="bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-400"
                >Round {i + 1}</ListgroupItem>
            {#each round.filter((m) => !m.bye) as matchup, j (j)}
                <ListgroupItem class="flex justify-between gap-2 p-2">
                    <TeamBadge
                        className="w-2/5"
                        teamName={matchup.home}
                        {teams} />
                    <Input
                        type="number"
                        size="sm"
                        class="mr-auto w-8 text-center md:w-16"
                        bind:value={matchup.homeScore}
                        onchange={saveScore} />
                    <Input
                        type="number"
                        size="sm"
                        class="ml-auto w-8 text-center md:w-16"
                        bind:value={matchup.awayScore}
                        onchange={saveScore} />
                    <TeamBadge
                        className="w-2/5"
                        teamName={matchup.away}
                        {teams} />
                </ListgroupItem>
            {/each}
        </Listgroup>
    {/each}
</div>
{#if schedule.length > 0}
    <Button
        disabled={teamNames.length === 0}
        onclick={addMoreGames}>
        <CirclePlusSolid class="me-2 h-4 w-4"></CirclePlusSolid> Add More Games</Button>
{/if}

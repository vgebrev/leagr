<script>
    import { Listgroup, ListgroupItem, Input, Button, Alert } from 'flowbite-svelte';
    import { CalendarMonthSolid, UsersGroupSolid } from 'flowbite-svelte-icons';
    import { onMount } from 'svelte';
    import { api } from '$lib/api-client.svelte.js';
    import { setError } from '$lib/stores/error.js';
    import { isLoading } from '$lib/stores/loading.js';
    import { settings } from '$lib/stores/settings.js';
    import TeamBadge from '../../components/TeamBadge.svelte';
    import { CirclePlusSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { isDateInPast, rotateArray } from '$lib/helpers.js';

    let { data } = $props();
    const date = data.date;
    let isPast = $derived(isDateInPast(date));
    let schedule = $state([]);
    let anchorIndex = $state(0);
    let teams = $state({});
    let teamNames = $derived(Object.keys(teams || {}));
    let confirmRegenerate = $derived(false);

    function generateRoundRobinRounds(teams, anchorIndex = 0) {
        const totalTeams = [...teams];

        if (totalTeams.length % 2 !== 0) {
            totalTeams.push(null); // bye
        }

        const n = totalTeams.length;
        const rounds = [];

        const rotatedTeams = rotateArray(totalTeams, anchorIndex);

        for (let round = 0; round < n - 1; round++) {
            let matches = [];

            for (let i = 0; i < n / 2; i++) {
                const home = rotatedTeams[i];
                const away = rotatedTeams[n - 1 - i];

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

            const fixed = rotatedTeams[0];
            const rotated = [fixed, ...rotatedTeams.slice(-1), ...rotatedTeams.slice(1, -1)];
            rotatedTeams.splice(0, n, ...rotated);
        }

        return rounds;
    }

    function generateFullRoundRobinSchedule(teams, anchorIndex = 0) {
        const firstLeg = generateRoundRobinRounds(teams, anchorIndex);
        const secondLeg = firstLeg.map((round) =>
            round.map((match) => {
                if (match.bye) return match;
                return { home: match.away, away: match.home, homeScore: null, awayScore: null };
            })
        );
        return [...firstLeg, ...secondLeg];
    }

    async function scheduleGames(regenerate = false) {
        if (isPast) {
            setError('The date is in the past. Games cannot be changed.');
            return;
        }
        if (schedule.length > 0 && !regenerate) {
            confirmRegenerate = true;
            return;
        }
        const restoreSchedule = schedule;
        try {
            $isLoading = true;
            anchorIndex = Math.floor(Math.random() * teamNames.length);
            schedule = generateFullRoundRobinSchedule(teamNames, anchorIndex);
            const scheduleData = await api.post('games', date, {
                anchorIndex,
                rounds: schedule
            });
            schedule = scheduleData.rounds || [];
            anchorIndex = scheduleData.anchorIndex || 0;
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
        if (isPast) {
            setError('The date is in the past. Games cannot be changed.');
            return;
        }
        const restoreSchedule = schedule;
        try {
            $isLoading = true;
            schedule = schedule.concat(generateFullRoundRobinSchedule(teamNames, anchorIndex));
            schedule = (await api.post('games', date, { anchorIndex, rounds: schedule })).rounds;
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
            schedule = (await api.post('games', date, { anchorIndex, rounds: schedule })).rounds;
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
            anchorIndex = scheduleData.anchorIndex || 0;
        } catch (ex) {
            console.error('Error fetching teams:', ex);
            setError('Failed to load team and schedule data. Please try again.');
        } finally {
            $isLoading = false;
        }
    });
</script>

{#if teamNames.length === 0}
    <Alert class="flex items-center border py-2"
        ><ExclamationCircleSolid /><span
            >Make some <Button
                color="alternative"
                href="/teams?date={data.date}"
                size="xs"><UsersGroupSolid class="me-2 h-4 w-4"></UsersGroupSolid>Teams</Button> before
            scheduling games.</span
        ></Alert>
{/if}

<Button
    onclick={async () => await scheduleGames(false)}
    disabled={(!$settings.canResetSchedule && schedule.length > 0) ||
        teamNames.length === 0 ||
        isPast}><CalendarMonthSolid class="me-2 h-4 w-4" /> Schedule Games</Button>
{#if confirmRegenerate}
    <Alert class="flex items-center border"
        ><ExclamationCircleSolid />Games have already been scheduled. Are you sure you want to reset
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
                        onchange={saveScore}
                        disabled={isPast} />
                    <Input
                        type="number"
                        size="sm"
                        class="ml-auto w-8 text-center md:w-16"
                        bind:value={matchup.awayScore}
                        onchange={saveScore}
                        disabled={isPast} />
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
        disabled={teamNames.length === 0 || isPast}
        onclick={addMoreGames}>
        <CirclePlusSolid class="me-2 h-4 w-4"></CirclePlusSolid> Add More Games</Button>
{/if}

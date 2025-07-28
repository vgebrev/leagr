<script>
    import { Listgroup, ListgroupItem, Input, Button, Alert } from 'flowbite-svelte';

    /**
     * @typedef {Object} Match
     * @property {string} [home] - Home team name
     * @property {string} [away] - Away team name
     * @property {number | null} [homeScore] - Home team score
     * @property {number | null} [awayScore] - Away team score
     * @property {string} [bye] - Team that has a bye
     */

    /**
     * @typedef {Object} TeamData
     * @property {string} colour - Team colour
     * @property {string[]} players - Array of player names
     */
    import { CalendarMonthSolid, UsersGroupSolid } from 'flowbite-svelte-icons';
    import { onMount } from 'svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { settings } from '$lib/client/stores/settings.js';
    import TeamBadge from '$components/TeamBadge.svelte';
    import { CirclePlusSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { isDateInPast, rotateArray } from '$lib/shared/helpers.js';

    let { data } = $props();
    /** @type {string} */
    const date = data.date;
    /** @type {boolean} */
    let isPast = $derived(isDateInPast(date));
    /** @type {Array<Array<Match>>} */
    let schedule = $state([]);
    /** @type {number} */
    let anchorIndex = $state(0);
    /** @type {Record<string, TeamData>} */
    let teams = $state({});
    /** @type {string[]} */
    let teamNames = $derived(Object.keys(teams || {}));
    /** @type {boolean} */
    let confirmRegenerate = $derived(false);

    /**
     * Generates a round-robin schedule for the given teams.
     * Each team plays every other team once, with an optional bye if the number of teams is odd.
     * The schedule is generated in rounds, where each round contains matches between teams.
     * The first team in each round is fixed, and the rest are rotated to create the schedule.
     * @param {Array<?string>} teams - Array of team names
     * @param {number} anchorIndex - Starting index for team rotation
     * @returns {Array<Match[]>} Array of rounds containing matches
     */
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

    /**
     * Generates a full round-robin schedule for the given teams.
     * This includes both legs of the round-robin, where each team plays every other team twice.
     * The first leg is generated normally, and the second leg is the reverse of the first leg.
     * @param {string[]} teams - Array of team names
     * @param {number} anchorIndex - Starting index for team rotation
     * @returns {Array<Match[]>} Array of rounds containing matches for both legs
     */
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

    /**
     * Schedules games for the current date
     * @param {boolean} regenerate - Whether to regenerate existing schedule
     */
    async function scheduleGames(regenerate = false) {
        if (isPast) {
            setNotification('The date is in the past. Games cannot be changed.', 'warning');
            return;
        }
        if (schedule.length > 0 && !regenerate) {
            confirmRegenerate = true;
            return;
        }
        const restoreSchedule = schedule;
        await withLoading(
            async () => {
                anchorIndex = Math.floor(Math.random() * teamNames.length);
                schedule = generateFullRoundRobinSchedule(teamNames, anchorIndex);
                /** @type {{ rounds: Array<Match[]>, anchorIndex: number }} */
                const scheduleData = await api.post('games', date, {
                    anchorIndex,
                    rounds: schedule
                });
                schedule = scheduleData.rounds || [];
                anchorIndex = scheduleData.anchorIndex || 0;
                confirmRegenerate = false;
            },
            (err) => {
                console.error(err);
                setNotification(
                    err.message || 'Failed to generate schedule. Please try again.',
                    'error'
                );
                schedule = restoreSchedule;
            }
        );
    }

    /**
     * Adds more games to the current schedule
     */
    async function addMoreGames() {
        if (isPast) {
            setNotification('The date is in the past. Games cannot be changed.', 'warning');
            return;
        }
        const restoreSchedule = schedule;
        await withLoading(
            async () => {
                schedule = schedule.concat(generateFullRoundRobinSchedule(teamNames, anchorIndex));
                /** @type {{ rounds: Array<Match[]> }} */
                const gameData = await api.post('games', date, { anchorIndex, rounds: schedule });
                schedule = gameData.rounds;
            },
            (err) => {
                console.error(err);
                setNotification(
                    err.message || 'Failed to add more games. Please try again.',
                    'error'
                );
                schedule = restoreSchedule;
            }
        );
    }

    /**
     * Saves the current scores to the server
     */
    async function saveScore() {
        const restoreSchedule = schedule;
        await withLoading(
            async () => {
                /** @type {{ rounds: Array<Match[]> }} */
                const scoreData = await api.post('games', date, { anchorIndex, rounds: schedule });
                schedule = scoreData.rounds;
            },
            (err) => {
                console.error(err);
                setNotification(err.message || 'Failed to save score. Please try again.', 'error');
                schedule = restoreSchedule;
            }
        );
    }

    onMount(async () => {
        await withLoading(
            async () => {
                const teamsData = await api.get('teams', date);
                teams = teamsData || {};
                /** @type {{ rounds?: Array<Match[]>, anchorIndex?: number }} */
                const scheduleData = await api.get('games', date);
                schedule = scheduleData.rounds || [];
                anchorIndex = scheduleData.anchorIndex || 0;
            },
            (err) => {
                console.error('Error fetching teams:', err);
                setNotification(
                    err.message || 'Failed to load team and schedule data. Please try again.',
                    'error'
                );
            }
        );
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

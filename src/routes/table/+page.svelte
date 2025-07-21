<script>
    import {
        Table,
        TableHead,
        TableHeadCell,
        TableBody,
        TableBodyRow,
        TableBodyCell,
        Button,
        Alert
    } from 'flowbite-svelte';
    import { onMount } from 'svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import TeamBadge from '$components/TeamBadge.svelte';
    import { CalendarMonthSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import { isDateInPast, teamColours } from '$lib/shared/helpers.js';

    let { data } = $props();
    const date = data.date;

    let schedule = $state([]);
    let teams = $state({});
    let standings = $state([]);

    let winningTeam = $state({
        name: null,
        colour: null
    });
    let celebrating = $state(false);

    function calculateStandings(matchups) {
        const table = {};

        for (const matchup of matchups) {
            const { home, away, homeScore, awayScore } = matchup;
            if (homeScore === null || awayScore === null || matchup.bye) continue; // Skip unrecorded and bye matches

            for (const team of [home, away]) {
                if (!table[team]) {
                    table[team] = {
                        team,
                        played: 0,
                        wins: 0,
                        draws: 0,
                        losses: 0,
                        goalsFor: 0,
                        goalsAgainst: 0,
                        points: 0
                    };
                }
            }

            const homeTeam = table[home];
            const awayTeam = table[away];

            homeTeam.played++;
            awayTeam.played++;

            homeTeam.goalsFor += homeScore;
            homeTeam.goalsAgainst += awayScore;

            awayTeam.goalsFor += awayScore;
            awayTeam.goalsAgainst += homeScore;

            if (homeScore > awayScore) {
                homeTeam.wins++;
                awayTeam.losses++;
                homeTeam.points += 3;
            } else if (homeScore < awayScore) {
                awayTeam.wins++;
                homeTeam.losses++;
                awayTeam.points += 3;
            } else {
                homeTeam.draws++;
                awayTeam.draws++;
                homeTeam.points += 1;
                awayTeam.points += 1;
            }
        }

        return Object.values(table).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const gdA = a.goalsFor - a.goalsAgainst;
            const gdB = b.goalsFor - b.goalsAgainst;
            if (gdB !== gdA) return gdB - gdA;
            return b.goalsFor - a.goalsFor;
        });
    }

    function celebrate(index) {
        if (index !== 0 || !isDateInPast(new Date(date))) return;
        winningTeam.name = standings[index].team;
        winningTeam.colour =
            teamColours[Object.keys(teams).indexOf(winningTeam.name) % teamColours.length];
        celebrating = true;
    }

    onMount(async () => {
        await withLoading(
            async () => {
                teams = (await api.get('teams', date)) || {};
                const scheduleData = await api.get('games', date);
                schedule = scheduleData.rounds || [];
                const flatMatches =
                    Array.isArray(schedule) && schedule.every(Array.isArray) ? schedule.flat() : [];
                standings = calculateStandings(flatMatches);
                if (standings.length > 0) {
                    celebrate(0);
                }
            },
            (err) => {
                console.error('Error calculating table:', err);
                setNotification(
                    err.message || 'Failed to load team and schedule data. Please try again.',
                    'error'
                );
            }
        );
    });
</script>

{#if standings.length > 0}
    <Table
        class="w-full text-xs"
        shadow>
        <TableHead>
            <TableHeadCell class="px-1 py-1.5 text-center">#</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">Team</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">P</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">W</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">D</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">L</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center text-black dark:text-white"
                >Pts</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">GF</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">GA</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 text-center">GD</TableHeadCell>
        </TableHead>
        <TableBody>
            {#each standings as team, index (index)}
                <TableBodyRow>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {index + 1}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center"
                        ><div
                            class="flex justify-between"
                            onclick={() => celebrate(index)}
                            onkeydown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    celebrate(index);
                                }
                            }}
                            tabindex="0"
                            role="button">
                            <TeamBadge
                                className="w-full"
                                teamName={team.team}
                                {teams} />
                        </div>
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {team.played}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {team.wins}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {team.draws}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {team.losses}
                    </TableBodyCell>
                    <TableBodyCell
                        class="px-1 py-1.5 text-center font-bold text-black dark:text-white">
                        {team.points}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {team.goalsFor}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {team.goalsAgainst}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {team.goalsFor - team.goalsAgainst}
                    </TableBodyCell>
                </TableBodyRow>
            {/each}
        </TableBody>
    </Table>
{:else}
    <Alert class="flex items-center border py-2"
        ><ExclamationCircleSolid /><span>
            Schedule some <Button
                color="alternative"
                href="/games?date={data.date}"
                size="xs"
                ><CalendarMonthSolid class="me-2 h-4 w-4"></CalendarMonthSolid>Games</Button> and enter
            their scores to see the standings.</span>
    </Alert>
{/if}

<CelebrationOverlay
    bind:celebrating
    teamName={winningTeam.name}
    teamColour={winningTeam.colour} />

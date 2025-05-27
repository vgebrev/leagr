<script>
    import {
        Table,
        TableHead,
        TableHeadCell,
        TableBody,
        TableBodyRow,
        TableBodyCell,
        Button
    } from 'flowbite-svelte';
    import { onMount } from 'svelte';
    import { api } from '$lib/api-client.js';
    import { setError } from '$lib/stores/error.js';
    import { isLoading } from '$lib/stores/loading.js';
    import TeamBadge from '../../components/TeamBadge.svelte';
    import { CalendarMonthSolid } from 'flowbite-svelte-icons';

    let { data } = $props();
    const date = data.date;
    let schedule = $state([]);
    let teams = $state({});
    let standings = $state([]);

    function calculateStandings(matchups) {
        const table = {};

        for (const matchup of matchups) {
            const { home, away, homeScore, awayScore } = matchup;
            if (homeScore === null || awayScore === null || matchup.bye) continue; // Skip unrecorded and bye matches
            // Initialize teams if needed
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

        // Convert to array and sort
        return Object.values(table).sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            const gdA = a.goalsFor - a.goalsAgainst;
            const gdB = b.goalsFor - b.goalsAgainst;
            if (gdB !== gdA) return gdB - gdA;
            return b.goalsFor - a.goalsFor;
        });
    }

    onMount(async () => {
        try {
            $isLoading = true;
            const teamData = await api.get('teams', date);
            teams = teamData.teams;
            const scheduleData = await api.get('games', date);
            schedule = scheduleData.rounds || [];
            const flatMatches =
                Array.isArray(schedule) && schedule.every(Array.isArray) ? schedule.flat() : [];
            standings = calculateStandings(flatMatches);
        } catch (ex) {
            console.error('Error fetching teams:', ex);
            setError('Failed to load team and schedule data. Please try again.');
        } finally {
            $isLoading = false;
        }
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
                        ><div class="flex justify-between">
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
    <div class="py-2">
        Schedule some <Button
            color="alternative"
            href="/games?date={data.date}"
            size="xs"><CalendarMonthSolid class="me-2 h-4 w-4"></CalendarMonthSolid>Games</Button> and
        enter their scores to see the standings.
    </div>
{/if}

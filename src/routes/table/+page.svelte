<script>
    import { onMount } from 'svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { settings } from '$lib/client/stores/settings.js';
    import StandingsTable from './components/StandingsTable.svelte';
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import TeamModal from '$components/TeamModal.svelte';
    import GoalscorerList from '$components/GoalscorerList.svelte';
    import { isCompetitionEnded, teamColours } from '$lib/shared/helpers.js';

    let { data } = $props();
    const date = $derived(data.date);

    let showTeamModal = $state(false);
    let selectedTeam = $state(null);

    function handleTeamClick(teamName) {
        selectedTeam = teamName;
        showTeamModal = true;
    }

    let standings = $state([]);
    let leagueGames = $state([]);
    let knockoutGames = $state([]);
    let teams = $state({});

    /**
     * @typedef {Object} WinningTeam
     * @property {string} name
     * @property {import('$lib/shared/helpers.js').TeamColour} colour
     */

    /** @type {WinningTeam} */
    let winningTeam = $state({
        name: '',
        colour: 'blue'
    });

    let celebrating = $state(false);

    /**
     * Celebrate the winning team.
     * @param {number} index - The index of the team in the standings.
     */
    function celebrate(index) {
        if (index !== 0 || !isCompetitionEnded(date, $settings)) return;
        winningTeam.name = standings[index].team;
        winningTeam.colour =
            teamColours[teamColours.indexOf(winningTeam.name.split(' ')[0]) % teamColours.length] ||
            'default';
        celebrating = true;
    }

    onMount(async () => {
        await withLoading(
            async () => {
                // Load standings, games data, and teams data
                const [standingsData, gamesData, teamsData] = await Promise.all([
                    api.get('standings', date),
                    api.get('games', date),
                    api.get('teams', date)
                ]);

                standings = standingsData.standings || [];
                leagueGames = gamesData?.rounds || [];
                teams = teamsData?.teams || {};

                // Try to load knockout games (may not exist)
                try {
                    const knockoutData = await api.get('games/knockout', date);
                    knockoutGames = knockoutData?.knockoutGames?.bracket || [];
                } catch (err) {
                    // Knockout games might not exist, that's okay
                    if (err.status !== 404) {
                        console.warn('Error loading knockout games:', err);
                    }
                    knockoutGames = [];
                }

                if (standings.length > 0) {
                    celebrate(0);
                }
            },
            (err) => {
                console.error('Error loading table:', err);
                setNotification(
                    err.message || 'Failed to load standings data. Please try again.',
                    'error'
                );
            }
        );
    });
</script>

<div class="flex flex-col gap-4">
    <div class="overflow-x-auto">
        <StandingsTable
            {standings}
            {date}
            onCelebrate={celebrate}
            onTeamClick={handleTeamClick} />
    </div>

    <GoalscorerList
        {leagueGames}
        {knockoutGames}
        {teams} />
</div>

<CelebrationOverlay
    bind:celebrating
    teamName={winningTeam.name}
    teamColour={winningTeam.colour} />

<TeamModal
    bind:teamName={selectedTeam}
    {date}
    bind:open={showTeamModal} />

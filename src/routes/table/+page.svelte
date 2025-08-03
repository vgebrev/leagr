<script>
    import { onMount } from 'svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { settings } from '$lib/client/stores/settings.js';
    import StandingsTable from './components/StandingsTable.svelte';
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import { isCompetitionEnded, teamColours } from '$lib/shared/helpers.js';

    let { data } = $props();
    const date = data.date;

    let standings = $state([]);

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
                // Load standings
                const standingsData = await api.get('standings', date);
                standings = standingsData.standings || [];
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

<StandingsTable
    {standings}
    {date}
    onTeamClick={celebrate} />

<CelebrationOverlay
    bind:celebrating
    teamName={winningTeam.name}
    teamColour={winningTeam.colour} />

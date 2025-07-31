<script>
    import { onMount } from 'svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import StandingsTable from './components/StandingsTable.svelte';
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import { isDateInPast, teamColours } from '$lib/shared/helpers.js';

    let { data } = $props();
    const date = data.date;

    let teams = $state({});
    let standings = $state([]);

    let winningTeam = $state({
        name: null,
        colour: null
    });
    let celebrating = $state(false);

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
    {teams}
    {date}
    onTeamClick={celebrate} />

<CelebrationOverlay
    bind:celebrating
    teamName={winningTeam.name}
    teamColour={winningTeam.colour} />

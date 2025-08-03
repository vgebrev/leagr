<script>
    import { onMount } from 'svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { settings } from '$lib/client/stores/settings.js';
    import StandingsTable from './components/StandingsTable.svelte';
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import KnockoutBracket from './components/KnockoutBracket.svelte';
    import { isCompetitionEnded, teamColours } from '$lib/shared/helpers.js';

    let { data } = $props();
    const date = data.date;

    let standings = $state([]);
    let knockoutBracket = $state(null);

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

    /**
     * Handle knockout match score update
     * @param {Object} updatedMatch - Updated match object
     */
    async function handleKnockoutMatchUpdate(updatedMatch) {
        if (!knockoutBracket) return;

        // Update the local bracket immediately for responsiveness
        const updatedBracket = { ...knockoutBracket };
        const matchIndex = updatedBracket.bracket.findIndex(
            (match) => match.round === updatedMatch.round && match.match === updatedMatch.match
        );

        if (matchIndex !== -1) {
            updatedBracket.bracket[matchIndex] = updatedMatch;
            knockoutBracket = updatedBracket;

            // Save to server
            await withLoading(
                async () => {
                    const requestData = {
                        operation: 'updateScores',
                        bracket: updatedBracket.bracket
                    };

                    const response = await api.post('games/knockout', date, requestData);
                    // Update with the response data that includes advanced winners
                    knockoutBracket = response.knockoutGames;
                },
                (err) => {
                    console.error('Error saving knockout scores:', err);
                    setNotification(
                        err.message || 'Failed to save knockout scores. Please try again.',
                        'error'
                    );
                    // Revert on error - reload knockout data
                    reloadKnockoutData();
                }
            );
        }
    }

    /**
     * Reload knockout tournament data after error
     */
    async function reloadKnockoutData() {
        await withLoading(
            async () => {
                const knockoutData = await api.get('games/knockout', date);
                knockoutBracket = knockoutData.knockoutGames;
            },
            () => {
                // If reload fails, just set to null
                knockoutBracket = null;
            }
        );
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

                // Load knockout data - this might fail if no tournament exists yet
                // We'll handle 404 errors gracefully since knockout tournaments are optional
                try {
                    const knockoutData = await api.get('games/knockout', date);
                    knockoutBracket = knockoutData.knockoutGames;
                } catch (knockoutErr) {
                    // If it's a 404, that's fine - no knockout tournament exists
                    if (knockoutErr.status !== 404) {
                        throw knockoutErr; // Re-throw non-404 errors
                    }
                    knockoutBracket = null;
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

<KnockoutBracket
    bracket={knockoutBracket}
    disabled={isCompetitionEnded(date, $settings)}
    onMatchUpdate={handleKnockoutMatchUpdate} />

<CelebrationOverlay
    bind:celebrating
    teamName={winningTeam.name}
    teamColour={winningTeam.colour} />

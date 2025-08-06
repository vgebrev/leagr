<script>
    import { onMount } from 'svelte';
    import { Alert, Button } from 'flowbite-svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { settings } from '$lib/client/stores/settings.js';
    import KnockoutBracket from './components/KnockoutBracket.svelte';
    import TrophyIcon from '$components/TrophyIcon.svelte';
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';
    import { isCompetitionEnded, teamColours } from '$lib/shared/helpers.js';
    import { CalendarMonthSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';

    let { data } = $props();
    const date = data.date;

    let knockoutBracket = $state(null);
    let standings = $state([]);
    let hasStandings = $derived(standings.length > 0);

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
    let showConfirmRegenerate = $state(false);

    /**
     * Check for a tournament winner and celebrate
     */
    function checkForWinner() {
        if (!knockoutBracket || !knockoutBracket.bracket) return;

        // Find the final match
        const finalMatch = knockoutBracket.bracket.find((match) => match.round === 'final');

        if (finalMatch && finalMatch.homeScore !== null && finalMatch.awayScore !== null) {
            // Determine winner
            const winner =
                finalMatch.homeScore > finalMatch.awayScore ? finalMatch.home : finalMatch.away;

            if (winner && winner !== winningTeam.name) {
                winningTeam.name = winner;
                // Extract team color from name (first word)
                const firstWord = winner.split(' ')[0].toLowerCase();
                winningTeam.colour = teamColours.includes(firstWord) ? firstWord : 'blue';
                celebrating = true;
            }
        }
    }

    /**
     * Celebrate the winning team when clicked
     * @param {string} teamName - The team name that was clicked
     */
    function celebrateTeam(teamName) {
        if (!knockoutBracket || !knockoutBracket.bracket) return;

        // Find the final match
        const finalMatch = knockoutBracket.bracket.find((match) => match.round === 'final');

        if (finalMatch && finalMatch.homeScore !== null && finalMatch.awayScore !== null) {
            // Check if clicked team is the winner
            const winner =
                finalMatch.homeScore > finalMatch.awayScore ? finalMatch.home : finalMatch.away;

            if (winner && teamName === winner) {
                winningTeam.name = winner;
                // Extract team color from name (first word)
                const firstWord = winner.split(' ')[0].toLowerCase();
                winningTeam.colour = teamColours.includes(firstWord) ? firstWord : 'blue';
                celebrating = true;
            }
        }
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
                    // Check for tournament winner
                    checkForWinner();
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
                checkForWinner();
            },
            () => {
                // If reload fails, just set to null
                knockoutBracket = null;
            }
        );
    }

    /**
     * Handle adding knockout games with confirmation if bracket exists
     * @param {boolean} forceRegenerate - Whether to force regeneration
     */
    async function handleAddKnockoutGames(forceRegenerate = false) {
        if (knockoutBracket && !forceRegenerate) {
            showConfirmRegenerate = true;
            return;
        }

        showConfirmRegenerate = false;

        await withLoading(
            async () => {
                const requestData = {
                    operation: 'generate'
                };

                const response = await api.post('games/knockout', date, requestData);
                knockoutBracket = response.knockoutGames;
                checkForWinner();
                setNotification('Knockout cup started!', 'success');
            },
            (err) => {
                console.error('Error generating knockout games:', err);
                setNotification(
                    err.message || 'Failed to generate knockout games. Please try again.',
                    'error'
                );
            }
        );
    }

    onMount(async () => {
        await withLoading(
            async () => {
                // Load standings to check if we have completed games
                const standingsData = await api.get('standings', date);
                standings = standingsData.standings || [];

                // Load knockout data - this might fail if no tournament exists yet
                // We'll handle 404 errors gracefully since knockout tournaments are optional
                try {
                    const knockoutData = await api.get('games/knockout', date);
                    knockoutBracket = knockoutData.knockoutGames;
                    checkForWinner();
                } catch (knockoutErr) {
                    // If it's a 404, that's fine - no knockout tournament exists
                    if (knockoutErr.status !== 404) {
                        throw knockoutErr; // Re-throw non-404 errors
                    }
                    knockoutBracket = null;
                }
            },
            (err) => {
                console.error('Error loading knockout data:', err);
                setNotification(
                    err.message || 'Failed to load knockout data. Please try again.',
                    'error'
                );
            }
        );
    });
</script>

<div class="flex flex-col gap-2">
    {#if !hasStandings}
        <Alert class="flex items-center border py-2"
            ><ExclamationCircleSolid /><span>
                The knockout cup phase is only available after some league <Button
                    color="alternative"
                    class="align-middle"
                    href="/games?date={date}"
                    size="xs"
                    ><CalendarMonthSolid class="me-2 h-4 w-4"></CalendarMonthSolid>Games</Button> have
                been played.</span>
        </Alert>
    {:else}
        <Button
            onclick={() => handleAddKnockoutGames(false)}
            disabled={isCompetitionEnded(date, $settings)}>
            <TrophyIcon class="me-2 h-4 w-4" />
            Start Knockout Cup Phase
        </Button>

        <!-- Regeneration confirmation -->
        {#if showConfirmRegenerate}
            <Alert class="flex items-center border">
                <ExclamationCircleSolid />
                <span
                    >A knockout cup is already in progress. Are you sure you want to reset it?</span>
                <Button
                    size="xs"
                    onclick={() => handleAddKnockoutGames(true)}>
                    Yes
                </Button>
            </Alert>
        {/if}
        {#if knockoutBracket}
            <KnockoutBracket
                bracket={knockoutBracket}
                disabled={isCompetitionEnded(date, $settings)}
                onMatchUpdate={handleKnockoutMatchUpdate}
                onTeamClick={celebrateTeam} />
        {/if}
    {/if}
</div>

<CelebrationOverlay
    bind:celebrating
    teamName={winningTeam.name}
    teamColour={winningTeam.colour}
    icon="🏆" />

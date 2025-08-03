<script>
    import { Card, Input } from 'flowbite-svelte';
    import TeamBadge from '$components/TeamBadge.svelte';
    import TrophyIcon from '$components/TrophyIcon.svelte';

    let { bracket = null, onMatchUpdate = null, disabled = false } = $props();

    /**
     * Get matches for a specific round
     * @param {string} round - Round name
     * @returns {Array} Matches for the round
     */
    function getMatchesForRound(round) {
        if (!bracket?.bracket) return [];
        return bracket.bracket.filter((match) => match.round === round);
    }

    /**
     * Get all unique rounds in order
     * @returns {Array} Round names in tournament order
     */
    function getRounds() {
        if (!bracket?.bracket) return [];

        const rounds = [...new Set(bracket.bracket.map((match) => match.round))];

        // Sort rounds by typical tournament order
        const roundOrder = ['quarter', 'semi', 'final'];
        return rounds.sort((a, b) => {
            const indexA = roundOrder.indexOf(a);
            const indexB = roundOrder.indexOf(b);

            // Handle custom round names (round-of-16, etc.)
            if (indexA === -1 && indexB === -1) {
                return a.localeCompare(b);
            }
            if (indexA === -1) return -1;
            if (indexB === -1) return 1;

            return indexA - indexB;
        });
    }

    /**
     * Format round name for display
     * @param {string} round - Round name
     * @returns {string} Formatted round name
     */
    function formatRoundName(round) {
        switch (round) {
            case 'quarter':
                return 'Quarter Finals';
            case 'semi':
                return 'Semi Finals';
            case 'final':
                return 'Final';
            default:
                return round.charAt(0).toUpperCase() + round.slice(1).replace('-', ' ');
        }
    }

    /**
     * Handle score input change
     * @param {Object} match - Match object
     * @param {string} team - 'home' or 'away'
     * @param {Event} event - Input event
     */
    function handleScoreChange(match, team, event) {
        if (disabled || !onMatchUpdate) return;

        const value = event.target.value;
        const numericValue = value === '' ? null : parseInt(value, 10);

        let homeScore = match.homeScore;
        let awayScore = match.awayScore;

        if (team === 'home') {
            homeScore = numericValue;
            // Auto-set logic
            if (numericValue === null) {
                // If the home score is cleared, clear the away score too
                awayScore = null;
            } else if (match.awayScore === null || match.awayScore === undefined) {
                // If the home score is set and the away score is blank, set away to 0
                awayScore = 0;
            }
        } else {
            awayScore = numericValue;
            // Auto-set logic
            if (numericValue === null) {
                // If the away score is cleared, clear the home score too
                homeScore = null;
            } else if (match.homeScore === null || match.homeScore === undefined) {
                // If the away score is set and the home score is blank, set home to 0
                homeScore = 0;
            }
        }

        const updatedMatch = {
            ...match,
            homeScore,
            awayScore
        };

        onMatchUpdate(updatedMatch);
    }

    /**
     * Check if a team is the loser of a match
     * @param {Object} match - Match object
     * @param {string} team - Team name ('home' or 'away')
     * @returns {boolean} True if team lost
     */
    function isLoser(match, team) {
        if (match.homeScore === null || match.awayScore === null) return false;
        if (match.homeScore === match.awayScore) return false; // Draw

        if (team === 'home') {
            return match.homeScore < match.awayScore;
        } else {
            return match.awayScore < match.homeScore;
        }
    }
</script>

{#if bracket && bracket.teams.length > 0}
    <div class="mt-4 w-full">
        <div class="mb-2 flex items-center gap-2">
            <TrophyIcon class="h-4 w-4" />
            <h3 class="text-lg font-semibold">Knockout Tournament</h3>
        </div>

        <div class="space-y-2">
            {#each getRounds() as round, i (i)}
                {@const matches = getMatchesForRound(round)}
                {#if matches.length > 0}
                    <div>
                        <div
                            class="grid gap-2"
                            class:grid-cols-1={round === 'final'}
                            class:grid-cols-2={round !== 'final'}
                            class:place-items-center={round === 'final'}>
                            <div
                                class="w-full max-w-sm"
                                class:col-span-2={round !== 'final'}>
                                <h4 class="text-md font-medium">{formatRoundName(round)}</h4>
                            </div>
                            {#each matches as match (match.round + '-' + match.match)}
                                <Card class="p-2 pt-1">
                                    <div class="flex items-center justify-between">
                                        <div class="text-xs text-gray-500">
                                            Match {match.match}
                                        </div>
                                    </div>

                                    <!-- Home Team -->
                                    <div class="mt-2 flex justify-between gap-2">
                                        <div class="flex w-full overflow-hidden">
                                            {#if match.home}
                                                <TeamBadge
                                                    teamName={match.home}
                                                    className="text-sm w-full {isLoser(
                                                        match,
                                                        'home'
                                                    )
                                                        ? 'line-through opacity-50'
                                                        : ''}" />
                                            {:else}
                                                <span
                                                    class="w-full text-center text-sm text-gray-400 italic"
                                                    >TBD</span>
                                            {/if}
                                        </div>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="20"
                                            value={match.homeScore ?? ''}
                                            size="sm"
                                            class="w-12 text-center"
                                            disabled={disabled || !match.home}
                                            onchange={(e) => handleScoreChange(match, 'home', e)}
                                            onfocus={(e) => e.target.select()} />
                                    </div>

                                    <!-- Away Team -->
                                    <div class="mt-2 flex justify-between gap-2">
                                        <div class="flex w-full overflow-hidden">
                                            {#if match.away}
                                                <TeamBadge
                                                    teamName={match.away}
                                                    className="text-sm w-full {isLoser(
                                                        match,
                                                        'away'
                                                    )
                                                        ? 'line-through opacity-50'
                                                        : ''}" />
                                            {:else}
                                                <span
                                                    class="w-full text-center text-sm text-gray-400 italic"
                                                    >TBD</span>
                                            {/if}
                                        </div>
                                        <Input
                                            type="number"
                                            min="0"
                                            max="20"
                                            value={match.awayScore ?? ''}
                                            size="sm"
                                            class="w-12 text-center"
                                            disabled={disabled || !match.away}
                                            onchange={(e) => handleScoreChange(match, 'away', e)}
                                            onfocus={(e) => e.target.select()} />
                                    </div>
                                </Card>
                            {/each}
                        </div>
                    </div>
                {/if}
            {/each}
        </div>
    </div>
{/if}

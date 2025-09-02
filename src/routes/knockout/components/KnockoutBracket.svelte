<script>
    import { Card, Input } from 'flowbite-svelte';
    import TeamBadge from '$components/TeamBadge.svelte';

    let { bracket = null, onMatchUpdate = null, onTeamClick = null, disabled = false } = $props();

    /**
     * Handle team badge click
     * @param {string} teamName - Name of the clicked team
     */
    function handleTeamClick(teamName) {
        if (onTeamClick) {
            onTeamClick(teamName);
        }
    }

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
        if (isScoreInputDisabled(match) || !onMatchUpdate) return;

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

    /**
     * Check if score input should be disabled for a match
     * @param {Object} match - Match object
     * @returns {boolean} True if score input should be disabled
     */
    function isScoreInputDisabled(match) {
        // Disable if component is disabled
        if (disabled) return true;

        // Disable if it's a bye match
        if (match.bye) return true;

        // Disable if either team is null/TBD or BYE
        return !match.home || !match.away || match.home === 'BYE' || match.away === 'BYE';
    }
</script>

{#if bracket && bracket.teams.length > 0}
    <div class="w-full space-y-2">
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
                            <Card class="glass p-2 pt-1">
                                <div class="flex items-center justify-between">
                                    <div class="text-xs text-gray-300">
                                        Match {match.match}
                                    </div>
                                </div>

                                <!-- Home Team -->
                                <div class="mt-2 flex justify-between gap-2">
                                    <div
                                        class="flex w-full overflow-hidden"
                                        onclick={() => handleTeamClick(match.home)}
                                        onkeydown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                handleTeamClick(match.home);
                                            }
                                        }}
                                        tabindex="0"
                                        role="button">
                                        {#if match.home && match.home !== 'BYE'}
                                            <TeamBadge
                                                teamName={match.home}
                                                className="text-sm w-full {isLoser(match, 'home')
                                                    ? 'line-through opacity-50'
                                                    : ''}" />
                                        {:else if match.home === 'BYE'}
                                            <span
                                                class="w-full text-center text-sm text-gray-400 italic"
                                                >BYE</span>
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
                                        disabled={isScoreInputDisabled(match)}
                                        onchange={(e) => handleScoreChange(match, 'home', e)}
                                        onfocus={(e) => e.target.select()} />
                                </div>

                                <!-- Away Team -->
                                <div class="mt-2 flex justify-between gap-2">
                                    <div
                                        class="flex w-full overflow-hidden"
                                        onclick={() => handleTeamClick(match.away)}
                                        onkeydown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                handleTeamClick(match.away);
                                            }
                                        }}
                                        tabindex="0"
                                        role="button">
                                        {#if match.away && match.away !== 'BYE'}
                                            <TeamBadge
                                                teamName={match.away}
                                                className="text-sm w-full {isLoser(match, 'away')
                                                    ? 'line-through opacity-50'
                                                    : ''}" />
                                        {:else if match.away === 'BYE'}
                                            <span
                                                class="w-full text-center text-sm text-gray-400 italic"
                                                >BYE</span>
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
                                        disabled={isScoreInputDisabled(match)}
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
{/if}

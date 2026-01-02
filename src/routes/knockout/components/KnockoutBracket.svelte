<script>
    import { Card } from 'flowbite-svelte';
    import TeamBadge from '$components/TeamBadge.svelte';
    import MatchCard from '$components/MatchCard.svelte';

    let {
        bracket = null,
        teams = {},
        onMatchUpdate = null,
        onCelebrate = null,
        onTeamClick = null,
        disabled = false
    } = $props();

    /**
     * Handle team row click for celebration
     * @param {string} teamName - Name of the clicked team
     */
    function handleCelebrate(teamName) {
        if (onCelebrate) {
            onCelebrate(teamName);
        }
    }

    /**
     * Handle team badge click for modal
     * @param {string} teamName - Name of the clicked team
     */
    function handleTeamBadgeClick(teamName) {
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
    function isMatchDisabled(match) {
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

                                {#if match.home && match.home !== 'BYE' && match.away && match.away !== 'BYE'}
                                    <!-- Use MatchCard for valid matches -->
                                    <div
                                        onclick={() => {
                                            // Celebrate the winner if match is complete
                                            if (
                                                match.homeScore !== null &&
                                                match.awayScore !== null
                                            ) {
                                                const winner =
                                                    match.homeScore > match.awayScore
                                                        ? match.home
                                                        : match.away;
                                                handleCelebrate(winner);
                                            }
                                        }}
                                        onkeydown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                if (
                                                    match.homeScore !== null &&
                                                    match.awayScore !== null
                                                ) {
                                                    const winner =
                                                        match.homeScore > match.awayScore
                                                            ? match.home
                                                            : match.away;
                                                    handleCelebrate(winner);
                                                }
                                            }
                                        }}
                                        tabindex="0"
                                        role="button">
                                        <MatchCard
                                            {match}
                                            matchId={`${match.round}-${match.match}`}
                                            {teams}
                                            orientation="vertical"
                                            disabled={isMatchDisabled(match)}
                                            onUpdate={onMatchUpdate}
                                            onTeamClick={handleTeamBadgeClick} />
                                    </div>
                                {:else}
                                    <!-- Fallback for BYE/TBD teams -->
                                    <div class="mt-2 flex justify-between gap-2">
                                        <div class="flex w-full overflow-hidden">
                                            {#if match.home === 'BYE'}
                                                <span
                                                    class="w-full text-center text-sm text-gray-400 italic"
                                                    >BYE</span>
                                            {:else if !match.home}
                                                <span
                                                    class="w-full text-center text-sm text-gray-400 italic"
                                                    >TBD</span>
                                            {:else}
                                                <TeamBadge
                                                    teamName={match.home}
                                                    onclick={() => handleTeamBadgeClick(match.home)}
                                                    className="w-full text-sm {isLoser(
                                                        match,
                                                        'home'
                                                    )
                                                        ? 'opacity-50 line-through'
                                                        : ''}" />
                                            {/if}
                                        </div>
                                    </div>
                                    <div class="mt-2 flex justify-between gap-2">
                                        <div class="flex w-full overflow-hidden">
                                            {#if match.away === 'BYE'}
                                                <span
                                                    class="w-full text-center text-sm text-gray-400 italic"
                                                    >BYE</span>
                                            {:else if !match.away}
                                                <span
                                                    class="w-full text-center text-sm text-gray-400 italic"
                                                    >TBD</span>
                                            {:else}
                                                <TeamBadge
                                                    teamName={match.away}
                                                    onclick={() => handleTeamBadgeClick(match.away)}
                                                    className="w-full text-sm {isLoser(
                                                        match,
                                                        'away'
                                                    )
                                                        ? 'opacity-50 line-through'
                                                        : ''}" />
                                            {/if}
                                        </div>
                                    </div>
                                {/if}
                            </Card>
                        {/each}
                    </div>
                </div>
            {/if}
        {/each}
    </div>
{/if}

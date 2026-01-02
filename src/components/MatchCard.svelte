<script>
    import { Input } from 'flowbite-svelte';
    import TeamBadge from '$components/TeamBadge.svelte';
    import { validateGameScore } from '$lib/shared/validation.js';
    import ScorerPopover from '$components/ScorerPopover.svelte';

    /**
     * @typedef {'horizontal' | 'vertical'} Orientation
     * @typedef {Object} MatchCardProps
     * @property {Object} match - Match object with home, away, homeScore, awayScore, homeScorers, awayScorers
     * @property {string} matchId - Unique identifier for this match (used for input IDs)
     * @property {Object} [teams] - Teams object mapping team names to player arrays
     * @property {Orientation} [orientation] - Layout orientation
     * @property {boolean} [disabled] - Whether inputs are disabled
     * @property {Function} [onUpdate] - Callback when match is updated
     * @property {Function} [onTeamClick] - Callback when team badge is clicked
     * @property {string} [className] - Additional CSS classes
     */

    /** @type {MatchCardProps} */
    let {
        match,
        matchId,
        teams = {},
        orientation = 'horizontal',
        disabled = false,
        onUpdate,
        onTeamClick,
        className = ''
    } = $props();

    // Generate unique IDs for score inputs
    const homeScoreId = `home-score-${matchId}`;
    const awayScoreId = `away-score-${matchId}`;

    let homeScoreInput = $derived(match.homeScore?.toString() || '');
    let awayScoreInput = $derived(match.awayScore?.toString() || '');
    let homeScoreError = $state('');
    let awayScoreError = $state('');
    let homePopoverOpen = $state(false);
    let awayPopoverOpen = $state(false);

    /**
     * Validate and update home score
     * @param {Event} event - Input change event
     */
    function handleHomeScoreChange(event) {
        const value = /** @type {HTMLInputElement} */ (event.target)?.value;

        // Clear error first
        homeScoreError = '';

        // Validate the score
        const validation = validateGameScore(value === '' ? null : parseInt(value), 'Home');

        if (!validation.isValid) {
            homeScoreError = validation.errors[0] || 'Invalid score';
            return;
        }

        // Parse and update the match
        const numericValue = value === '' ? null : parseInt(value, 10);

        let homeScore = numericValue;
        let awayScore = match.awayScore;

        // Auto-set logic
        if (numericValue === null) {
            // If the home score is cleared, clear the away score too
            awayScore = null;
        } else if (match.awayScore === null || match.awayScore === undefined) {
            // If the home score is set and the away score is blank, set away to 0
            awayScore = 0;
        }

        const updatedMatch = {
            ...match,
            homeScore,
            awayScore
        };

        // Call the parent callback
        if (onUpdate) {
            onUpdate(updatedMatch);
        }
    }

    /**
     * Validate and update away score
     * @param {Event} event - Input change event
     */
    function handleAwayScoreChange(event) {
        const value = /** @type {HTMLInputElement} */ (event.target)?.value;

        // Clear error first
        awayScoreError = '';

        // Validate the score
        const validation = validateGameScore(value === '' ? null : parseInt(value), 'Away');

        if (!validation.isValid) {
            awayScoreError = validation.errors[0] || 'Invalid score';
            return;
        }

        // Parse and update the match
        const numericValue = value === '' ? null : parseInt(value, 10);

        let homeScore = match.homeScore;
        let awayScore = numericValue;

        // Auto-set logic
        if (numericValue === null) {
            // If the away score is cleared, clear the home score too
            homeScore = null;
        } else if (match.homeScore === null || match.homeScore === undefined) {
            // If the away score is set and the home score is blank, set home to 0
            homeScore = 0;
        }

        const updatedMatch = {
            ...match,
            homeScore,
            awayScore
        };

        // Call the parent callback
        if (onUpdate) {
            onUpdate(updatedMatch);
        }
    }

    /**
     * Update scorers for a team with incremental changes
     * @param {'home' | 'away'} team - Which team to update
     * @param {{ player: string, delta: number }} change - Player and delta (+1 or -1)
     */
    function handleScorersUpdate(team, change) {
        const { player, delta } = change;

        // Get current scorers and score
        const currentScorers = team === 'home' ? match.homeScorers || {} : match.awayScorers || {};
        const currentScore = team === 'home' ? match.homeScore || 0 : match.awayScore || 0;

        // Update scorers
        const newScorers = { ...currentScorers };
        const currentCount = newScorers[player] || 0;
        const newCount = currentCount + delta;

        if (newCount > 0) {
            newScorers[player] = newCount;
        } else {
            delete newScorers[player];
        }

        // Update score (preserve manual edits + apply delta)
        const newScore = Math.max(0, currentScore + delta);

        // Auto-set logic: only auto-set opposite to 0 when first entering a score on unscored match
        let homeScore = match.homeScore;
        let awayScore = match.awayScore;

        if (team === 'home') {
            homeScore = newScore;
            // Only auto-set away to 0 if BOTH scores were null (completely unscored match)
            if (newScore > 0 && match.homeScore === null && match.awayScore === null) {
                awayScore = 0;
            }
        } else {
            awayScore = newScore;
            // Only auto-set home to 0 if BOTH scores were null (completely unscored match)
            if (newScore > 0 && match.homeScore === null && match.awayScore === null) {
                homeScore = 0;
            }
        }

        const updatedMatch = {
            ...match,
            homeScore,
            awayScore,
            [team === 'home' ? 'homeScorers' : 'awayScorers']:
                Object.keys(newScorers).length > 0 ? newScorers : null
        };

        if (onUpdate) {
            onUpdate(updatedMatch);
        }

        // Close popover
        if (team === 'home') {
            homePopoverOpen = false;
        } else {
            awayPopoverOpen = false;
        }
    }
</script>

{#if !match.bye}
    {#if orientation === 'horizontal'}
        <!-- Horizontal layout: home badge - home score - away score - away badge -->
        <div class={`flex items-center justify-between gap-2 p-2 ${className}`}>
            <!-- Home team -->
            <TeamBadge
                className="w-2/5"
                teamName={match.home}
                onclick={() => onTeamClick?.(match.home)} />

            <!-- Home score input with scorer popover -->
            <div class="relative flex flex-col items-center">
                <Input
                    id={homeScoreId}
                    type="number"
                    size="sm"
                    class={`!w-8 !text-center md:!w-16 ${homeScoreError ? 'border-red-500' : ''} ${!disabled ? 'cursor-pointer' : ''}`}
                    value={homeScoreInput}
                    onchange={handleHomeScoreChange}
                    onfocus={(e) => /** @type {HTMLInputElement} */ (e.target)?.select()}
                    {disabled}
                    min="0"
                    max="99"
                    aria-label={`${match.home} score`} />
                {#if !disabled}
                    <ScorerPopover
                        triggerId={homeScoreId}
                        teamName={match.home}
                        players={teams[match.home] || []}
                        scorers={match.homeScorers || {}}
                        bind:isOpen={homePopoverOpen}
                        onUpdate={(/** @type {{ player: string, delta: number }} */ change) =>
                            handleScorersUpdate('home', change)} />
                {/if}
                {#if homeScoreError}
                    <span class="mt-1 text-xs text-red-500">{homeScoreError}</span>
                {/if}
            </div>

            <!-- Away score input with scorer popover -->
            <div class="relative flex flex-col items-center">
                <Input
                    id={awayScoreId}
                    type="number"
                    size="sm"
                    class={`!w-8 !text-center md:!w-16 ${awayScoreError ? 'border-red-500' : ''} ${!disabled ? 'cursor-pointer' : ''}`}
                    value={awayScoreInput}
                    onchange={handleAwayScoreChange}
                    onfocus={(e) => /** @type {HTMLInputElement} */ (e.target)?.select()}
                    {disabled}
                    min="0"
                    max="99"
                    aria-label={`${match.away} score`} />
                {#if !disabled}
                    <ScorerPopover
                        triggerId={awayScoreId}
                        teamName={match.away}
                        players={teams[match.away] || []}
                        scorers={match.awayScorers || {}}
                        bind:isOpen={awayPopoverOpen}
                        onUpdate={(/** @type {{ player: string, delta: number }} */ change) =>
                            handleScorersUpdate('away', change)} />
                {/if}
                {#if awayScoreError}
                    <span class="mt-1 text-xs text-red-500">{awayScoreError}</span>
                {/if}
            </div>

            <!-- Away team -->
            <TeamBadge
                className="w-2/5"
                teamName={match.away}
                onclick={() => onTeamClick?.(match.away)} />
        </div>
    {:else}
        <!-- Vertical layout: Two rows with badges taking max horizontal space -->
        <div class={className}>
            <!-- Home Team Row -->
            <div class="mt-2 flex justify-between gap-2">
                <div class="flex w-full overflow-hidden">
                    <TeamBadge
                        teamName={match.home}
                        onclick={() => onTeamClick?.(match.home)}
                        className="w-full text-sm" />
                </div>
                <div class="relative flex flex-col items-center">
                    <Input
                        id={homeScoreId}
                        type="number"
                        min="0"
                        max="20"
                        value={homeScoreInput}
                        size="sm"
                        class={`!w-12 !text-center ${homeScoreError ? 'border-red-500' : ''} ${!disabled ? 'cursor-pointer' : ''}`}
                        {disabled}
                        onchange={handleHomeScoreChange}
                        onfocus={(e) => /** @type {HTMLInputElement} */ (e.target)?.select()}
                        aria-label={`${match.home} score`} />
                    {#if !disabled}
                        <ScorerPopover
                            triggerId={homeScoreId}
                            teamName={match.home}
                            players={teams[match.home] || []}
                            scorers={match.homeScorers || {}}
                            bind:isOpen={homePopoverOpen}
                            onUpdate={(/** @type {{ player: string, delta: number }} */ change) =>
                                handleScorersUpdate('home', change)} />
                    {/if}
                    {#if homeScoreError}
                        <span class="mt-1 text-xs text-red-500">{homeScoreError}</span>
                    {/if}
                </div>
            </div>

            <!-- Away Team Row -->
            <div class="mt-2 flex justify-between gap-2">
                <div class="flex w-full overflow-hidden">
                    <TeamBadge
                        teamName={match.away}
                        onclick={() => onTeamClick?.(match.away)}
                        className="w-full text-sm" />
                </div>
                <div class="relative flex flex-col items-center">
                    <Input
                        id={awayScoreId}
                        type="number"
                        min="0"
                        max="20"
                        value={awayScoreInput}
                        size="sm"
                        class={`!w-12 !text-center ${awayScoreError ? 'border-red-500' : ''} ${!disabled ? 'cursor-pointer' : ''}`}
                        {disabled}
                        onchange={handleAwayScoreChange}
                        onfocus={(e) => /** @type {HTMLInputElement} */ (e.target)?.select()}
                        aria-label={`${match.away} score`} />
                    {#if !disabled}
                        <ScorerPopover
                            triggerId={awayScoreId}
                            teamName={match.away}
                            players={teams[match.away] || []}
                            scorers={match.awayScorers || {}}
                            bind:isOpen={awayPopoverOpen}
                            onUpdate={(/** @type {{ player: string, delta: number }} */ change) =>
                                handleScorersUpdate('away', change)} />
                    {/if}
                    {#if awayScoreError}
                        <span class="mt-1 text-xs text-red-500">{awayScoreError}</span>
                    {/if}
                </div>
            </div>
        </div>
    {/if}
{/if}

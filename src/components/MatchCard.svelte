<script>
    import { Input } from 'flowbite-svelte';
    import TeamBadge from '$components/TeamBadge.svelte';
    import { validateGameScore, RESERVED_SCORER_KEYS } from '$lib/shared/validation.js';
    import ScorerPopover from '$components/ScorerPopover.svelte';
    import LeagueIcon from '$components/Icons/LeagueIcon.svelte';

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
    const homeScoreId = $derived(`home-score-${matchId}`);
    const awayScoreId = $derived(`away-score-${matchId}`);

    // Derived scorer arrays
    const homeScorers = $derived(formatScorers(match.homeScorers));
    const awayScorers = $derived(formatScorers(match.awayScorers));

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
     * Format scorers for display (e.g., ["J. Doe (2)", "J. Smith"])
     * @param {Object | null} scorers - Scorers object with player names as keys
     * @returns {string[]}
     */
    function formatScorers(scorers) {
        if (!scorers || Object.keys(scorers).length === 0) return [];

        return Object.entries(scorers)
            .filter(([, count]) => count > 0)
            .map(([player, count]) => {
                // Handle own goal
                if (player === RESERVED_SCORER_KEYS.OWN_GOAL) {
                    return count > 1 ? `Own Goal (${count})` : 'Own Goal';
                }

                // Abbreviate first name to initial
                const parts = player.trim().split(' ');
                const abbreviated =
                    parts.length > 1 ? `${parts[0][0]}. ${parts.slice(1).join(' ')}` : player;
                return count > 1 ? `${abbreviated} (${count})` : abbreviated;
            });
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

        // Auto-set logic: only auto-set opposite to 0 when first entering a score on a no-score match
        let homeScore = match.homeScore;
        let awayScore = match.awayScore;

        if (team === 'home') {
            homeScore = newScore;
            // Only auto-set away to 0 if BOTH scores were null (completely no-score match)
            if (newScore > 0 && match.homeScore === null && match.awayScore === null) {
                awayScore = 0;
            }
        } else {
            awayScore = newScore;
            // Only auto-set home to 0 if BOTH scores were null (completely no-score match)
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
        <!-- Horizontal layout: Two rows - badges/scores then scorers -->
        <div class={`flex flex-col p-2 ${className}`}>
            <!-- Row 1: Badges and scores -->
            <div class="flex items-center justify-between gap-2">
                <!-- Home team badge -->
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
                        class={`w-8! text-center! md:w-16! ${homeScoreError ? 'border-red-500' : ''} ${!disabled ? 'cursor-pointer' : ''}`}
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
                        class={`w-8! text-center! md:w-16! ${awayScoreError ? 'border-red-500' : ''} ${!disabled ? 'cursor-pointer' : ''}`}
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

                <!-- Away team badge -->
                <TeamBadge
                    className="w-2/5"
                    teamName={match.away}
                    onclick={() => onTeamClick?.(match.away)} />
            </div>

            <!-- Row 2: Scorers (if any) -->
            {#if homeScorers.length > 0 || awayScorers.length > 0}
                <div class="mt-1 flex justify-between gap-2 font-normal">
                    <!-- Home scorers -->
                    <div
                        class="flex w-2/5 flex-wrap items-start gap-x-1 text-left text-xs text-gray-500 dark:text-gray-400">
                        {#if homeScorers.length > 0}
                            <LeagueIcon
                                class="mt-0.5 inline-block h-3 w-3"
                                icon="soccer" />
                            {#each homeScorers as scorer, i (i)}
                                <span class="whitespace-nowrap"
                                    >{scorer}{#if i < homeScorers.length - 1},{/if}</span>
                            {/each}
                        {/if}
                    </div>

                    <!-- Spacer for score inputs -->
                    <div class="flex gap-2">
                        <div class="w-8 md:w-16"></div>
                        <div class="w-8 md:w-16"></div>
                    </div>

                    <!-- Away scorers -->
                    <div
                        class="flex w-2/5 flex-wrap items-start gap-x-1 text-left text-xs text-gray-500 dark:text-gray-400">
                        {#if awayScorers.length > 0}
                            <LeagueIcon
                                class="mt-0.5 inline-block h-3 w-3"
                                icon="soccer" />
                            {#each awayScorers as scorer, i (i)}
                                <span class="whitespace-nowrap"
                                    >{scorer}{#if i < awayScorers.length - 1},{/if}</span>
                            {/each}
                        {/if}
                    </div>
                </div>
            {/if}
        </div>
    {:else}
        <!-- Vertical layout: Badge+score rows with scorers underneath -->
        <div class={className}>
            <!-- Home Team Row -->
            <div class="mt-2 flex flex-col gap-1">
                <div class="flex justify-between gap-2">
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
                            class={`w-12! text-center! ${homeScoreError ? 'border-red-500' : ''} ${!disabled ? 'cursor-pointer' : ''}`}
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
                                onUpdate={(
                                    /** @type {{ player: string, delta: number }} */ change
                                ) => handleScorersUpdate('home', change)} />
                        {/if}
                        {#if homeScoreError}
                            <span class="mt-1 text-xs text-red-500">{homeScoreError}</span>
                        {/if}
                    </div>
                </div>
                {#if homeScorers.length > 0}
                    <div
                        class="flex flex-wrap items-start gap-x-1 text-left text-xs text-gray-500 dark:text-gray-400">
                        <LeagueIcon
                            class="mt-0.5 inline-block h-3 w-3"
                            icon="soccer" />
                        {#each homeScorers as scorer, i (i)}
                            <span class="whitespace-nowrap"
                                >{scorer}{#if i < homeScorers.length - 1},{/if}</span>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Away Team Row -->
            <div class="mt-2 flex flex-col gap-1">
                <div class="flex justify-between gap-2">
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
                            class={`w-12! text-center! ${awayScoreError ? 'border-red-500' : ''} ${!disabled ? 'cursor-pointer' : ''}`}
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
                                onUpdate={(
                                    /** @type {{ player: string, delta: number }} */ change
                                ) => handleScorersUpdate('away', change)} />
                        {/if}
                        {#if awayScoreError}
                            <span class="mt-1 text-xs text-red-500">{awayScoreError}</span>
                        {/if}
                    </div>
                </div>
                {#if awayScorers.length > 0}
                    <div
                        class="flex flex-wrap items-center gap-x-1 text-left text-xs text-gray-500 dark:text-gray-400">
                        <LeagueIcon
                            class="mt-0.5 inline-block h-3 w-3"
                            icon="soccer" />
                        {#each awayScorers as scorer, i (i)}
                            <span class="whitespace-nowrap"
                                >{scorer}{#if i < awayScorers.length - 1},{/if}</span>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>
    {/if}
{/if}

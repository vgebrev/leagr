<script>
    import { Input } from 'flowbite-svelte';
    import TeamBadge from '$components/TeamBadge.svelte';
    import { validateGameScore } from '$lib/shared/validation.js';
    import ScorerPopover from './ScorerPopover.svelte';

    let {
        match,
        teams = {}, // Teams object mapping team names to player arrays
        onScoreChange,
        onTeamClick,
        roundIndex,
        matchIndex,
        disabled = false,
        className = ''
    } = $props();

    // Generate unique IDs for this specific match instance
    const homeScoreId = `home-score-r${roundIndex}-m${matchIndex}`;
    const awayScoreId = `away-score-r${roundIndex}-m${matchIndex}`;

    let homeScoreInput = $derived(match.homeScore?.toString() || '');
    let awayScoreInput = $derived(match.awayScore?.toString() || '');
    let homeScoreError = $state('');
    let awayScoreError = $state('');

    // Calculate assigned scorers for display
    let homeScorersAssigned = $derived(
        match.homeScorers
            ? Object.values(match.homeScorers).reduce((sum, count) => sum + count, 0)
            : 0
    );
    let awayScorersAssigned = $derived(
        match.awayScorers
            ? Object.values(match.awayScorers).reduce((sum, count) => sum + count, 0)
            : 0
    );

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
        if (onScoreChange) {
            onScoreChange(updatedMatch);
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
        if (onScoreChange) {
            onScoreChange(updatedMatch);
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

        const updatedMatch = {
            ...match,
            [team === 'home' ? 'homeScore' : 'awayScore']: newScore > 0 ? newScore : null,
            [team === 'home' ? 'homeScorers' : 'awayScorers']:
                Object.keys(newScorers).length > 0 ? newScorers : null
        };

        if (onScoreChange) {
            onScoreChange(updatedMatch);
        }

        // Close popover by triggering click on trigger element (toggles popover closed)
        const triggerId = team === 'home' ? homeScoreId : awayScoreId;
        const triggerElement = document.getElementById(triggerId);
        if (triggerElement) {
            triggerElement.click();
        }
    }
</script>

{#if !match.bye}
    <!-- Regular match display -->
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
                class={`!w-8 !text-center md:!w-16 ${homeScoreError ? 'border-red-500' : ''} ${homeScorersAssigned > 0 ? '!border-green-500 !ring-1 !ring-green-500' : ''} ${!disabled ? 'cursor-pointer' : ''}`}
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
                class={`!w-8 !text-center md:!w-16 ${awayScoreError ? 'border-red-500' : ''} ${awayScorersAssigned > 0 ? '!border-green-500 !ring-1 !ring-green-500' : ''} ${!disabled ? 'cursor-pointer' : ''}`}
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
{/if}

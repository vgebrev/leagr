<script>
    import { Input } from 'flowbite-svelte';
    import TeamBadge from '$components/TeamBadge.svelte';
    import { validateGameScore } from '$lib/shared/validation.js';

    let { match, onScoreChange, onTeamClick, disabled = false, className = '' } = $props();

    let homeScoreInput = $derived(match.homeScore?.toString() || '');
    let awayScoreInput = $derived(match.awayScore?.toString() || '');
    let homeScoreError = $state('');
    let awayScoreError = $state('');

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
</script>

{#if !match.bye}
    <!-- Regular match display -->
    <div class={`flex items-center justify-between gap-2 p-2 ${className}`}>
        <!-- Home team -->
        <TeamBadge
            className="w-2/5"
            teamName={match.home}
            onclick={() => onTeamClick?.(match.home)} />

        <!-- Home score input -->
        <div class="flex flex-col items-center">
            <Input
                type="number"
                size="sm"
                class={`w-8 text-center md:w-16 ${homeScoreError ? 'border-red-500' : ''}`}
                value={homeScoreInput}
                onchange={handleHomeScoreChange}
                onfocus={(e) => e.target?.select()}
                {disabled}
                min="0"
                max="99"
                aria-label={`${match.home} score`} />
            {#if homeScoreError}
                <span class="mt-1 text-xs text-red-500">{homeScoreError}</span>
            {/if}
        </div>

        <!-- Away score input -->
        <div class="flex flex-col items-center">
            <Input
                type="number"
                size="sm"
                class={`w-8 text-center md:w-16 ${awayScoreError ? 'border-red-500' : ''}`}
                value={awayScoreInput}
                onchange={handleAwayScoreChange}
                onfocus={(e) => e.target?.select()}
                {disabled}
                min="0"
                max="99"
                aria-label={`${match.away} score`} />
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

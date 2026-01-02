<script>
    import { Button, Popover } from 'flowbite-svelte';
    import { RESERVED_SCORER_KEYS } from '$lib/shared/validation.js';
    import { teamStyles, teamColours } from '$lib/shared/helpers.js';

    /** @type {{ triggerId: string, teamName: string, players: Array<string | { name: string }>, scorers?: Record<string, number>, isOpen?: boolean, onUpdate: (change: { player: string, delta: number }) => void }} */
    let { triggerId, teamName, players, scorers = {}, isOpen = $bindable(false), onUpdate } = $props();

    /**
     * Helper to get player name from string or object
     * @param {string | { name: string }} player
     * @returns {string}
     */
    const getPlayerName = (player) => {
        return typeof player === 'string' ? player : player.name;
    };

    // Extract team color from team name
    let teamColour = $derived.by(() => {
        const firstWord = teamName.split(' ')[0].toLowerCase();
        return teamColours.includes(firstWord) ? firstWord : 'blue';
    });

    /** @type {import('$lib/shared/helpers.js').TeamStyle} */
    let styles = $derived(/** @type {any} */ (teamStyles)[teamColour] || teamStyles.blue);

    /**
     * Handle increment/decrement for a player
     * @param {string} player - Player name
     * @param {number} delta - +1 or -1
     */
    function handleScoreChange(player, delta) {
        onUpdate({ player, delta });
    }
</script>

<Popover
    triggeredBy="#{triggerId}"
    placement="bottom"
    class={`${styles.text} ${/** @type {any} */ (styles).border}`}
    arrow={false}
    bind:isOpen>
    <div>
        {#if players.length === 0}
            <div class="py-2 text-center text-xs opacity-70">No players found</div>
        {/if}

        {#each players as player, i (i)}
            {@const playerName = getPlayerName(player)}
            <div class="my-1 flex items-center justify-between gap-1">
                <span class="flex-1 truncate text-sm font-medium">{playerName}</span>
                <div class="flex items-center gap-1">
                    <Button
                        color={styles.button}
                        class={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold transition-opacity hover:opacity-70 disabled:opacity-30 ${styles.buttonClass} ${styles.border}`}
                        onclick={() => handleScoreChange(playerName, -1)}
                        disabled={!scorers[playerName]}>
                        −
                    </Button>
                    <span class="w-6 text-center text-sm font-bold">
                        {scorers[playerName] || 0}
                    </span>
                    <Button
                        color={styles.button}
                        class={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold transition-opacity hover:opacity-70 ${styles.buttonClass} ${styles.border}`}
                        onclick={() => handleScoreChange(playerName, +1)}>
                        +
                    </Button>
                </div>
            </div>
        {/each}

        <!-- Own Goal (only show if there are players) -->
        {#if players.length > 0}
            <div class="flex items-center justify-between gap-2">
                <span class="text-sm font-medium">Own Goal</span>
                <div class="flex items-center gap-1">
                    <Button
                        color={styles.button}
                        class={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold transition-opacity hover:opacity-70 disabled:opacity-30 ${styles.header} ${styles.border}`}
                        onclick={() => handleScoreChange(RESERVED_SCORER_KEYS.OWN_GOAL, -1)}
                        disabled={!scorers[RESERVED_SCORER_KEYS.OWN_GOAL]}>
                        −
                    </Button>
                    <span class="w-6 text-center text-sm font-bold">
                        {scorers[RESERVED_SCORER_KEYS.OWN_GOAL] || 0}
                    </span>
                    <Button
                        color={styles.button}
                        class={`flex h-6 w-6 items-center justify-center rounded text-xs font-bold transition-opacity hover:opacity-70 disabled:opacity-30 ${styles.buttonClass} ${styles.border}`}
                        onclick={() => handleScoreChange(RESERVED_SCORER_KEYS.OWN_GOAL, +1)}
                        disabled={(scorers[RESERVED_SCORER_KEYS.OWN_GOAL] || 0) >= 2}>
                        +
                    </Button>
                </div>
            </div>
        {/if}
    </div>
</Popover>

<script>
    import { CheckCircleSolid } from 'flowbite-svelte-icons';
    import { Button, Input, Label } from 'flowbite-svelte';
    import { formatDisplayDate } from '$lib/shared/helpers.js';

    /**
     * @typedef {Object} DaySettingsProps
     * @property {string} date - The date for the day-specific settings
     * @property {Object} daySettings - The day-specific settings object
     * @property {number} daySettings.playerLimit - The player limit for this specific day
     * @property {Object} leagueSettings - The league-wide settings object
     * @property {number} leagueSettings.playerLimit - The default player limit for the league
     * @property {function(Event): Promise<void>} onSave - The callback function to save the day settings
     */

    /** @type {DaySettingsProps} */
    let { date, daySettings = $bindable(), leagueSettings = $bindable(), onSave } = $props();

    /**
     * Handles the form submission for day settings.
     * Prevents the default form behaviour and calls the provided save callback.
     * @param {Event} event - The form submission event
     * @returns {Promise<void>}
     */
    async function handleSubmit(event) {
        event.preventDefault();
        await onSave(event);
    }
</script>

<form onsubmit={handleSubmit}>
    <div class="flex flex-col gap-2">
        <Label for="day-player-limit">Player Limit for {formatDisplayDate(date)}</Label>
        <div class="flex gap-2">
            <Input
                bind:value={daySettings.playerLimit}
                id="day-player-limit"
                type="number"
                step={1}
                min={0}
                placeholder="Leave blank to use the league default ({leagueSettings.playerLimit})"
                classes={{ wrapper: 'w-full' }}
                class="!bg-gray-50 dark:!bg-gray-800" />
            <Button type="submit">
                <CheckCircleSolid class="me-2 h-4 w-4" /> Set
            </Button>
        </div>
    </div>
</form>

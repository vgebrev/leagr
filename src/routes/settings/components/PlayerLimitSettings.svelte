<script>
    import { CheckCircleSolid } from 'flowbite-svelte-icons';
    import { Button, Input, Label } from 'flowbite-svelte';

    /**
     * @typedef {Object} PlayerLimitSettingsProps
     * @property {Object} leagueSettings - The league-wide settings object
     * @property {number} leagueSettings.playerLimit - The default player limit for the league
     * @property {function(Event): Promise<void>} onSave - The callback function to save the league settings
     */

    /** @type {PlayerLimitSettingsProps} */
    let { leagueSettings, onSave } = $props();

    /**
     * Handles the form submission for league player limit settings.
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
    <div class="flex flex-col gap-2 border-t border-t-gray-300 pt-2 dark:border-t-gray-600">
        <Label for="league-player-limit">Default Player Limit</Label>
        <div class="flex gap-2">
            <Input
                bind:value={leagueSettings.playerLimit}
                id="league-player-limit"
                type="number"
                step={1}
                min={0}
                classes={{ wrapper: 'w-full' }}
                class="!bg-gray-50 dark:!bg-gray-800"
                required />
            <Button type="submit">
                <CheckCircleSolid class="me-2 h-4 w-4" /> Set
            </Button>
        </div>
    </div>
</form>

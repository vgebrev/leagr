<script>
    import { Toggle } from 'flowbite-svelte';

    /**
     * @typedef {Object} BehaviorTogglesProps
     * @property {Object} leagueSettings - The league-wide settings object
     * @property {boolean} leagueSettings.canRegenerateTeams - Whether teams can be regenerated after initial creation
     * @property {boolean} leagueSettings.canResetSchedule - Whether the schedule can be reset after creation
     * @property {boolean} leagueSettings.seedTeams - Whether to balance teams using player rankings
     * @property {function(Event): Promise<void>} onSave - The callback function to save the league settings
     */

    /** @type {BehaviorTogglesProps} */
    let { leagueSettings = $bindable(), onSave } = $props();
</script>

<div class="mt-2 space-y-3 border-t border-t-gray-300 pt-2 dark:border-t-gray-600">
    <Toggle
        classes={{ input: 'leagr-toggle-input' }}
        bind:checked={leagueSettings.canRegenerateTeams}
        onchange={onSave}>
        Allow team regeneration
    </Toggle>
    <Toggle
        classes={{ input: 'leagr-toggle-input' }}
        bind:checked={leagueSettings.canResetSchedule}
        onchange={onSave}>
        Allow schedule reset
    </Toggle>
    <Toggle
        classes={{ input: 'leagr-toggle-input' }}
        bind:checked={leagueSettings.seedTeams}
        onchange={onSave}>
        Balance teams using player rankings
    </Toggle>
</div>

<style lang="postcss"></style>

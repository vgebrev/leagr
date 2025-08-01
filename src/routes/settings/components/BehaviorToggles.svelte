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
    let { leagueSettings, onSave } = $props();
</script>

<div class="mt-4 space-y-3">
    <Toggle
        bind:checked={leagueSettings.canRegenerateTeams}
        onchange={onSave}>
        Allow team regeneration
    </Toggle>
    <Toggle
        bind:checked={leagueSettings.canResetSchedule}
        onchange={onSave}>
        Allow schedule reset
    </Toggle>
    <Toggle
        bind:checked={leagueSettings.seedTeams}
        onchange={onSave}>
        Balance teams using player rankings
    </Toggle>
</div>
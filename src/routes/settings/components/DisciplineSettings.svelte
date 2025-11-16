<script>
    import { Input, Label, Toggle } from 'flowbite-svelte';

    /**
     * @typedef {Object} DisciplineSettings
     * @property {boolean} enabled - Whether the discipline system is enabled
     * @property {number} noShowThreshold - Number of no-shows before suspension
     */

    /**
     * @typedef {Object} DisciplineSettingsProps
     * @property {Object} leagueSettings - The league-wide settings object
     * @property {DisciplineSettings} leagueSettings.discipline - The discipline configuration
     * @property {function(Event): Promise<void>} onSave - The callback function to save the league settings
     */

    /** @type {DisciplineSettingsProps} */
    let { leagueSettings = $bindable(), onSave } = $props();
</script>

<div class="flex flex-col gap-2 border-t border-t-gray-300 pt-2 dark:border-t-gray-600">
    <Toggle
        classes={{ input: 'leagr-toggle-input' }}
        bind:checked={leagueSettings.discipline.enabled}
        onchange={onSave}>
        Enable suspensions
    </Toggle>

    {#if leagueSettings.discipline.enabled}
        <div class="flex flex-col gap-2 text-sm">
            <Label for="no-show-threshold">No-show threshold:</Label>
            <div class="flex items-center gap-2">
                <Input
                    id="no-show-threshold"
                    bind:value={leagueSettings.discipline.noShowThreshold}
                    type="number"
                    step={1}
                    min={1}
                    max={10}
                    onchange={onSave}
                    class="!w-20 shrink-0 !bg-gray-50 dark:!bg-gray-800"
                    placeholder="2" />
                <span class="text-gray-600 dark:text-gray-400">no-shows before suspension</span>
            </div>
        </div>
        <div class="mt-1 text-xs text-gray-600 dark:text-gray-400">
            After exceeding the no-show threshold, players will be suspended for 1 session when they
            try to sign-up. Playing a session clears active no-shows to encourage participation.
        </div>
    {/if}
</div>

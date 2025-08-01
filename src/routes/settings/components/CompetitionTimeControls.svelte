<script>
    import { Input, Toggle } from 'flowbite-svelte';

    /**
     * @typedef {Object} RegistrationWindow
     * @property {boolean} enabled - Whether the registration window is enabled
     * @property {number} startDayOffset - The number of days before competition start (negative value)
     * @property {string} startTime - The time when registration opens (HH:MM format)
     * @property {number} endDayOffset - The number of days before the competition end (negative value)
     * @property {string} endTime - The time when competition ends (HH:MM format)
     */

    /**
     * @typedef {Object} CompetitionTimeControlsProps
     * @property {Object} leagueSettings - The league-wide settings object
     * @property {RegistrationWindow} leagueSettings.registrationWindow - The registration window configuration
     * @property {function(Event): Promise<void>} onSave - The callback function to save the league settings
     * @property {function(string): void} onUpdateStartDayOffset - The callback to update the start day offset
     * @property {function(string): void} onUpdateEndDayOffset - The callback to update the end day offset
     */

    /** @type {CompetitionTimeControlsProps} */
    let { leagueSettings, onSave, onUpdateStartDayOffset, onUpdateEndDayOffset } = $props();

    /**
     * The UI representation of the start day offset (positive number for display).
     * @type {number}
     */
    let startDaysBeforeUI = $derived.by(() =>
        Math.abs(leagueSettings.registrationWindow.startDayOffset || 0)
    );

    /**
     * The UI representation of the end day offset (positive number for display).
     * @type {number}
     */
    let endDaysBeforeUI = $derived.by(() =>
        Math.abs(leagueSettings.registrationWindow.endDayOffset || 0)
    );
</script>

<div class="flex flex-col gap-2">
    <Toggle
        bind:checked={leagueSettings.registrationWindow.enabled}
        onchange={onSave}>
        Enable competition time controls
    </Toggle>

    {#if leagueSettings.registrationWindow.enabled}
        <div class="flex flex-col gap-2 text-sm">
            <div class="flex items-center gap-1">
                <span class="text-right">Registration opens</span>
                <Input
                    value={startDaysBeforeUI}
                    onchange={(e) =>
                        onUpdateStartDayOffset(/** @type {HTMLInputElement} */ (e.target)?.value)}
                    type="number"
                    step={1}
                    min={0}
                    class="w-16 shrink-0"
                    placeholder="2" />
                <span>days before, at</span>
                <Input
                    bind:value={leagueSettings.registrationWindow.startTime}
                    type="time"
                    onchange={onSave}
                    class="w-22 shrink-0"
                    placeholder="07:30" />
            </div>

            <div class="flex items-center gap-1">
                <span class="text-right">Competition ends</span>
                <Input
                    value={endDaysBeforeUI}
                    onchange={(e) =>
                        onUpdateEndDayOffset(/** @type {HTMLInputElement} */ (e.target)?.value)}
                    type="number"
                    step={1}
                    min={0}
                    class="w-16 shrink-0"
                    placeholder="0" />
                <span>days before, at</span>
                <Input
                    bind:value={leagueSettings.registrationWindow.endTime}
                    type="time"
                    onchange={onSave}
                    class="w-22 shrink-0"
                    placeholder="12:00" />
            </div>
        </div>
        <div class="mt-1 text-xs text-gray-600 dark:text-gray-400">
            After the competition ends, no changes can be made to teams, games, or player
            registrations.
        </div>
    {/if}
</div>

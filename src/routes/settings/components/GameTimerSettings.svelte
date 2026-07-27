<script>
    import { Input, Label, Toggle } from 'flowbite-svelte';

    /**
     * @typedef {Object} GameTimerSettingsProps
     * @property {Object} leagueSettings - The league-wide settings object
     * @property {number} leagueSettings.gameDurationMinutes - Default game length in minutes
     * @property {boolean} leagueSettings.lastPlayEnabled - Whether the last play period applies
     * @property {number} leagueSettings.lastPlaySeconds - Maximum length of the last play period
     * @property {function(Event): Promise<void>} onSave - The callback function to save the league settings
     */

    /** @type {GameTimerSettingsProps} */
    let { leagueSettings = $bindable(), onSave } = $props();
</script>

<div class="flex flex-col gap-2 border-t border-t-gray-300 pt-2 dark:border-t-gray-600">
    <div class="flex flex-col gap-2 text-sm">
        <Label for="game-duration">Game length:</Label>
        <div class="flex items-center gap-2">
            <Input
                id="game-duration"
                bind:value={leagueSettings.gameDurationMinutes}
                type="number"
                step={1}
                min={1}
                max={60}
                onchange={onSave}
                class="!w-20 shrink-0 !bg-gray-50 dark:!bg-gray-800"
                placeholder="8" />
            <span class="text-gray-600 dark:text-gray-400">minutes per match</span>
        </div>
    </div>

    <Toggle
        classes={{ input: 'leagr-toggle-input' }}
        bind:checked={leagueSettings.lastPlayEnabled}
        onchange={onSave}>
        Enable last play
    </Toggle>

    {#if leagueSettings.lastPlayEnabled}
        <div class="flex flex-col gap-2 text-sm">
            <Label for="last-play-seconds">Last play limit:</Label>
            <div class="flex items-center gap-2">
                <Input
                    id="last-play-seconds"
                    bind:value={leagueSettings.lastPlaySeconds}
                    type="number"
                    step={5}
                    min={5}
                    max={300}
                    onchange={onSave}
                    class="!w-20 shrink-0 !bg-gray-50 dark:!bg-gray-800"
                    placeholder="60" />
                <span class="text-gray-600 dark:text-gray-400">seconds</span>
            </div>
        </div>
    {/if}

    <div class="mt-1 text-xs text-gray-600 dark:text-gray-400">
        The Match Centre timer counts down from the game length, and can be adjusted per match on
        the day. With last play enabled, a short whistle at full time starts a final period that
        ends when the referee taps <span class="font-semibold">End Play</span> — for a goal or a change
        of possession — or when the limit above runs out.
    </div>
</div>

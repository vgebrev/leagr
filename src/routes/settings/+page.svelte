<script>
    import { onMount } from 'svelte';
    import { CheckCircleSolid } from 'flowbite-svelte-icons';
    import {
        Button,
        Input,
        Label,
        Toggle,
        MultiSelect,
        Accordion,
        AccordionItem
    } from 'flowbite-svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { settings, defaultSettings } from '$lib/client/stores/settings.js';
    import { getDaySettingsDefaults } from '$lib/shared/defaults.js';
    import { formatDisplayDate } from '$lib/shared/helpers.js';

    let { data } = $props();
    const date = data.date;
    let leagueSettings = $state({ ...defaultSettings });
    let daySettings = $state(getDaySettingsDefaults(defaultSettings));

    // UI helpers for the registration window - show positive numbers, store negative values
    let startDaysBeforeUI = $derived.by(() =>
        Math.abs(leagueSettings.registrationWindow.startDayOffset || 0)
    );
    let endDaysBeforeUI = $derived.by(() =>
        Math.abs(leagueSettings.registrationWindow.endDayOffset || 0)
    );

    /**
     * Updates the start day offset for the registration window.
     * Converts the input value to a negative number to match the stored offset.
     * If the input is not a valid number, defaults to 0.
     * @param {string} value
     */
    function updateStartDayOffset(value) {
        const numValue = parseInt(value) || 0;
        leagueSettings.registrationWindow.startDayOffset = -Math.abs(numValue);
        saveLeagueSettings(new Event('change'));
    }

    /**
     * Updates the end day offset for the registration window.
     * Converts the input value to a negative number to match the stored offset.
     * If the input is not a valid number, defaults to 0.
     * @param {string} value
     */
    function updateEndDayOffset(value) {
        const numValue = parseInt(value) || 0;
        leagueSettings.registrationWindow.endDayOffset = -Math.abs(numValue);
        saveLeagueSettings(new Event('change'));
    }

    // Days of week options for MultiSelect
    const weekdayOptions = [
        { value: 0, name: 'Sunday' },
        { value: 1, name: 'Monday' },
        { value: 2, name: 'Tuesday' },
        { value: 3, name: 'Wednesday' },
        { value: 4, name: 'Thursday' },
        { value: 5, name: 'Friday' },
        { value: 6, name: 'Saturday' }
    ];

    /** @param {Event} event */
    async function saveLeagueSettings(event) {
        event.preventDefault();
        await withLoading(
            async () => {
                const payload = {
                    ...leagueSettings,
                    [date]: daySettings
                };

                const result = await api.post('settings', date, payload);
                $settings = result;

                // Update local state from response
                const { [date]: updatedDaySettings, ...updatedLeagueSettings } = result;
                leagueSettings = updatedLeagueSettings;
                daySettings = updatedDaySettings || getDaySettingsDefaults(updatedLeagueSettings);
            },
            (err) => {
                console.error('Error saving league settings:', err);
                setNotification(
                    err.message || 'Failed to save league settings. Please try again.',
                    'error'
                );
            }
        );
    }

    /** @param {Event} event */
    async function saveDaySettings(event) {
        event.preventDefault();
        await withLoading(
            async () => {
                daySettings.playerLimit = daySettings.playerLimit || leagueSettings.playerLimit;

                const payload = {
                    ...leagueSettings,
                    [date]: daySettings
                };

                const result = await api.post('settings', date, payload);
                $settings = result;

                // Update local state from response
                const { [date]: updatedDaySettings, ...updatedLeagueSettings } = result;
                leagueSettings = updatedLeagueSettings;
                daySettings = updatedDaySettings || getDaySettingsDefaults(updatedLeagueSettings);
            },
            (err) => {
                console.error('Error saving day settings:', err);
                setNotification(
                    err.message || 'Failed to save day settings. Please try again.',
                    'error'
                );
            }
        );
    }

    onMount(async () => {
        await withLoading(
            async () => {
                const hierarchicalSettings = await api.get('settings', date);
                $settings = hierarchicalSettings;

                // Update local state for UI binding
                const { [date]: receivedDaySettings, ...receivedLeagueSettings } =
                    hierarchicalSettings;
                leagueSettings = receivedLeagueSettings;
                daySettings = receivedDaySettings || getDaySettingsDefaults(receivedLeagueSettings);
            },
            (err) => {
                console.error('Error fetching settings:', err);
                setNotification(
                    err.message || 'Failed to load settings. Please try again.',
                    'error'
                );
            }
        );
    });
</script>

<Accordion>
    <AccordionItem
        open
        classes={{ button: 'p-2', content: 'p-2' }}>
        {#snippet header()}
            <span class="font-semibold text-gray-700 dark:text-gray-200">
                Settings for {formatDisplayDate(date)}
            </span>
        {/snippet}
        <form onsubmit={async (event) => await saveDaySettings(event)}>
            <div class="flex flex-col gap-2">
                <Label for="day-player-limit">Player Limit</Label>
                <div class="flex gap-2">
                    <Input
                        bind:value={daySettings.playerLimit}
                        id="day-player-limit"
                        type="number"
                        step={1}
                        min={0}
                        placeholder="Leave blank to use league default ({leagueSettings.playerLimit})"
                        classes={{ wrapper: 'w-full' }} />
                    <Button type="submit">
                        <CheckCircleSolid class="me-2 h-4 w-4" /> Set
                    </Button>
                </div>
            </div>
        </form>
    </AccordionItem>
    <AccordionItem classes={{ button: 'p-2', content: 'p-2' }}>
        {#snippet header()}
            <span class="font-semibold text-gray-700 dark:text-gray-200">League Settings</span>
        {/snippet}
        <div class="section-dividers flex flex-col gap-2">
            <!-- Player Limit -->
            <form onsubmit={async (event) => await saveLeagueSettings(event)}>
                <div class="flex flex-col gap-2">
                    <Label for="league-player-limit">Default Player Limit</Label>
                    <div class="flex gap-2">
                        <Input
                            bind:value={leagueSettings.playerLimit}
                            id="league-player-limit"
                            type="number"
                            step={1}
                            min={0}
                            classes={{ wrapper: 'w-full' }}
                            required />
                        <Button type="submit">
                            <CheckCircleSolid class="me-2 h-4 w-4" /> Set
                        </Button>
                    </div>
                </div>
            </form>

            <!-- Competition Days -->
            <div class="flex flex-col gap-2">
                <Label for="competition-days">Day(s) of the week when matches are held</Label>
                <MultiSelect
                    items={weekdayOptions}
                    bind:value={leagueSettings.competitionDays}
                    placeholder="Select competition days..."
                    onchange={saveLeagueSettings}
                    id="competition-days" />
            </div>

            <!-- Registration Window -->
            <div class="flex flex-col gap-2">
                <Toggle
                    bind:checked={leagueSettings.registrationWindow.enabled}
                    onchange={saveLeagueSettings}>
                    Enable registration time restrictions
                </Toggle>

                {#if leagueSettings.registrationWindow.enabled}
                    <div class="flex flex-col gap-2 text-sm text-nowrap">
                        <div class="flex items-center gap-2">
                            <span>Opens</span>
                            <Input
                                value={startDaysBeforeUI}
                                onchange={(e) => updateStartDayOffset(e.target.value)}
                                type="number"
                                step={1}
                                min={0}
                                class="inline"
                                placeholder="2" />
                            <span>days before, at</span>
                            <Input
                                bind:value={leagueSettings.registrationWindow.startTime}
                                type="time"
                                onchange={saveLeagueSettings}
                                class="inline"
                                placeholder="07:30" />
                        </div>

                        <div class="flex items-center gap-2">
                            <span>Closes</span>
                            <Input
                                value={endDaysBeforeUI}
                                onchange={(e) => updateEndDayOffset(e.target?.value)}
                                type="number"
                                step={1}
                                min={0}
                                class="inline"
                                placeholder="0" />
                            <span>days before, at</span>
                            <Input
                                bind:value={leagueSettings.registrationWindow.endTime}
                                type="time"
                                onchange={saveLeagueSettings}
                                class="inline"
                                placeholder="07:30" />
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Team Generation -->
            <div class="flex flex-col gap-2">
                <div class="text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Team Limits
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <Label for="min-teams">Min Teams</Label>
                        <Input
                            bind:value={leagueSettings.teamGeneration.minTeams}
                            id="min-teams"
                            type="number"
                            step={1}
                            min={2}
                            max={leagueSettings.teamGeneration.maxTeams}
                            onchange={saveLeagueSettings}
                            required />
                    </div>

                    <div>
                        <Label for="max-teams">Max Teams</Label>
                        <Input
                            bind:value={leagueSettings.teamGeneration.maxTeams}
                            id="max-teams"
                            type="number"
                            step={1}
                            min={leagueSettings.teamGeneration.minTeams}
                            max={5}
                            onchange={saveLeagueSettings}
                            required />
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-2">
                    <div>
                        <Label for="min-players-per-team">Min Players per Team</Label>
                        <Input
                            bind:value={leagueSettings.teamGeneration.minPlayersPerTeam}
                            id="min-players-per-team"
                            type="number"
                            step={1}
                            min={3}
                            max={leagueSettings.teamGeneration.maxPlayersPerTeam}
                            onchange={saveLeagueSettings}
                            required />
                    </div>

                    <div>
                        <Label for="max-players-per-team">Max Players per Team</Label>
                        <Input
                            bind:value={leagueSettings.teamGeneration.maxPlayersPerTeam}
                            id="max-players-per-team"
                            type="number"
                            step={1}
                            min={leagueSettings.teamGeneration.minPlayersPerTeam}
                            max={15}
                            onchange={saveLeagueSettings}
                            required />
                    </div>
                </div>
            </div>
        </div>

        <div class="mt-4 space-y-3">
            <Toggle
                bind:checked={leagueSettings.canRegenerateTeams}
                onchange={saveLeagueSettings}>Allow team regeneration</Toggle>
            <Toggle
                bind:checked={leagueSettings.canResetSchedule}
                onchange={saveLeagueSettings}>Allow schedule reset</Toggle>
            <Toggle
                bind:checked={leagueSettings.seedTeams}
                onchange={saveLeagueSettings}>Balance teams using player rankings</Toggle>
        </div>
    </AccordionItem>
</Accordion>

<style lang="postcss">
    @reference "../../app.css";

    .section-dividers > *:not(:last-child) {
        @apply border-b border-gray-200 pb-4 dark:border-gray-700;
    }
</style>

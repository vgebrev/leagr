<script>
    import { onMount } from 'svelte';
    import { Accordion, AccordionItem } from 'flowbite-svelte';
    import { ShieldCheckOutline } from 'flowbite-svelte-icons';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { settings, defaultSettings } from '$lib/client/stores/settings.js';
    import { getDaySettingsDefaults } from '$lib/shared/defaults.js';
    import { formatDisplayDate } from '$lib/shared/helpers.js';
    import DaySettings from './components/DaySettings.svelte';
    import PlayerLimitSettings from './components/PlayerLimitSettings.svelte';
    import CompetitionDaysSettings from './components/CompetitionDaysSettings.svelte';
    import CompetitionTimeControls from './components/CompetitionTimeControls.svelte';
    import TeamLimitsSettings from './components/TeamLimitsSettings.svelte';
    import DisciplineSettings from './components/DisciplineSettings.svelte';
    import BehaviorToggles from './components/BehaviorToggles.svelte';
    import {
        getStoredAdminCode,
        removeStoredAdminCode,
        validateAdminCode
    } from '$lib/client/services/auth.js';
    import { setAdminCode } from '$lib/client/services/api-client.svelte.js';
    import { Button } from 'flowbite-svelte';
    import AdminAccess from './components/AdminAccess.svelte';

    let { data } = $props();
    const date = data.date;
    let leagueSettings = $state({ ...defaultSettings });
    let daySettings = $state(getDaySettingsDefaults(defaultSettings));
    let hasAdmin = $state(false);

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
        // Prevent body scroll on settings page to avoid double scrollbar
        document.body.style.overflow = 'hidden';

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

        // Initialize admin state from storage
        const stored = getStoredAdminCode(data.leagueId);
        if (stored) {
            setAdminCode(stored);
            // Confirm with server
            hasAdmin = await validateAdminCode();
            if (!hasAdmin) {
                removeStoredAdminCode(data.leagueId);
            }
        }

        // Cleanup: restore body scroll when leaving page
        return () => {
            document.body.style.overflow = '';
        };
    });
</script>

{#if hasAdmin}
    <Accordion multiple>
        <AccordionItem
            open={true}
            classes={{ button: 'p-2', content: 'p-2' }}>
            {#snippet header()}
                <span class="font-semibold text-gray-700 dark:text-gray-200">
                    Settings for {formatDisplayDate(date)}
                </span>
            {/snippet}
            <DaySettings
                {date}
                {daySettings}
                {leagueSettings}
                onSave={saveDaySettings} />
        </AccordionItem>

        <AccordionItem classes={{ button: 'p-2', content: 'p-2' }}>
            {#snippet header()}
                <span class="font-semibold text-gray-700 dark:text-gray-200">League Settings</span>
            {/snippet}
            <div class="section-dividers flex flex-col gap-2">
                <PlayerLimitSettings
                    {leagueSettings}
                    onSave={saveLeagueSettings} />
                <CompetitionDaysSettings
                    {leagueSettings}
                    onSave={saveLeagueSettings} />
                <CompetitionTimeControls
                    {leagueSettings}
                    onSave={saveLeagueSettings}
                    onUpdateStartDayOffset={updateStartDayOffset}
                    onUpdateEndDayOffset={updateEndDayOffset} />
                <TeamLimitsSettings
                    {leagueSettings}
                    onSave={saveLeagueSettings} />
                <DisciplineSettings
                    {leagueSettings}
                    onSave={saveLeagueSettings} />
            </div>
            <BehaviorToggles
                {leagueSettings}
                onSave={saveLeagueSettings} />
        </AccordionItem>

        <AccordionItem classes={{ button: 'p-2', content: 'p-2' }}>
            {#snippet header()}
                <span class="font-semibold text-gray-700 dark:text-gray-200">Admin</span>
            {/snippet}
            <div class="flex w-full justify-center">
                <Button
                    color="primary"
                    size="sm"
                    onclick={() => {
                        removeStoredAdminCode(data.leagueId);
                        hasAdmin = false;
                        setNotification('Admin privileges removed for this device.', 'info');
                    }}><ShieldCheckOutline class="me-2 h-4 w-4" /> Release Admin</Button>
            </div>
        </AccordionItem>
    </Accordion>
{:else}
    <AdminAccess
        leagueId={data.leagueId}
        leagueName={data.leagueInfo?.name}
        onGranted={() => (hasAdmin = true)} />
{/if}

<style lang="postcss">
    @reference "../../app.css";

    .section-dividers > *:not(:last-child) {
        @apply border-b border-gray-200 pb-4 dark:border-gray-700;
    }
</style>

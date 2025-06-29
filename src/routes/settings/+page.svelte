<script>
    import { onMount } from 'svelte';
    import { CheckCircleSolid } from 'flowbite-svelte-icons';
    import { Button, Input, Label, Toggle } from 'flowbite-svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { setError } from '$lib/client/stores/error.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { settings } from '$lib/client/stores/settings.js';

    let { data } = $props();
    const date = data.date;
    let storedSettings = $state({
        playerLimit: 24,
        canRegenerateTeams: false,
        canResetSchedule: false,
        seedTeams: true
    });

    /** @param {Event} event */
    async function saveSettings(event) {
        event.preventDefault();
        await withLoading(
            async () => {
                storedSettings.playerLimit = storedSettings.playerLimit || 24;
                storedSettings = await api.post('settings', date, storedSettings);
                $settings = storedSettings;
            },
            (err) => {
                console.error('Error limiting players:', err);
                setError('Failed to set settings. Please try again.');
            }
        );
    }

    onMount(async () => {
        await withLoading(
            async () => {
                storedSettings = await api.get('settings', date);
                $settings = storedSettings;
            },
            (err) => {
                console.error('Error fetching settings:', err);
                setError('Failed to load settings. Please try again.');
            }
        );
    });
</script>

<Label for="player-limit">Player limit</Label>
<form
    class="flex gap-2"
    onsubmit={async (event) => await saveSettings(event)}>
    <Input
        bind:value={storedSettings.playerLimit}
        id="player-limit"
        name="player-limit"
        type="number"
        step={1}
        min={0}
        placeholder=""
        wrapperClass="w-full"
        required />
    <Button type="submit">
        <CheckCircleSolid class="me-2 h-4 w-4" /> Set</Button>
</form>

<Toggle
    bind:checked={storedSettings.canRegenerateTeams}
    onchange={saveSettings}>Allow team regeneration</Toggle>
<Toggle
    bind:checked={storedSettings.canResetSchedule}
    onchange={saveSettings}>Allow schedule reset</Toggle>
<Toggle
    bind:checked={storedSettings.seedTeams}
    onchange={saveSettings}>Balance teams using player rankings</Toggle>

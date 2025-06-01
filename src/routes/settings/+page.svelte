<script>
    import { onMount } from 'svelte';
    import { CheckCircleSolid } from 'flowbite-svelte-icons';
    import { Button, Input, Label, Toggle } from 'flowbite-svelte';
    import { api } from '$lib/api-client.js';
    import { setError } from '$lib/stores/error.js';
    import { isLoading } from '$lib/stores/loading.js';
    import { settings } from '$lib/stores/settings.js';

    let { data } = $props();
    const date = data.date;
    let storedSettings = $state({
        playerLimit: 24,
        canRegenerateTeams: false,
        canResetSchedule: false,
        seedTeams: true
    });

    async function saveSettings(event) {
        event.preventDefault();
        try {
            $isLoading = true;
            storedSettings.playerLimit = storedSettings.playerLimit || 24;
            storedSettings = await api.post('settings', date, storedSettings);
            $settings = storedSettings;
        } catch (ex) {
            console.error('Error limiting players:', ex);
            setError('Failed to set settings. Please try again.');
        } finally {
            $isLoading = false;
        }
    }

    onMount(async () => {
        try {
            $isLoading = true;
            storedSettings = await api.get('settings', date);
            $settings = storedSettings;
        } catch (ex) {
            console.error('Error fetching settings:', ex);
            setError('Failed to load settings. Please try again.');
        } finally {
            $isLoading = false;
        }
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

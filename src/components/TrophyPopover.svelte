<script>
    import { Popover, Spinner } from 'flowbite-svelte';
    import AppearanceCard from './AppearanceCard.svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { onMount } from 'svelte';

    /**
     * @type {{ triggerId: string, playerName: string, trophyType: 'league' | 'cup' }}
     */
    let { triggerId, playerName, trophyType } = $props();

    let sessions = $state([]);
    let loading = $state(false);
    let error = $state(false);
    let hasLoaded = $state(false);

    /**
     * Load trophy sessions data for this specific player
     */
    async function loadTrophySessions() {
        if (hasLoaded) return; // Already loaded

        loading = true;
        error = false;

        try {
            // Only fetch the specific trophy type we need
            const response = await api.get(
                `champions/${encodeURIComponent(playerName)}?trophyType=${trophyType}`
            );

            // Extract the appropriate sessions based on trophy type
            sessions =
                trophyType === 'league'
                    ? response.leagueSessions || []
                    : response.cupSessions || [];

            hasLoaded = true;
        } catch (err) {
            console.error('Error loading trophy sessions:', err);
            error = true;
        } finally {
            loading = false;
        }
    }

    /**
     * Set up event listeners on the trigger button for both click and mouseover
     */
    onMount(() => {
        const triggerButton = document.getElementById(triggerId);
        if (triggerButton) {
            const handleTrigger = () => {
                if (!hasLoaded && !loading) {
                    loadTrophySessions();
                }
            };

            triggerButton.addEventListener('click', handleTrigger);
            triggerButton.addEventListener('mouseover', handleTrigger);
        }
    });
</script>

<Popover
    triggeredBy="#{triggerId}"
    class="max-h-1/2 overflow-y-auto text-sm">
    {#if loading}
        <div class="flex items-center justify-center gap-2 p-4">
            <Spinner size="4" />
            <span class="text-gray-500">Loading...</span>
        </div>
    {:else if error}
        <div class="p-4 text-center text-red-500">Failed to load trophy data</div>
    {:else if sessions.length > 0}
        <div class="flex flex-col gap-2">
            {#each sessions as session, sessionIndex (sessionIndex)}
                <AppearanceCard
                    detail={session}
                    hasBorder={false} />
            {/each}
        </div>
    {:else}
        <div class="p-4 text-center text-gray-500">No trophy data available</div>
    {/if}
</Popover>

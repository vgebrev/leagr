<script>
    import { Modal, Spinner } from 'flowbite-svelte';
    import PlayerHeader from './PlayerHeader.svelte';
    import PlayerSummaryCard from '../routes/rankings/[player]/components/PlayerSummaryCard.svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { scale } from 'svelte/transition';

    /**
     * @type {{ playerName: string | null, open: boolean }}
     */
    let { playerName = $bindable(null), open = $bindable(false) } = $props();

    let playerData = $state(null);
    let loadingError = $state(false);

    /**
     * Load player data
     */
    async function loadPlayerData() {
        if (!playerName) {
            setNotification('Player name is required', 'error');
            return;
        }

        loadingError = false;
        playerData = null;

        await withLoading(
            async () => {
                const response = await api.get(`rankings/${encodeURIComponent(playerName)}`);
                playerData = response.playerData;
            },
            (err) => {
                console.error('Error loading player profile:', err);
                loadingError = true;
                setNotification(
                    err.message || 'Failed to load player profile. Please try again.',
                    'error'
                );
            }
        );
    }

    /**
     * Load player data when modal opens or playerName changes
     * Reset data when modal closes
     */
    $effect(() => {
        if (open && playerName) {
            loadPlayerData();
        } else if (!open) {
            // Reset state when modal closes
            playerData = null;
            loadingError = false;
        }
    });
</script>

<Modal
    transition={scale}
    bind:open
    size="md"
    class="glass-strong max-w-[95hv] border backdrop:backdrop-blur-xs"
    bodyClass="p-4"
    closeBtnClass="p-0">
    {#snippet header()}
        {#if playerData}
            <PlayerHeader
                {playerData}
                {playerName}
                showStatus={false} />
        {:else}
            <div class="p-4">
                <h3 class="text-xl font-semibold">{playerName || 'Player Profile'}</h3>
            </div>
        {/if}
    {/snippet}

    {#if !playerData && !loadingError}
        <div class="flex items-center justify-center gap-2 p-4">
            <Spinner size="6" />
            <div class="text-gray-500">Loading...</div>
        </div>
    {:else if loadingError}
        <div class="p-4 text-center text-red-500">Failed to load player data</div>
    {:else if playerData}
        <PlayerSummaryCard
            {playerData}
            showAverages={false} />
    {/if}
</Modal>

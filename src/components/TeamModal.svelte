<script>
    import { Modal, Spinner } from 'flowbite-svelte';
    import TeamFormation from './TeamFormation.svelte';
    import TeamBadge from './TeamBadge.svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { scale } from 'svelte/transition';

    /**
     * @type {{ teamName: string | null, date: string | null, open: boolean }}
     */
    let { teamName = $bindable(null), date = null, open = $bindable(false) } = $props();

    let teamPlayers = $state([]);
    let loadingError = $state(false);

    // Extract team color from team name for avatar colors
    let teamColor = $derived(teamName?.split(' ')[0].toLowerCase() || 'default');

    /**
     * Load team players with their avatars and ELO
     */
    async function loadTeamData() {
        if (!teamName || !date) {
            setNotification('Team name and date are required', 'error');
            return;
        }

        loadingError = false;
        teamPlayers = [];

        await withLoading(
            async () => {
                // Fetch only the specific team's data using teamName parameter
                const response = await api.get(
                    `teams?date=${date}&teamName=${encodeURIComponent(teamName)}`
                );
                const teams = response.teams || {};

                // Get players for the specified team - already enhanced with ELO and avatar
                const players = teams[teamName] || [];

                // Filter out null/empty slots and extract player data
                teamPlayers = players
                    .filter((player) => player !== null)
                    .map((player) => ({
                        name: player.name,
                        avatar: player.avatar || null,
                        elo: player.elo || null
                    }));
            },
            (err) => {
                console.error('Error loading team data:', err);
                loadingError = true;
                setNotification(
                    err.message || 'Failed to load team data. Please try again.',
                    'error'
                );
            }
        );
    }

    /**
     * Load team data when modal opens or teamName/date changes
     * Reset data when modal closes
     */
    $effect(() => {
        if (open && teamName && date) {
            loadTeamData();
        } else if (!open) {
            // Reset state when modal closes
            teamPlayers = [];
            loadingError = false;
        }
    });
</script>

<Modal
    transition={scale}
    bind:open
    size="md"
    class="glass-strong max-w-md border backdrop:backdrop-blur-xs"
    classes={{ body: 'p-2', close: 'p-0' }}>
    {#snippet header()}
        {#if teamName}
            <div class="flex w-full items-center justify-center">
                <TeamBadge
                    {teamName}
                    className="text-lg px-3 py-1" />
            </div>
        {:else}
            <div class="p-4 text-center text-lg font-semibold uppercase">Team Formation</div>
        {/if}
    {/snippet}

    {#if !teamPlayers.length && !loadingError}
        <div class="flex items-center justify-center gap-2 p-4">
            <Spinner size="6" />
            <div class="text-gray-500">Loading team...</div>
        </div>
    {:else if loadingError}
        <div class="p-4 text-center text-red-500">Failed to load team data</div>
    {:else if teamPlayers.length}
        <TeamFormation
            players={teamPlayers}
            {teamColor} />
    {:else}
        <div class="p-4 text-center text-gray-500">No players in this team</div>
    {/if}
</Modal>

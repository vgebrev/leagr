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
                const response = await api.get('teams', date);
                const teams = response.teams || {};

                // Get players for the specified team
                const players = teams[teamName] || [];

                // Fetch rankings data for each player to get avatars and ELO
                const playersWithData = await Promise.all(
                    players
                        .filter((player) => player !== null) // Filter out null/Empty slots
                        .map(async (player) => {
                            const playerName =
                                typeof player === 'string' ? player : player.name || player;
                            try {
                                const rankingData = await api.get(
                                    `rankings/${encodeURIComponent(playerName)}`
                                );
                                return {
                                    name: playerName,
                                    avatar: rankingData.playerData?.avatar || null,
                                    elo: rankingData.playerData?.elo?.rating || null
                                };
                            } catch {
                                // If player doesn't have ranking data, just use their name
                                return {
                                    name: playerName,
                                    avatar: null,
                                    elo: null
                                };
                            }
                        })
                );

                teamPlayers = playersWithData;
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
    bodyClass="p-2"
    closeBtnClass="p-0">
    {#snippet header()}
        {#if teamName}
            <div class="flex items-center justify-center">
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

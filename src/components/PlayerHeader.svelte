<script>
    import Avatar from '$components/avatars/Avatar.svelte';
    import { Badge } from 'flowbite-svelte';
    import { ExclamationCircleOutline, HourglassOutline } from 'flowbite-svelte-icons';
    import PlayerRatings from '$components/PlayerRatings.svelte';

    /**
     * @type {{ playerData: any, playerName: string, showStatus?: boolean, asOfDate?: string | null }}
     */
    let { playerData, playerName, showStatus = true, asOfDate = null } = $props();

    /**
     * Get player status: 'active', 'provisional', or 'inactive'
     * @param {string|null} lastAppearance - Last appearance date (YYYY-MM-DD)
     * @param {number} appearances - Total number of appearances
     * @returns {'active'|'provisional'|'inactive'}
     */
    function getPlayerStatus(lastAppearance, appearances) {
        if (!lastAppearance) return 'inactive';

        const today = new Date();
        const twoMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, today.getDate());
        const lastAppearanceDate = new Date(lastAppearance);

        const hasRecentAppearance = lastAppearanceDate >= twoMonthsAgo;

        if (!hasRecentAppearance) return 'inactive';
        if (appearances < 2) return 'provisional';
        return 'active';
    }

    // Derived avatar URL (show approved avatar, not pending)
    let avatarUrl = $derived(
        playerData?.avatar ? `/api/rankings/${encodeURIComponent(playerName)}/avatar` : null
    );

    // Check if there's a pending avatar
    let hasPendingAvatar = $derived(!!playerData?.pendingAvatar);

    // Get player status
    let status = $derived(
        playerData ? getPlayerStatus(playerData.lastAppearance, playerData.appearances) : 'active'
    );
</script>

<div class="mb-2 flex w-full items-start justify-between gap-3">
    <div class="flex min-w-0 flex-1 items-center gap-3">
        <Avatar
            {avatarUrl}
            {hasPendingAvatar}
            size="lg" />
        <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
                <h1 class="text-2xl font-bold">{playerName}</h1>
                {#if asOfDate}
                    <span class="text-sm text-gray-400">(as at {asOfDate})</span>
                {/if}
            </div>
            {#if playerData && (playerData.attackingRating !== null || playerData.controlRating !== null)}
                <div class="mt-1">
                    <PlayerRatings
                        attackingRating={playerData.attackingRating}
                        controlRating={playerData.controlRating}
                        goalsForPerSession={playerData.goalsForPerSession ?? null}
                        goalsAgainstPerSession={playerData.goalsAgainstPerSession ?? null}
                        gfRank={playerData.gfRank ?? null}
                        gfCount={playerData.gfCount ?? null}
                        gaRank={playerData.gaRank ?? null}
                        gaCount={playerData.gaCount ?? null}
                        gamma={0.45}
                        tooltipIdPrefix={`player-header-${playerName ?? 'unknown'}`} />
                </div>
            {:else}
                <h6 class="text-gray-400">Player Profile</h6>
            {/if}
        </div>
    </div>
    <!-- Player Status Badge -->
    {#if showStatus}
        {#if status === 'inactive'}
            <Badge
                border
                class="flex items-center">
                <ExclamationCircleOutline class="me-2 h-4 w-4" />
                Inactive Player
            </Badge>
        {:else if status === 'provisional'}
            <Badge
                border
                color="gray"
                class="flex items-center">
                <HourglassOutline class="me-2 h-4 w-4" />
                Provisional Player
            </Badge>
        {/if}
    {/if}
</div>

<script>
    import Avatar from '$components/avatars/Avatar.svelte';
    import { Badge } from 'flowbite-svelte';
    import { ExclamationCircleOutline, HourglassOutline } from 'flowbite-svelte-icons';

    /**
     * @type {{ playerData: any, playerName: string, showStatus?: boolean }}
     */
    let { playerData, playerName, showStatus = true } = $props();

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

<div class="mb-2 flex items-start justify-between">
    <div class="flex items-center gap-4">
        <Avatar
            {avatarUrl}
            {hasPendingAvatar}
            size="lg" />
        <div>
            <h1 class="text-2xl font-bold">{playerName}</h1>
            <h6 class="text-gray-400">Player Profile</h6>
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

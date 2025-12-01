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

    // Display helper for attack/defense bars (cosmetic only)
    function applyGammaSpread(value, gamma = 0.45) {
        if (value === null || value === undefined) return null;
        const clamped = Math.min(1, Math.max(0, value));
        return Math.pow(clamped, gamma);
    }
</script>

<div class="mb-2 flex w-full items-start justify-between gap-3">
    <div class="flex min-w-0 flex-1 items-center gap-3">
        <Avatar
            {avatarUrl}
            {hasPendingAvatar}
            size="lg" />
        <div class="min-w-0 flex-1">
            <h1 class="text-2xl font-bold">{playerName}</h1>
            {#if playerData && (playerData.attackingRating !== null || playerData.controlRating !== null)}
                <div class="mt-1 space-y-1 text-sm">
                    {#if playerData.attackingRating !== null}
                        <div class="flex items-center gap-1.5">
                            <span
                                class="w-14 shrink-0 tracking-wide text-gray-400 dark:text-gray-300"
                                >Attack</span>
                            <div class="h-2 w-full rounded-full bg-gray-200/70 dark:bg-gray-700">
                                <div
                                    class="bg-primary-500 h-2 w-full rounded-full transition-all"
                                    style={`width: ${(applyGammaSpread(playerData.attackingRating) * 100).toFixed(1)}%`}>
                                </div>
                            </div>
                            <span
                                class="w-10 text-right text-sm text-gray-400 dark:text-gray-300"
                                title={`Raw ${(playerData.attackingRating * 100).toFixed(0)}%`}>
                                {(applyGammaSpread(playerData.attackingRating) * 100).toFixed(0)}
                            </span>
                        </div>
                    {/if}
                    {#if playerData.controlRating !== null}
                        <div class="flex items-center gap-1.5">
                            <span
                                class="w-14 shrink-0 tracking-wide text-gray-400 dark:text-gray-300"
                                >Defense</span>
                            <div class="h-2 w-full rounded-full bg-gray-200/70 dark:bg-gray-700">
                                <div
                                    class="bg-primary-500 h-2 w-full rounded-full transition-all"
                                    style={`width: ${(applyGammaSpread(playerData.controlRating) * 100).toFixed(1)}%`}>
                                </div>
                            </div>
                            <span
                                class="w-10 text-right text-sm text-gray-400 dark:text-gray-300"
                                title={`Raw ${(playerData.controlRating * 100).toFixed(0)}%`}>
                                {(applyGammaSpread(playerData.controlRating) * 100).toFixed(0)}
                            </span>
                        </div>
                    {/if}
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

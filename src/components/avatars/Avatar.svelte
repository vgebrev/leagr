<script>
    import { Avatar, Indicator } from 'flowbite-svelte';
    import { CameraPhotoOutline, ClockOutline } from 'flowbite-svelte-icons';

    /**
     * @type {{ avatarUrl?: string | null, hasPendingAvatar?: boolean, canUpload?: boolean, showPendingOnly?: boolean, size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl', onclick?: () => void }}
     */
    let {
        avatarUrl = null,
        hasPendingAvatar = false,
        canUpload = false,
        showPendingOnly = false,
        size = 'lg',
        onclick = undefined
    } = $props();

    // Display logic:
    // - If showPendingOnly: show avatarUrl (which should be the pending avatar URL)
    // - Otherwise: show avatarUrl (which should be the approved avatar URL)
    let displayAvatarUrl = $derived(avatarUrl || undefined);

    // Determine if clickable
    let isClickable = $derived(canUpload || !!onclick);
</script>

<div class="relative inline-block">
    <button
        type="button"
        class="relative"
        class:cursor-pointer={isClickable}
        class:cursor-default={!isClickable}
        {onclick}
        disabled={!isClickable}>
        <Avatar
            border={true}
            src={displayAvatarUrl}
            {size}>
            {#snippet indicator()}
                {#if hasPendingAvatar && !showPendingOnly}
                    <Indicator
                        color={undefined}
                        border
                        size="xl"
                        placement="top-right"
                        class="bg-gray-200 ring-gray-800 dark:bg-gray-800 dark:ring-gray-200">
                        <ClockOutline class="h-4 w-4 text-gray-700 dark:text-gray-200" />
                    </Indicator>
                {:else if canUpload && !displayAvatarUrl}
                    <Indicator
                        color={undefined}
                        border
                        size="xl"
                        placement="top-right"
                        class="bg-gray-200 ring-gray-800 dark:bg-gray-800 dark:ring-gray-200">
                        <CameraPhotoOutline class="h-4 w-4 text-gray-700 dark:text-gray-200" />
                    </Indicator>
                {/if}
            {/snippet}

            <!--{#if !displayAvatarUrl}-->
            <!--    <UserSolid class="h-full w-full text-gray-500 dark:text-gray-400" />-->
            <!--{/if}-->
        </Avatar>

        {#if canUpload && !displayAvatarUrl}
            <div
                class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                <CameraPhotoOutline class="h-6 w-6 text-white" />
            </div>
        {/if}
    </button>
</div>

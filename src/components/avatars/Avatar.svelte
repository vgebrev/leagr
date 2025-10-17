<script>
    import { Avatar, Indicator } from 'flowbite-svelte';
    import { CameraPhotoOutline, ClockOutline, CloseOutline } from 'flowbite-svelte-icons';

    /**
     * @type {{ playerName: string, avatarUrl?: string | null, status?: 'pending' | 'rejected' | 'approved' | null, canUpload?: boolean, size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl', onclick?: () => void }}
     */
    let {
        playerName,
        avatarUrl = null,
        status = null,
        canUpload = false,
        size = 'lg',
        onclick = undefined
    } = $props();

    // Generate initials from player name
    let initials = $derived(
        playerName
            ?.split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2) || '?'
    );

    // Show approved avatar or null for initials fallback
    let displayAvatarUrl = $derived(status === 'approved' && avatarUrl ? avatarUrl : null);

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
            src={displayAvatarUrl}
            {size}
            class="ring-2 ring-gray-300 dark:ring-gray-600">
            {#snippet indicator()}
                {#if status === 'pending'}
                    <Indicator
                        color={undefined}
                        border
                        size="xl"
                        placement="top-right"
                        class="bg-gray-200 ring-gray-800 dark:bg-gray-800 dark:ring-gray-200">
                        <ClockOutline class="h-4 w-4 text-gray-700 dark:text-gray-200" />
                    </Indicator>
                {:else if status === 'rejected'}
                    <Indicator
                        color="red"
                        border
                        size="xl"
                        placement="top-right">
                        <CloseOutline class="h-4 w-4 text-white" />
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

            {#if !displayAvatarUrl}
                <h1 class="text-3xl font-bold">{initials}</h1>
            {/if}
        </Avatar>

        {#if canUpload && !displayAvatarUrl}
            <div
                class="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                <CameraPhotoOutline class="h-6 w-6 text-white" />
            </div>
        {/if}
    </button>
</div>

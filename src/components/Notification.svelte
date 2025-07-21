<script>
    import { Toast } from 'flowbite-svelte';
    import {
        ExclamationCircleSolid,
        CheckCircleSolid,
        InfoCircleSolid,
        CloseCircleSolid
    } from 'flowbite-svelte-icons';
    import { fade } from 'svelte/transition';
    import { notification } from '$lib/client/stores/notification.js';

    // Map notification types to colors and icons
    const typeConfig = {
        error: { color: 'red', icon: CloseCircleSolid },
        success: { color: 'green', icon: CheckCircleSolid },
        warning: { color: 'yellow', icon: ExclamationCircleSolid },
        info: { color: 'blue', icon: InfoCircleSolid }
    };

    let config = $derived(
        $notification ? typeConfig[$notification.type] || typeConfig.error : null
    );
</script>

<Toast
    toastStatus={!!$notification && !!config}
    transition={fade}
    color={config?.color || 'red'}
    class="border-primary-400 z-50 flex items-center border bg-white shadow-lg dark:bg-gray-800"
    position="top-right">
    {#snippet icon()}
        {@const IconComponent = config?.icon || typeConfig.error.icon}
        <IconComponent class="h-4 w-4" />
    {/snippet}
    {$notification?.message || ''}
</Toast>

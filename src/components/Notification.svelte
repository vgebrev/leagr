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

{#if $notification && config}
    <Toast
        toastStatus={true}
        transition={fade}
        color={config.color}
        class="border-primary-400 flex items-center border"
        position="top-right">
        {#snippet icon()}
            {@const IconComponent = config.icon}
            <IconComponent class="h-4 w-4" />
        {/snippet}
        {$notification.message}
    </Toast>
{/if}

<script>
    import { Spinner } from 'flowbite-svelte';
    import Avatar from './Avatar.svelte';

    /**
     * @type {{ avatarUrl?: string | null, status?: 'pending' | 'rejected' | 'approved' | null, size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl', onUpload: (file: File) => Promise<void> }}
     */
    let { avatarUrl = null, status = null, size = 'lg', onUpload } = $props();

    let uploading = $state(false);
    let fileInput = $state(null);

    async function handleFileSelect(event) {
        const file = event.target.files?.[0];
        if (!file) return;

        uploading = true;
        try {
            await onUpload(file);
        } finally {
            uploading = false;
            // Reset input so same file can be selected again
            if (fileInput) fileInput.value = '';
        }
    }

    function triggerFileInput() {
        fileInput?.click();
    }
</script>

<div class="relative inline-block">
    <input
        bind:this={fileInput}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="hidden"
        onchange={handleFileSelect}
        disabled={uploading} />

    <Avatar
        {avatarUrl}
        {status}
        {size}
        canUpload={!uploading}
        onclick={triggerFileInput} />

    {#if uploading}
        <div class="absolute inset-0 flex items-center justify-center rounded-full bg-black/60">
            <Spinner
                size="6"
                color="primary" />
        </div>
    {/if}
</div>

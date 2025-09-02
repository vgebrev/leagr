<script>
    import { Alert, Button } from 'flowbite-svelte';
    import { ChartOutline, ExclamationCircleSolid } from 'flowbite-svelte-icons';

    let { onUpdate } = $props();

    async function handleUpdate() {
        if (onUpdate) {
            await onUpdate();
        }
    }
</script>

<Button onclick={handleUpdate}>
    <ChartOutline class="me-2 h-4 w-4" /> Update Rankings
</Button>
<Alert class="glass flex items-center border">
    <ExclamationCircleSolid />
    <span>Only update rankings after the last game score of the day is recorded!</span>
</Alert>

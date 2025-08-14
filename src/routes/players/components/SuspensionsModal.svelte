<script>
    import { Modal } from 'flowbite-svelte';
    import SuspensionsList from './SuspensionsList.svelte';
    import { fade } from 'svelte/transition';

    let { suspendedPlayers = [], open = $bindable(false) } = $props();
</script>

<Modal
    transition={fade}
    bind:open
    title="Suspensions Watchlist"
    size="sm"
    headerClass="p-4 text-md font-semibold"
    closeBtnClass="p-0">
    <SuspensionsList {suspendedPlayers} />
</Modal>

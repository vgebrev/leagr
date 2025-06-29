<script>
    import '../app.css';
    import { Toast } from 'flowbite-svelte';
    import { ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { error } from '$lib/client/stores/error.js';
    import { settings } from '$lib/client/stores/settings.js';
    import { dateString } from '$lib/shared/helpers.js';
    import { fade } from 'svelte/transition';
    import { setApiKey } from '$lib/client/services/api-client.svelte.js';
    import TopNavBar from './components/TopNavBar.svelte';
    import BottomNavBar from './components/BottomNavBar.svelte';
    import DateSelector from './components/DateSelector.svelte';

    let { data, children } = $props();
    setApiKey(data.apiKey);
    let selectedDate = $derived(new Date(data.date));
    let date = $derived(dateString(selectedDate));

    $settings = data.settings;
</script>

<svelte:head>
    <title>Pirates Footy Organiser</title>
</svelte:head>
<main class="flex h-[100dvh] flex-col overflow-hidden">
    <TopNavBar {date} />

    <div class="flex-1 overflow-y-auto pb-[4rem]">
        <div
            class="container mx-auto flex flex-col justify-between gap-2 p-2 md:w-2/3 lg:w-1/2 xl:w-1/3">
            <DateSelector {selectedDate} />
            {@render children()}
        </div>
    </div>

    <BottomNavBar {date} />

    <Toast
        toastStatus={!!$error}
        transition={fade}
        color="red"
        class="border-primary-400 flex items-center border"
        position="top-right">{#snippet icon()}<ExclamationCircleSolid />{/snippet}{$error}</Toast>
</main>

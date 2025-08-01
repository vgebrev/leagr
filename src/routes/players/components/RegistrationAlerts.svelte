<script>
    import { Alert } from 'flowbite-svelte';
    import { ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { dateTimeString } from '$lib/shared/helpers.js';

    let { registrationOpenDate, registrationCloseDate } = $props();

    const now = new Date();
</script>

{#if registrationOpenDate && now < registrationOpenDate}
    <Alert class="flex items-center border">
        <ExclamationCircleSolid />
        You can't add players for this day before {dateTimeString(registrationOpenDate)}
    </Alert>
{/if}

{#if registrationCloseDate && now >= registrationCloseDate}
    <Alert class="flex items-center border">
        <ExclamationCircleSolid />
        You can't add players for this day after {dateTimeString(registrationCloseDate)}
    </Alert>
{/if}

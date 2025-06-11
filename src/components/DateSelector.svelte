<script>
    import { Alert, Datepicker } from 'flowbite-svelte';
    import { ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { dateString, isSaturday } from '$lib/helpers.js';
    import { page } from '$app/state';

    let { selectedDate } = $props();
    let isSelectedSaturday = $derived.by(() => isSaturday(selectedDate));

    function dateChanged(newDate) {
        const date = dateString(newDate);
        window.location.href = `${page.url.pathname}?date=${date}`;
    }
</script>

<Datepicker
    value={selectedDate}
    dateFormat={{ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }}
    onselect={dateChanged}></Datepicker>
{#if !isSelectedSaturday}
    <Alert class="flex items-center border"
        ><ExclamationCircleSolid /><span
            >Selected date is not a Saturday. Are you sure you've got the right date?</span
        ></Alert>
{/if}

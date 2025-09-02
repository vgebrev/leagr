<script>
    import { Alert, Datepicker } from 'flowbite-svelte';
    import { ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { dateString, isCompetitionDay } from '$lib/shared/helpers.js';
    import { settings } from '$lib/client/stores/settings.js';
    import { page } from '$app/state';

    let { selectedDate } = $props();

    let isSelectedCompetitionDay = $derived.by(() =>
        isCompetitionDay(selectedDate, $settings.competitionDays)
    );

    let competitionDaysText = $derived.by(() => {
        const dayNames = [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday'
        ];
        const days = $settings.competitionDays.map((day) => dayNames[day]);

        if (days.length === 1) {
            return days[0];
        } else if (days.length === 2) {
            return `${days[0]} or ${days[1]}`;
        } else {
            return `${days.slice(0, -1).join(', ')}, or ${days[days.length - 1]}`;
        }
    });

    /**
     * Handles the date change event from the Datepicker.
     * Redirects to the current page with the new date as a query parameter.
     * @param {import('flowbite-svelte').DateOrRange} newDate - The newly selected date.
     */
    function dateChanged(newDate) {
        const date = dateString(newDate);
        window.location.href = `${page.url.pathname}?date=${date}`;
    }
</script>

<Datepicker
    value={selectedDate}
    class="border border-gray-200 !bg-gray-50 shadow-md dark:border-gray-700 dark:!bg-gray-800 dark:shadow-gray-900"
    inputClass="dark:!bg-gray-800"
    placeholder="Select a date"
    dateFormat={{ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }}
    onselect={dateChanged}></Datepicker>
{#if !isSelectedCompetitionDay}
    <Alert class="glass flex items-center border"
        ><ExclamationCircleSolid /><span
            >Selected date is not a {competitionDaysText}. Are you sure you've got the right date?</span
        ></Alert>
{/if}

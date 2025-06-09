<script>
    import {
        UserSolid,
        UsersGroupSolid,
        CalendarMonthSolid,
        RectangleListSolid,
        ExclamationCircleSolid,
        AdjustmentsHorizontalSolid,
        AwardSolid
    } from 'flowbite-svelte-icons';
    import '../app.css';
    import { BottomNav, BottomNavItem, Datepicker, Alert, Toast } from 'flowbite-svelte';
    import { page } from '$app/state';
    import { error } from '$lib/stores/error.js';
    import { settings } from '$lib/stores/settings.js';
    import { dateString, isSaturday } from '$lib/helpers.js';
    import { fade } from 'svelte/transition';
    import { setApiKey } from '$lib/api-client.svelte.js';
    import TopNavBar from '../components/TopNavBar.svelte';

    let { data, children } = $props();
    setApiKey(data.apiKey);
    let activeUrl = $derived(`${page.url.pathname}${page.url.search}`);
    let selectedDate = $derived(new Date(data.date));
    let date = $derived(dateString(selectedDate));
    let isSelectedSaturday = $derived.by(() => isSaturday(selectedDate));

    $settings = data.settings;
    function dateChanged(newDate) {
        const date = dateString(newDate);
        window.location.href = `${page.url.pathname}?date=${date}`;
    }
</script>

<svelte:head>
    <title>Pirates Footy Organiser</title>
</svelte:head>
<main class="flex h-[100dvh] flex-col overflow-hidden">
    <TopNavBar {date} />

    <div class="flex-1 overflow-y-auto pb-[4rem]">
        <div
            class="container mx-auto flex flex-col justify-between gap-2 p-2 md:w-2/3 lg:w-1/2 xl:w-1/3">
            <Datepicker
                bind:value={selectedDate}
                dateFormat={{ weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }}
                onselect={dateChanged}></Datepicker>
            {#if !isSelectedSaturday}
                <Alert class="flex items-center border"
                    ><ExclamationCircleSolid /><span
                        >Selected date is not a Saturday. Are you sure you've got the right date?</span
                    ></Alert>
            {/if}
            {@render children()}
        </div>
    </div>

    <BottomNav
        {activeUrl}
        position="fixed"
        innerClass="grid-cols-5"
        class="z-10 shrink-0">
        <BottomNavItem
            btnName="Players"
            href="/players?date={date}">
            <UserSolid class="group-hover:text-primary-600 dark:group-hover:text-primary-500"
            ></UserSolid>
        </BottomNavItem>
        <BottomNavItem
            btnName="Teams"
            href="/teams?date={date}">
            <UsersGroupSolid class="group-hover:text-primary-600 dark:group-hover:text-primary-500"
            ></UsersGroupSolid>
        </BottomNavItem>
        <BottomNavItem
            btnName="Games"
            href="/games?date={date}">
            <CalendarMonthSolid
                class="group-hover:text-primary-600 dark:group-hover:text-primary-500"
            ></CalendarMonthSolid>
        </BottomNavItem>
        <BottomNavItem
            btnName="Table"
            href="/table?date={date}">
            <RectangleListSolid
                class="group-hover:text-primary-600 dark:group-hover:text-primary-500"
            ></RectangleListSolid>
        </BottomNavItem>
        <BottomNavItem
            btnName="Rankings"
            href="/rankings?date={date}">
            <AwardSolid class="group-hover:text-primary-600 dark:group-hover:text-primary-500"
            ></AwardSolid>
        </BottomNavItem>
    </BottomNav>

    <Toast
        toastStatus={!!$error}
        transition={fade}
        color="red"
        class="border-primary-400 flex items-center border"
        position="top-right">{#snippet icon()}<ExclamationCircleSolid />{/snippet}{$error}</Toast>
</main>

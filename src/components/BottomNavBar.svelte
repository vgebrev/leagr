<script>
    import { BottomNav, BottomNavItem } from 'flowbite-svelte';
    import {
        UserSolid,
        UsersGroupSolid,
        CalendarMonthSolid,
        RectangleListSolid,
        AwardSolid
    } from 'flowbite-svelte-icons';
    import { page } from '$app/state';
    let { date } = $props();
    let activeUrl = $derived(`${page.url.pathname}${page.url.search}`);
</script>

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
        <CalendarMonthSolid class="group-hover:text-primary-600 dark:group-hover:text-primary-500"
        ></CalendarMonthSolid>
    </BottomNavItem>
    <BottomNavItem
        btnName="Table"
        href="/table?date={date}">
        <RectangleListSolid class="group-hover:text-primary-600 dark:group-hover:text-primary-500"
        ></RectangleListSolid>
    </BottomNavItem>
    <BottomNavItem
        btnName="Rankings"
        href="/rankings?date={date}">
        <AwardSolid class="group-hover:text-primary-600 dark:group-hover:text-primary-500"
        ></AwardSolid>
    </BottomNavItem>
</BottomNav>

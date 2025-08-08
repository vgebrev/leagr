<script>
    import { Button, Listgroup, ListgroupItem } from 'flowbite-svelte';
    import {
        UserSolid,
        UsersGroupSolid,
        CalendarMonthSolid,
        RectangleListSolid,
        AwardSolid
    } from 'flowbite-svelte-icons';
    import { settings } from '$lib/client/stores/settings.js';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';

    let { data } = $props();

    let competitionDaysText = $derived.by(() => {
        const competitionDays = $settings.competitionDays;
        if (!competitionDays || competitionDays.length === 0) {
            return '';
        }

        const dayNames = [
            'Sunday',
            'Monday',
            'Tuesday',
            'Wednesday',
            'Thursday',
            'Friday',
            'Saturday'
        ];
        const days = competitionDays.map((day) => dayNames[day]);

        if (days.length === 1) {
            return days[0];
        } else if (days.length === 2) {
            return `${days[0]}, or ${days[1]}`;
        } else {
            return `${days.slice(0, -1).join(', ')}, or ${days[days.length - 1]}`;
        }
    });

    let datePickText = $derived.by(() => {
        if (competitionDaysText) {
            return `1. Pick a date, most likely a ${competitionDaysText}.`;
        } else {
            return '1. Pick a date.';
        }
    });
</script>

<Listgroup class="w-full shadow">
    <ListgroupItem class="bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-400"
        >How It Works</ListgroupItem>
    <ListgroupItem><span>{datePickText}</span></ListgroupItem>
    <ListgroupItem
        ><span>
            2. Add your name and any +1s to the <Button
                color="alternative"
                class="align-middle"
                href="/players?date={data.date}"
                size="xs"><UserSolid class="me-2 h-4 w-4"></UserSolid>Players</Button> list.
        </span>
    </ListgroupItem>
    <ListgroupItem
        ><span
            >3. Make random <Button
                color="alternative"
                class="align-middle"
                href="/teams?date={data.date}"
                size="xs"><UsersGroupSolid class="me-2 h-4 w-4"></UsersGroupSolid>Teams</Button>
            before play.</span>
    </ListgroupItem>
    <ListgroupItem>
        <span
            >4. Schedule <Button
                color="alternative"
                class="align-middle"
                href="/games?date={data.date}"
                size="xs"
                ><CalendarMonthSolid class="me-2 h-4 w-4"></CalendarMonthSolid>Games</Button>
            and track scores on the day.</span>
    </ListgroupItem>
    <ListgroupItem
        ><span
            >5. Check out the standings <Button
                color="alternative"
                class="align-middle"
                href="/table?date={data.date}"
                size="xs"
                ><RectangleListSolid class="me-2 h-4 w-4"></RectangleListSolid>Table</Button> after the
            games.</span>
    </ListgroupItem>
    <ListgroupItem
        ><span
            >6. Go for glory in the single-elimination knockout <Button
                color="alternative"
                class="align-middle"
                href="/knockout?date={data.date}"
                size="xs"><TrophyIcon class="me-2 h-3 w-3"></TrophyIcon>Cup</Button> seeded by the final
            league standings.</span>
    </ListgroupItem>
    <ListgroupItem
        ><span
            >7. After the day is done, update the <Button
                color="alternative"
                class="align-middle"
                href="/rankings?date={data.date}"
                size="xs"><AwardSolid class="me-2 h-4 w-4"></AwardSolid>Rankings</Button> and use them
            to seed teams for balance (as well as bragging rights).</span>
    </ListgroupItem>
</Listgroup>

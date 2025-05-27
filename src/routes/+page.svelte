<script>
  import { Button, Listgroup, ListgroupItem } from 'flowbite-svelte';
  import {
    UserSolid,
    UsersGroupSolid,
    CalendarMonthSolid,
    RectangleListSolid
  } from 'flowbite-svelte-icons';

  let { data } = $props();
</script>

<Listgroup class="w-full shadow">
  <ListgroupItem class="bg-gray-200 text-gray-900 dark:bg-gray-700 dark:text-gray-400"
    >How It Works</ListgroupItem
  >
  <ListgroupItem><span> 1. Pick a date, most likely a Saturday. </span></ListgroupItem>
  <ListgroupItem
    ><span>
      2. Add your name and any +1s to the <Button
        color="alternative"
        href="/players?date={data.date}"
        size="xs"><UserSolid class="me-2 h-4 w-4"></UserSolid>Players</Button
      > list.
    </span>
  </ListgroupItem>
  <ListgroupItem
    ><span
      >3. We'll make random <Button color="alternative" href="/teams?date={data.date}" size="xs"
        ><UsersGroupSolid class="me-2 h-4 w-4"></UsersGroupSolid>Teams</Button
      > the day before we play.</span
    >
  </ListgroupItem>
  <ListgroupItem
    ><span
      >4. Schedule <Button color="alternative" href="/games?date={data.date}" size="xs"
        ><CalendarMonthSolid class="me-2 h-4 w-4"></CalendarMonthSolid>Games</Button
      > and track scores on the day.</span
    >
  </ListgroupItem>
  <ListgroupItem
    ><span
      >5. Check out the <Button color="alternative" href="/games?date={data.date}" size="xs"
        ><RectangleListSolid class="me-2 h-4 w-4"></RectangleListSolid>Table</Button
      > after the games.</span
    >
  </ListgroupItem>
</Listgroup>

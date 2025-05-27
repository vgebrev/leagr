<script>
  import { Button, Listgroup, ListgroupItem } from 'flowbite-svelte';

  let { label, players, canModifyList, onremove } = $props();
</script>

<div class="flex flex-col gap-2">
  <span class="block text-sm font-medium text-gray-700 rtl:text-right dark:text-gray-200"
    >{label}</span
  >
  <Listgroup class="w-full gap-0">
    {#each players as player, i (i)}
      <ListgroupItem class="text-md flex gap-2 p-1 ps-2"
        ><span class="max-w-100 overflow-hidden text-nowrap overflow-ellipsis whitespace-nowrap"
          >{i + 1}. {player}</span
        >{#if onremove}
          <Button
            size="sm"
            class="ms-auto p-0"
            type="button"
            outline={true}
            pill={true}
            onclick={async () => await onremove(player)}
            disabled={!canModifyList}
            ><svg class="h-4 w-4" width="20" height="20" viewBox="0 0 20 20"
              ><path
                d="M10 10l5.09-5.09L10 10l5.09 5.09L10 10zm0 0L4.91 4.91 10 10l-5.09 5.09L10 10z"
                stroke="currentColor"
                fill="none"
                fill-rule="evenodd"
                stroke-linecap="round"
                stroke-linejoin="round"
              ></path></svg
            ></Button
          >{/if}</ListgroupItem
      >
    {/each}
  </Listgroup>
</div>

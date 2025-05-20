<script>
	import { Button } from 'flowbite-svelte';
	import { UserSolid } from 'flowbite-svelte-icons';

	let { data } = $props();
</script>

<div class="py-2">
	Add your name and any +1s to the <Button color="alternative" href="/players?date={data.date}" size="xs"><UserSolid class="me-2 h-4 w-4"></UserSolid>Players</Button> list.
</div>

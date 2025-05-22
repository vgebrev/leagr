<script>
	import { Button } from 'flowbite-svelte';
	import { UsersGroupSolid } from 'flowbite-svelte-icons';
	import { onMount } from 'svelte';
	import { api } from '$lib/api-client.js';
	let { data } = $props();
	const date = data.date;
	let players = $state([]);
	let possibleTeamCount = $derived.by(() => Math.floor(players.length / 2));
	onMount(async () => {
		players = await api.get('players', date);
	});
</script>

<div class="flex flex-col gap-2">
	<span>{players.length} players available. Will make {possibleTeamCount} teams.</span>
	<Button><UsersGroupSolid class="me-2 h-4 w-4" /> Generate Teams</Button>
</div>

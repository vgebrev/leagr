<script>
	import {
		Label,
		Input,
		Button,
		Listgroup,
		ListgroupItem,
		Spinner,
		Alert,
		Toast
	} from 'flowbite-svelte';
	import { CirclePlusSolid, TrashBinSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';
	import { onMount } from 'svelte';
	import { dateTimeString } from '$lib/helpers.js';
	import { api } from '$lib/api-client.js';
	import { fade } from 'svelte/transition';

	let { data } = $props();
	const date = data.date;
	let players = $state([]);
	let playerName = $state('');
	let isLoading = $state(false);
	let error = $state('');

	const registrationOpenDate = $derived.by(() => {
		const limit = new Date(date);
		limit.setDate(limit.getDate() - 2);
		limit.setHours(7, 30, 0, 0);
		return limit;
	});

	const registrationCloseDate = $derived.by(() => {
		const limit = new Date(date);
		limit.setDate(limit.getDate());
		limit.setHours(7, 30, 0, 0);
		return limit;
	});

	const canModifyList = $derived.by(() => {
		const now = new Date();
		return now >= registrationOpenDate && now <= registrationCloseDate;
	});

	onMount(async () => {
		isLoading = true;
		try {
			players = await api.get('players', date);
		} catch (ex) {
			console.error('Error fetching players:', ex);
			setError('Failed to load players. Please try again.');
		} finally {
			isLoading = false;
		}
	});

	async function addPlayer(event) {
		event.preventDefault();
		try {
			if (playerName && !players.includes(playerName)) {
				await api.post('players', date, { playerName });
				players.push(playerName);
			} else {
				setError(`Player ${playerName} already added.`);
			}
		} catch (ex) {
			console.error('Error adding player:', ex);
			setError('Failed to add player. Please try again.');
		}
	}

	async function removePlayer(index) {
		try {
			const playerName = players[index];
			if (playerName) {
				await api.remove('players', date, { playerName });
				players.splice(index, 1);
			}
		} catch (ex) {
			console.error('Error removing player:', ex);
			setError('Failed to remove player. Please try again.');
		}
	}

	function setError(err) {
		error = err;
		setTimeout(() => (error = ''), 5000);
	}
</script>

<div class="flex flex-col gap-2">
	<Label for="player-name">Add a player to the list</Label>
	<form class="flex gap-2" onsubmit={async (event) => await addPlayer(event)}>
		<Input
			bind:value={playerName}
			id="player-name"
			name="player-name"
			type="text"
			placeholder="Player Name"
			wrapperClass="w-full"
			required
			disabled={!canModifyList}
		/>
		<Button type="submit" disabled={!canModifyList}>
			<CirclePlusSolid class="me-2 h-4 w-4"></CirclePlusSolid> Add</Button
		>
	</form>
	{#if new Date() < registrationOpenDate}
		<Alert class="flex items-center border"
			><ExclamationCircleSolid />You can add players for this day after
			{dateTimeString(registrationOpenDate)}</Alert
		>
	{/if}
	{#if new Date() >= registrationCloseDate}
		<Alert class="flex items-center border"
			><ExclamationCircleSolid />You can add players for this day until
			{dateTimeString(registrationCloseDate)}</Alert
		>
	{/if}

	<span class="block text-sm font-medium text-gray-700 rtl:text-right dark:text-gray-200"
		>Players</span
	>
	<Listgroup class="w-full">
		{#each players as player, i (i)}
			<ListgroupItem class="flex gap-2"
				><span class="text-xl">{i + 1}. {player}</span><Button
					size="xs"
					class="ms-auto"
					type="button"
					onclick={async () => await removePlayer(i)}
					disabled={!canModifyList}><TrashBinSolid class="me-2 h-3 w-3" />Remove</Button
				></ListgroupItem
			>
		{/each}
	</Listgroup>
	{#if isLoading}
		<Spinner />
	{/if}
</div>

<Toast
	toastStatus={!!error}
	transition={fade}
	color="red"
	class="border-primary-400 flex items-center border"
	position="top-right">{#snippet icon()}<ExclamationCircleSolid />{/snippet}{error}</Toast
>

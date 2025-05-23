<script>
	import { Label, Input, Button, Alert, Toast } from 'flowbite-svelte';
	import { CirclePlusSolid, CheckCircleSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';
	import { onMount } from 'svelte';
	import { dateTimeString } from '$lib/helpers.js';
	import { api } from '$lib/api-client.js';
	import { setError } from '$lib/stores/error.js';
	import PlayersList from '../../components/PlayersList.svelte';

	let { data } = $props();
	const date = data.date;
	let players = $state([]);
	let playerLimit = $state(18);
	let playerName = $state('');

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
		try {
			players = await api.get('players', date);
			playerLimit = await api.get('players/limit', date);
		} catch (ex) {
			console.error('Error fetching players:', ex);
			setError('Failed to load players. Please try again.');
		}
	});
	async function setPlayerLimit(event) {
		event.preventDefault();
		try {
			if (playerLimit !== null) {
				await api.post('players/limit', date, { playerLimit });
			} else {
				setError(`Player limit isn't set.`);
			}
		} catch (ex) {
			console.error('Error limiting players:', ex);
			setError('Failed to set player limit. Please try again.');
		}
	}

	async function addPlayer(event) {
		event.preventDefault();
		try {
			if (playerName && !players.includes(playerName.trim())) {
				await api.post('players', date, { playerName: playerName.trim() });
				players.push(playerName.trim());
				playerName = '';
			} else {
				setError(`Player ${playerName} already added.`);
			}
		} catch (ex) {
			console.error('Error adding player:', ex);
			setError('Failed to add player. Please try again.');
		}
	}

	async function removePlayer(playerName) {
		try {
			const index = players.indexOf(playerName);
			if (playerName && index !== -1) {
				await api.remove('players', date, { playerName });
				players.splice(index, 1);
			}
		} catch (ex) {
			console.error('Error removing player:', ex);
			setError('Failed to remove player. Please try again.');
		}
	}
</script>

<div class="flex flex-col gap-2">
	<Label for="player-limit">Player limit</Label>
	<form class="flex gap-2" onsubmit={async (event) => await setPlayerLimit(event)}>
		<Input
			bind:value={playerLimit}
			id="player-limit"
			name="player-limit"
			type="number"
			step={1}
			min={0}
			placeholder=""
			wrapperClass="w-full"
			required
			disabled={!canModifyList}
		/>
		<Button type="submit" disabled={!canModifyList}>
			<CheckCircleSolid class="me-2 h-4 w-4" /> Set</Button
		>
	</form>
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

	<div class="grid grid-cols-2 gap-2">
		<PlayersList
			label="Players"
			players={players.filter((p, i) => i < playerLimit)}
			{canModifyList}
			onremove={removePlayer}
		/>
		<PlayersList
			label="Waiting list"
			players={players.filter((p, i) => i >= playerLimit)}
			{canModifyList}
			onremove={removePlayer}
		/>
	</div>
</div>

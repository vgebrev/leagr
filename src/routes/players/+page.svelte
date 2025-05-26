<script>
	import { Label, Input, Button, Alert } from 'flowbite-svelte';
	import { CirclePlusSolid, ExclamationCircleSolid } from 'flowbite-svelte-icons';
	import { onMount } from 'svelte';
	import { dateTimeString } from '$lib/helpers.js';
	import { api } from '$lib/api-client.js';
	import { setError } from '$lib/stores/error.js';
	import { isLoading } from '$lib/stores/loading.js';
	import { settings } from '$lib/stores/settings.js';
	import PlayersList from '../../components/PlayersList.svelte';

	let { data } = $props();
	const date = data.date;

	let players = $state([]);
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
			$isLoading = true;
			players = await api.get('players', date);
		} catch (ex) {
			console.error('Error fetching players:', ex);
			setError('Failed to load players. Please try again.');
		} finally {
			$isLoading = false;
		}
	});

	async function addPlayer(event) {
		event.preventDefault();
		try {
			$isLoading = true;
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
		} finally {
			$isLoading = false;
		}
	}

	async function removePlayer(playerName) {
		try {
			$isLoading = true;
			const index = players.indexOf(playerName);
			if (playerName && index !== -1) {
				await api.remove('players', date, { playerName });
				players.splice(index, 1);
			}
		} catch (ex) {
			console.error('Error removing player:', ex);
			setError('Failed to remove player. Please try again.');
		} finally {
			$isLoading = false;
		}
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
			><ExclamationCircleSolid />You can't add players for this day before
			{dateTimeString(registrationOpenDate)}</Alert
		>
	{/if}
	{#if new Date() >= registrationCloseDate}
		<Alert class="flex items-center border"
			><ExclamationCircleSolid />You can't add players for this day after
			{dateTimeString(registrationCloseDate)}</Alert
		>
	{/if}

	<div class="grid grid-cols-2 gap-2">
		<PlayersList
			label={`Players (${$settings.playerLimit} max)`}
			players={players.filter((p, i) => i < $settings.playerLimit)}
			{canModifyList}
			onremove={removePlayer}
		/>
		<PlayersList
			label="Waiting list"
			players={players.filter((p, i) => i >= $settings.playerLimit)}
			{canModifyList}
			onremove={removePlayer}
		/>
	</div>
</div>

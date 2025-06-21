<script>
    import {
        Accordion,
        AccordionItem,
        Alert,
        Button,
        Listgroup,
        Table,
        TableBody,
        TableBodyCell,
        TableBodyRow,
        TableHead,
        TableHeadCell
    } from 'flowbite-svelte';
    import { InfoCircleOutline, ChartOutline, ExclamationCircleSolid } from 'flowbite-svelte-icons';
    import { withLoading } from '$lib/stores/loading.js';
    import { setError } from '$lib/stores/error.js';
    import { onMount } from 'svelte';
    import { api } from '$lib/services/api-client.svelte.js';
    import CelebrationOverlay from '../../components/CelebrationOverlay.svelte';

    let rankings = $state({});
    let sortBy = $state('points');
    let sortedPlayers = $derived(
        Object.entries(rankings.players ?? {}).sort((a, b) => {
            if (sortBy === 'points') {
                if (b[1].points !== a[1].points) return b[1].points - a[1].points;
                return b[1].appearances - a[1].appearances;
            } else if (sortBy === 'average') {
                const avgA = a[1].points / a[1].appearances;
                const avgB = b[1].points / b[1].appearances;
                if (avgB !== avgA) return avgB - avgA;
                if (b[1].points !== a[1].points) return b[1].points - a[1].points;
                return b[1].appearances - a[1].appearances;
            } else if (sortBy === 'appearances') {
                if (b[1].appearances !== a[1].appearances)
                    return b[1].appearances - a[1].appearances;
                return b[1].points - a[1].points;
            } else {
                return 0; // Default case, no sorting
            }
        })
    );
    let celebrating = $state(false);
    /** @type {string | null} */
    let winner = $state(null);
    let pointsInfo = [
        'Attendance: 1pt for showing up',
        'Match Results: 3pts for a win, 1pt for a draw, 0 for a loss',
        'Team Bonus: 2-8pts based on final team position and number of teams'
    ];

    async function updateRankings() {
        await withLoading(
            async () => {
                rankings = await api.post('rankings');
            },
            (err) => {
                console.error(err);
                setError('Unable to update rankings. Please try again.');
            }
        );
    }

    /** @param {number} index */
    function celebrate(index) {
        if (index !== 0) return;
        winner = sortedPlayers[index][0];
        celebrating = true;
    }

    onMount(async () => {
        await withLoading(
            async () => {
                rankings = await api.get('rankings');
            },
            (err) => {
                console.error(err);
                setError('Unable to load rankings. Please try again.');
            }
        );
    });
</script>

<div class="flex flex-col gap-2">
    <Accordion
        class="p-2 text-sm"
        flush>
        <AccordionItem>
            {#snippet header()}<InfoCircleOutline /> Ranking Info{/snippet}
            <div class="flex flex-col items-center gap-2">
                <p>Players receive ranking points based on their team performance on the day.</p>
                <Listgroup items={pointsInfo} />
                <p>Rankings are used to seed players and generate balanced teams.</p>
            </div>
        </AccordionItem>
    </Accordion>
    <Table
        class="w-full text-xs"
        shadow>
        <TableHead>
            <TableHeadCell class="px-1 py-1.5 text-center">#</TableHeadCell>
            <TableHeadCell class="px-1 py-1.5 font-bold text-black dark:text-white"
                >Player</TableHeadCell>
            <TableHeadCell
                class={`cursor-default px-1 py-1.5 text-center ${sortBy === 'appearances' ? 'font-bold text-black dark:text-white' : ''}`}>
                <span
                    role="button"
                    aria-label="Sort by appearances"
                    tabindex="0"
                    onkeydown={() => (sortBy = 'appearances')}
                    onclick={() => (sortBy = 'appearances')}>
                    Appearances
                </span></TableHeadCell>
            <TableHeadCell
                class={`cursor-default px-1 py-1.5 text-center ${sortBy === 'points' ? 'font-bold text-black dark:text-white' : ''}`}>
                <span
                    role="button"
                    aria-label="Sort by points"
                    tabindex="0"
                    onkeydown={() => (sortBy = 'points')}
                    onclick={() => (sortBy = 'points')}>Points</span
                ></TableHeadCell>
            <TableHeadCell
                class={`cursor-default px-1 py-1.5 text-center ${sortBy === 'average' ? 'font-bold text-black dark:text-white' : ''}`}>
                <span
                    role="button"
                    aria-label="Sort by points per appearance"
                    tabindex="0"
                    onkeydown={() => (sortBy = 'average')}
                    onclick={() => (sortBy = 'average')}>Pts/App</span
                ></TableHeadCell>
        </TableHead>
        <TableBody>
            {#each sortedPlayers as [player, data], index (index)}
                <TableBodyRow>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {index + 1}
                    </TableBodyCell>
                    <TableBodyCell
                        class="text-bold flex px-1 py-1.5 font-bold text-black dark:text-white">
                        <span
                            class="w-full"
                            role="button"
                            tabindex="0"
                            onclick={() => celebrate(index)}
                            onkeydown={() => celebrate(index)}>{player}</span>
                    </TableBodyCell>
                    <TableBodyCell
                        class={`cursor-default px-1 py-1.5 text-center ${sortBy === 'appearances' ? 'font-bold text-black dark:text-white' : ''}`}>
                        <span
                            role="button"
                            aria-label="Sort by appearances"
                            tabindex="0"
                            onkeydown={() => (sortBy = 'appearances')}
                            onclick={() => (sortBy = 'appearances')}>
                            {data.appearances}</span>
                    </TableBodyCell>
                    <TableBodyCell
                        class={`cursor-default px-1 py-1.5 text-center ${sortBy === 'points' ? 'font-bold text-black dark:text-white' : ''}`}>
                        <span
                            class="w-full"
                            role="button"
                            aria-label="Sort by points"
                            tabindex="0"
                            onkeydown={() => (sortBy = 'points')}
                            onclick={() => (sortBy = 'points')}>{data.points}</span>
                    </TableBodyCell>
                    <TableBodyCell
                        class={`cursor-default px-1 py-1.5 text-center ${sortBy === 'average' ? 'font-bold text-black dark:text-white' : ''}`}>
                        <span
                            class="w-full"
                            role="button"
                            aria-label="Sort by points per appearance"
                            tabindex="0"
                            onkeydown={() => (sortBy = 'average')}
                            onclick={() => (sortBy = 'average')}>
                            {(data.points / data.appearances).toLocaleString('en-US', {
                                minimumFractionDigits: 0,
                                maximumFractionDigits: 2
                            })}</span>
                    </TableBodyCell>
                </TableBodyRow>
            {/each}
        </TableBody>
    </Table>
    <Button onclick={async () => await updateRankings()}
        ><ChartOutline class="me-2 h-4 w-4" /> Update Rankings</Button>
    <Alert class="flex items-center border"
        ><ExclamationCircleSolid /><span
            >Only update rankings after the last game score of the day is recorded!</span
        ></Alert>
</div>
<CelebrationOverlay
    bind:celebrating
    teamName={winner}
    teamColour="default"
    icon="🥇"
    confettiColours={['#efb100', '#fff085']} />

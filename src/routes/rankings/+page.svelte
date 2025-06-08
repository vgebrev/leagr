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
    import { isLoading } from '$lib/stores/loading.js';
    import { setError } from '$lib/stores/error.js';
    import { onMount } from 'svelte';
    import { api } from '$lib/api-client.svelte.js';

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
            } else {
                return 0; // Default case, no sorting
            }
        })
    );

    let pointsInfo = [
        'Attendance: 1pt for showing up',
        'Match Results: 3pts for a win, 1pt for a draw, 0 for a loss',
        'Team Bonus: 2-8pts based on final team position and number of teams'
    ];

    async function updateRankings() {
        $isLoading = true;
        try {
            rankings = await api.post('rankings');
        } catch (ex) {
            console.error(ex);
            setError('Unable to update rankings. Please try again.');
        } finally {
            $isLoading = false;
        }
    }

    onMount(async () => {
        $isLoading = true;
        try {
            rankings = await api.get('rankings');
        } catch (ex) {
            console.error(ex);
            setError('Unable to load rankings. Please try again.');
        } finally {
            $isLoading = false;
        }
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
            <TableHeadCell class="px-1 py-1.5 text-center">Appearances</TableHeadCell>
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
                        class="text-bold px-1 py-1.5 font-bold text-black dark:text-white">
                        {player}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {data.appearances}
                    </TableBodyCell>
                    <TableBodyCell
                        class={`cursor-default px-1 py-1.5 text-center ${sortBy === 'points' ? 'font-bold text-black dark:text-white' : ''}`}>
                        <span
                            role="button"
                            aria-label="Sort by points"
                            tabindex="0"
                            onkeydown={() => (sortBy = 'points')}
                            onclick={() => (sortBy = 'points')}>{data.points}</span>
                    </TableBodyCell>
                    <TableBodyCell
                        class={`cursor-default px-1 py-1.5 text-center ${sortBy === 'average' ? 'font-bold text-black dark:text-white' : ''}`}>
                        <span
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

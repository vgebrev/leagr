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
    import { api } from '$lib/api-client.js';

    let rankings = $state({});
    let sortedPlayers = $derived(
        Object.entries(rankings.players ?? {}).sort((a, b) => {
            if (b[1].points !== a[1].points) return b[1].points - a[1].points;
            return b[1].appearances - a[1].appearances;
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
            <TableHeadCell class="px-1 py-1.5 text-center font-bold text-black dark:text-white"
                >Points</TableHeadCell>

            <TableHeadCell class="px-1 py-1.5 text-center">Pts/App</TableHeadCell>
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
                        class="px-1 py-1.5 text-center font-bold text-black dark:text-white">
                        {data.points}
                    </TableBodyCell>
                    <TableBodyCell class="px-1 py-1.5 text-center">
                        {(data.points / data.appearances).toLocaleString('en-US', {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 2
                        })}
                    </TableBodyCell>
                </TableBodyRow>
            {/each}
        </TableBody>
    </Table>
    <Button onclick={async () => await updateRankings()}
        ><ChartOutline class="me-2 h-4 w-4" /> Update Rankings</Button>
    <Alert class="flex items-center border"
        ><ExclamationCircleSolid /><span
            >NOTE: Only update rankings after the last match score is recorded.</span
        ></Alert>
</div>

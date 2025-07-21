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
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import { onMount } from 'svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import CelebrationOverlay from '$components/CelebrationOverlay.svelte';

    let rankings = $state({});
    let sortBy = $state('rankingPoints'); // Default to ranking points

    let sortedPlayers = $derived(
        Object.entries(rankings.players ?? {}).sort((a, b) => {
            if (sortBy === 'rankingPoints') {
                if (b[1].rankingPoints !== a[1].rankingPoints)
                    return b[1].rankingPoints - a[1].rankingPoints;
                return b[1].points - a[1].points;
            } else if (sortBy === 'rawAverage') {
                if (b[1].rawAverage !== a[1].rawAverage) return b[1].rawAverage - a[1].rawAverage;
                if (b[1].points !== a[1].points) return b[1].points - a[1].points;
                return b[1].appearances - a[1].appearances;
            } else if (sortBy === 'points') {
                if (b[1].points !== a[1].points) return b[1].points - a[1].points;
                return b[1].appearances - a[1].appearances;
            } else if (sortBy === 'appearances') {
                if (b[1].appearances !== a[1].appearances)
                    return b[1].appearances - a[1].appearances;
                return b[1].points - a[1].points;
            } else {
                return 0;
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
    let rankingInfo = [
        "Apps: How many times you've played",
        'Points: Your total score from all appearances as described above',
        'Pts/App: Your average score per appearance',
        'Ranking Pts: Your skill level adjusted for experience - this is what we use to make fair teams',
        'How Ranking Points Work: Your average gets adjusted based on experience. New players get pulled toward the league minimum until they play enough games for full confidence. Then we multiply by the max games played to get your ranking points.'
    ];

    async function updateRankings() {
        await withLoading(
            async () => {
                rankings = await api.post('rankings');
            },
            (err) => {
                console.error(err);
                setNotification(
                    err.message || 'Unable to update rankings. Please try again.',
                    'error'
                );
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
                setNotification(
                    err.message || 'Unable to load rankings. Please try again.',
                    'error'
                );
            }
        );
    });
</script>

<div class="flex flex-col gap-2">
    <Accordion flush>
        <AccordionItem classes={{ button: 'p-2 text-sm', content: 'p-2 text-sm' }}>
            {#snippet header()}<InfoCircleOutline /> Ranking Info{/snippet}
            <div class="flex flex-col items-center gap-2">
                <p>Players receive ranking points based on their team performance on the day.</p>
                <Listgroup items={pointsInfo} />
                <p class="text-center"><strong>Ranking System:</strong></p>
                <Listgroup items={rankingInfo} />
                {#if rankings.rankingMetadata}
                    <p class="text-center text-gray-600 dark:text-gray-400">
                        League Average: {rankings.rankingMetadata.globalAverage} pts/game • Full Confidence:
                        {rankings.rankingMetadata.confidenceThreshold}+ games • Total Players: {rankings
                            .rankingMetadata.totalPlayers}
                    </p>
                {/if}
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
                    Apps
                </span></TableHeadCell>
            <TableHeadCell
                class={`cursor-default px-1 py-1.5 text-center ${sortBy === 'points' ? 'font-bold text-black dark:text-white' : ''}`}>
                <span
                    role="button"
                    aria-label="Sort by total points"
                    tabindex="0"
                    onkeydown={() => (sortBy = 'points')}
                    onclick={() => (sortBy = 'points')}>Points</span
                ></TableHeadCell>
            <TableHeadCell
                class={`cursor-default px-1 py-1.5 text-center ${sortBy === 'rawAverage' ? 'font-bold text-black dark:text-white' : ''}`}>
                <span
                    role="button"
                    aria-label="Sort by raw average"
                    tabindex="0"
                    onkeydown={() => (sortBy = 'rawAverage')}
                    onclick={() => (sortBy = 'rawAverage')}>Pts/App</span
                ></TableHeadCell>
            <TableHeadCell
                class={`cursor-default px-1 py-1.5 text-center ${sortBy === 'rankingPoints' ? 'font-bold text-black dark:text-white' : ''}`}>
                <span
                    role="button"
                    aria-label="Sort by ranking points"
                    tabindex="0"
                    onkeydown={() => (sortBy = 'rankingPoints')}
                    onclick={() => (sortBy = 'rankingPoints')}>Ranking Pts</span
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
                            aria-label="Sort by total points"
                            tabindex="0"
                            onkeydown={() => (sortBy = 'points')}
                            onclick={() => (sortBy = 'points')}>{data.points}</span>
                    </TableBodyCell>
                    <TableBodyCell
                        class={`cursor-default px-1 py-1.5 text-center ${sortBy === 'rawAverage' ? 'font-bold text-black dark:text-white' : ''}`}>
                        <span
                            class="w-full"
                            role="button"
                            aria-label="Sort by raw average"
                            tabindex="0"
                            onkeydown={() => (sortBy = 'rawAverage')}
                            onclick={() => (sortBy = 'rawAverage')}>
                            {data.rawAverage}</span>
                    </TableBodyCell>
                    <TableBodyCell
                        class={`cursor-default px-1 py-1.5 text-center ${sortBy === 'rankingPoints' ? 'font-bold text-black dark:text-white' : ''}`}>
                        <span
                            class="w-full"
                            role="button"
                            aria-label="Sort by ranking points"
                            tabindex="0"
                            onkeydown={() => (sortBy = 'rankingPoints')}
                            onclick={() => (sortBy = 'rankingPoints')}>
                            {data.rankingPoints}</span>
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

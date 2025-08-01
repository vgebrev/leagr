<script>
    import { Accordion, AccordionItem, Listgroup } from 'flowbite-svelte';
    import { InfoCircleOutline } from 'flowbite-svelte-icons';

    let { rankingMetadata = null } = $props();

    const pointsInfo = [
        'Attendance: 1pt for showing up',
        'Match Results: 3pts for a win, 1pt for a draw, 0 for a loss',
        'Team Bonus: 2-8pts based on final team position and number of teams'
    ];

    const rankingInfo = [
        "Apps: How many times you've played",
        'Points: Your total score from all appearances as described above',
        'Pts/App: Your average score per appearance',
        'Ranking Pts: Your skill level adjusted for experience - this is what we use to make fair teams',
        'How Ranking Points Work: Your average gets adjusted based on experience. New players get pulled toward the league minimum until they play enough games for full confidence. Then we multiply by the max games played to get your ranking points.'
    ];
</script>

<Accordion flush>
    <AccordionItem classes={{ button: 'p-2 text-sm', content: 'p-2 text-sm' }}>
        {#snippet header()}<InfoCircleOutline /> Ranking Info{/snippet}
        <div class="flex flex-col items-center gap-2">
            <p>Players receive ranking points based on their team performance on the day.</p>
            <Listgroup items={pointsInfo} />
            <p class="text-center"><strong>Ranking System:</strong></p>
            <Listgroup items={rankingInfo} />
            {#if rankingMetadata}
                <p class="text-center text-gray-600 dark:text-gray-400">
                    League Average: {rankingMetadata.globalAverage} pts/game • Full Confidence:
                    {rankingMetadata.confidenceThreshold}+ games • Total Players: {rankingMetadata.totalPlayers}
                </p>
            {/if}
            <p>Rankings are used to seed players and generate balanced teams.</p>
        </div>
    </AccordionItem>
</Accordion>

<script>
    import { Accordion, AccordionItem, Listgroup } from 'flowbite-svelte';
    import { InfoCircleOutline } from 'flowbite-svelte-icons';

    let { rankingMetadata = null } = $props();

    const pointsInfo = [
        'Attendance: 1pt for showing up',
        'Match Results: 3pts for a win, 1pt for a draw, 0 for a loss',
        'Team Bonus: 2-8pts based on final team position and number of teams',
        'Knockout Bonus: 3pts for each knockout match won'
    ];

    const rankingInfo = [
        "Apps: How many times you've played",
        'Points: Your total score from all appearances as described above',
        'Pts/App: Your average score per appearance',
        'Ranking Pts: Your skill level adjusted for consistency of appearance - this is what we use for individual rankings',
        'How Ranking Points Work: Your average gets adjusted based on number of appearances. New players get pulled toward the league minimum until they play enough games for full confidence. Then we multiply by the max games played to get your ranking points.'
    ];

    const eloInfo = [
        'Each player is given an ELO rating, which is used for seeding and balancing teams.',
        'New players start with an ELO of 1000.',
        'Rating updates: After each game, player ratings change based on:',
        '- Expected score (0-1) based on average ELO of each team.',
        '- Actual score: 1 for a win, 0.5 for a draw, 0 for a loss.',
        '- K-factor: 10 for league games, 7 for cup games.',
        '- Rating Change: K-factor * (Actual Score - Expected Score).',
        'Weekly Decay: 2% decay towards baseline (1000) each week of inactivity.',
        'Example: If your team (avg 1050) beats opponent team (avg 950) in league:',
        '- Expected: 0.76, Actual: 1.0, Change: +2.4 points per player'
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
            <p class="text-center"><strong>ELO System:</strong></p>
            <Listgroup items={eloInfo} />
            {#if rankingMetadata}
                <p class="text-center text-gray-600 dark:text-gray-400">
                    League Average: {rankingMetadata.globalAverage} pts/appearance • Full Confidence:
                    {rankingMetadata.confidenceThreshold}+ appearances • Total Players: {rankingMetadata.totalPlayers}
                </p>
            {/if}
            <p>ELO ratings are used to seed players and generate balanced teams.</p>
        </div>
    </AccordionItem>
</Accordion>

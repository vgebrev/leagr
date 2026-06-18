<script>
    import { Accordion, AccordionItem, Listgroup } from 'flowbite-svelte';
    import { InfoCircleOutline } from 'flowbite-svelte-icons';

    let { rankingMetadata = null } = $props();

    const pointsInfo = [
        'Attendance: 1pt for showing up',
        'Match Results: 3pts for a win, 1pt for a draw, 0 for a loss',
        'Team Bonus: 2pts for each team you finish above (e.g. 6pts for 1st in a 4-team session)',
        'Knockout Bonus: 4pts for each knockout match won'
    ];

    const rankingInfo = [
        "Apps: How many times you've played",
        'Points: Your total score from all appearances as described above',
        'Pts/App: Your average score per appearance',
        'Ranking Pts: Your skill level adjusted for consistency of appearance - this is what we use for individual rankings',
        'How Ranking Points Work: Your average gets adjusted based on number of appearances. New players get pulled toward the league minimum until they play enough games for full confidence. Then we multiply by the max games played to get your ranking points.'
    ];

    const eloInfo = [
        'Each player is given an ELO rating, used for seeding and balancing teams.',
        'New players start with a rating of 1000. ELO carries over year-to-year.',
        'After each game, ratings change based on:',
        '- Expected score (based on average ELO of each team vs opponent)',
        '- Actual score: 1 for a win, 0.5 for a draw, 0 for a loss',
        '- K-factor: 24 for league games, 15 for cup games',
        '- Win margin bonus: 1.0× for a 1-goal win, up to 1.3× for 4+ goal victories',
        '- Rating change = K × margin × (actual − expected) per player',
        '- Penalty shootout: winner scores 0.65, loser 0.35 (not treated as a plain draw)',
        'Weekly Decay: 2% towards baseline (1000) per week of inactivity.',
        'Example: Team avg 1050 beats team avg 950 in a league game by 1 goal:',
        '- Expected: 0.64, Actual: 1.0, Change: +8.6 pts per player'
    ];
</script>

<Accordion
    flush
    class="dark:text-gray-300">
    <AccordionItem classes={{ button: 'p-2 text-sm', content: 'p-2 text-sm' }}>
        {#snippet header()}<InfoCircleOutline /> Ranking Info{/snippet}
        <div class="flex flex-col items-center gap-2">
            <p>Players receive ranking points based on their team performance on the day.</p>
            <Listgroup
                class="dark:text-gray-300"
                items={pointsInfo} />
            <p class="text-center"><strong>Ranking System:</strong></p>
            <Listgroup
                class="dark:text-gray-300"
                items={rankingInfo} />
            <p class="text-center"><strong>ELO System:</strong></p>
            <Listgroup
                class="dark:text-gray-300"
                items={eloInfo} />
            {#if rankingMetadata}
                <p class="text-center text-gray-600 dark:text-gray-300">
                    League Average: {rankingMetadata.globalAverage} pts/appearance • Full Confidence:
                    {rankingMetadata.confidenceThreshold}+ appearances • Total Players: {rankingMetadata.totalPlayers}
                </p>
            {/if}
            <p>ELO ratings are used to seed players and generate balanced teams.</p>
        </div>
    </AccordionItem>
</Accordion>

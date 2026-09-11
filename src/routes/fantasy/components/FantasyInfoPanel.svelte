<script>
    import { Accordion, AccordionItem, Listgroup } from 'flowbite-svelte';
    import { InfoCircleOutline } from 'flowbite-svelte-icons';

    /**
     * What the fantasy game pays for, and the rules a squad lives under.
     *
     * The weights come off the session payload rather than being restated here: they are
     * league-tunable, and only the stat types the league currently tracks are paid for at
     * all, so a hard-coded copy would go quietly wrong the first time either changed.
     * @type {{
     *   squadSize?: number,
     *   budget?: number,
     *   scoring?: Record<string, number>,
     *   statTypes?: string[]
     * }}
     */
    let { squadSize = 0, budget = 0, scoring = {}, statTypes = [] } = $props();

    /** Stat type → [the wording the match sheet uses, the scoring weight that pays it]. */
    const STAT_LABELS = {
        goals: ['Goal', 'goal'],
        offActions: ['Attacking action', 'offAction'],
        defActions: ['Defensive action', 'defAction'],
        saveActions: ['Save', 'save']
    };

    // Rankings pay 3 for a win and 1 for a draw, and 4 for a knockout win. Fantasy takes a
    // fraction of each, so the rules are stated in points rather than in multipliers.
    const WIN_POINTS = 3;
    const DRAW_POINTS = 1;
    const KNOCKOUT_WIN_POINTS = 4;

    /** @param {number} value */
    const pts = (value) => Math.round(value * 100) / 100;

    let squadInfo = $derived([
        `Pick ${squadSize} players for $${budget}m. The market opens with registration and closes when the first match kicks off.`,
        'Your captain scores double. The armband starts on your priciest pick — move it to any player in your squad.',
        'Prices move as players register, so a squad that fit can drift over budget. Fix it before kick-off: an over-budget squad is not scored.',
        'A pick who withdraws from the session scores nothing, but does not invalidate your squad.',
        "Other managers' squads stay hidden until the first match kicks off.",
        'Scores appear once the session rankings have been updated.'
    ]);

    let pointsInfo = $derived([
        `Appearance: ${pts(scoring.appearance ?? 0)}pts just for playing`,
        ...statTypes
            .filter((type) => type in STAT_LABELS)
            .map((type) => {
                const [label, weight] = STAT_LABELS[type];
                return `${label}: ${pts(scoring[weight] ?? 0)}pts each`;
            }),
        `Match result: ${pts((scoring.matchPoint ?? 0) * WIN_POINTS)}pts for a win, ${pts(
            (scoring.matchPoint ?? 0) * DRAW_POINTS
        )}pts for a draw`,
        `Knockout: ${pts(
            (scoring.knockout ?? 0) * KNOCKOUT_WIN_POINTS
        )}pts for each knockout match won`,
        `Trophies: ${pts(scoring.leagueWin ?? 0)}pts for winning the league, ${pts(
            scoring.cupWin ?? 0
        )}pts for the cup`
    ]);
</script>

<Accordion
    flush
    class="dark:text-gray-300">
    <AccordionItem classes={{ button: 'p-2 text-sm', content: 'p-2 text-sm' }}>
        {#snippet header()}<InfoCircleOutline /> Fantasy Info{/snippet}
        <div class="flex flex-col items-center gap-2">
            <p>
                Pick a squad from this week's market and score whatever your players score on the
                day.
            </p>
            <Listgroup
                class="dark:text-gray-300"
                items={squadInfo} />
            <p class="text-center"><strong>Scoring:</strong></p>
            <Listgroup
                class="dark:text-gray-300"
                items={pointsInfo} />
            <p class="text-center text-gray-600 dark:text-gray-300">
                Only the above pays. The ranking bonus for where your team finishes the session does
                not.
            </p>
            <p class="text-center"><strong>Prices:</strong></p>
            <p>
                A price is what a player is expected to score, scaled by how likely they are to turn
                up — it is not a rating. Prices run in half-million steps and are set against the
                pool that has signed up, so the best player available is always the most expensive.
                A player with too little history to judge is marked
                <em>provisional</em>: their price leans on their rating until they have played
                enough.
            </p>
        </div>
    </AccordionItem>
</Accordion>

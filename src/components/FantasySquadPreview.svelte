<script>
    import TeamFormation from './TeamFormation.svelte';

    /**
     * A fantasy squad on the pitch. Shared by the leaderboard's modal and the pick screen,
     * which shows it inline, so the two views cannot drift apart.
     *
     * Like FantasyTeamModal this loads nothing of its own — the squad, its prices and its
     * points all come from one /api/fantasy payload the caller already holds.
     * `slots` keeps the pitch at a full squad while it is being picked: the unfilled places
     * are drawn as empty slots rather than a smaller pitch, so nothing on the page moves as
     * players go in and out. `onselect` and `onremove` make those tiles the way the squad is
     * edited; without them the preview is read-only, which is what the leaderboard wants.
     * `captain` badges the pick whose points count twice, and `oncaptain` lets the badge be
     * moved. `withdrawnPlayers` names the picks who have left the session: the pitch draws
     * them in the accent colour with a `Withdrawn` marker where their price and points were.
     * @typedef {{name: string, avatar?: string | null, elo?: number | null}} SquadPlayer
     * @type {{
     *   players?: SquadPlayer[],
     *   playerStats?: Record<string, {price: number, points: number}>,
     *   cost?: number | null,
     *   points?: number | null,
     *   withdrawnPlayers?: string[],
     *   showTotals?: boolean,
     *   slots?: number,
     *   captain?: string | null,
     *   onselect?: (playerName: string | null) => void,
     *   onremove?: (playerName: string) => void,
     *   oncaptain?: (playerName: string) => void
     * }}
     */
    let {
        players = [],
        playerStats = {},
        cost = null,
        points = null,
        withdrawnPlayers = [],
        showTotals = true,
        slots = 0,
        captain = null,
        onselect = undefined,
        onremove = undefined,
        oncaptain = undefined
    } = $props();

    let slotted = $derived(
        players.length >= slots
            ? players
            : [
                  ...players,
                  ...Array.from({ length: slots - players.length }, () => ({
                      name: '',
                      avatar: null,
                      elo: null
                  }))
              ]
    );

    // The captain's points count twice in the squad's total, so the tile shows what the
    // pick actually contributed — otherwise the numbers on the pitch do not add up to the
    // one above it. An unsettled session has nothing to double.
    let tileStats = $derived.by(() => {
        const captainStat = captain ? playerStats[captain] : null;
        if (!captainStat || captainStat.points === null || captainStat.points === undefined) {
            return playerStats;
        }
        return {
            ...playerStats,
            [captain]: { ...captainStat, points: Math.round(captainStat.points * 200) / 100 }
        };
    });

    // A fantasy squad has no colour or crest of its own, so the formation renders neutral.
    // Price and points are the only two numbers it has, and the units name them, so they
    // read as one line under each player rather than a labelled panel beside them.
    const statDefs = [
        { key: 'price', label: 'price', prefix: '$', suffix: 'm' },
        { key: 'points', label: 'pts', suffix: 'pts' }
    ];

    /** @param {number | null | undefined} value */
    const money = (value) => (value === null || value === undefined ? '—' : `$${value}m`);
    /** @param {number | null | undefined} value */
    const scored = (value) => (value === null || value === undefined ? '—' : `${value}pts`);
</script>

{#if slotted.length}
    {#if showTotals}
        <div class="mb-2 flex items-center justify-center gap-2 text-sm font-bold">
            <span>{money(cost)}</span>
            <span class="font-normal text-gray-300 dark:text-gray-600">|</span>
            <span>{scored(points)}</span>
        </div>
    {/if}
    <!-- Picked, then withdrew from the session. The pitch marks them where they stand:
         they cost nothing and score nothing, which is why a squad's total can look light. -->
    <TeamFormation
        players={slotted}
        playerStats={tileStats}
        {statDefs}
        {captain}
        {withdrawnPlayers}
        {onselect}
        {onremove}
        {oncaptain}
        statsLayout="inline"
        teamColor="default" />
{:else}
    <div class="p-4 text-center text-gray-500">No players picked yet</div>
{/if}

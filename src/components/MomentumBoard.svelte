<script>
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import {
        Table,
        TableBody,
        TableBodyCell,
        TableBodyRow,
        TableHead,
        TableHeadCell,
        Toggle,
        Tooltip
    } from 'flowbite-svelte';
    import {
        AngleDownOutline,
        AngleUpOutline,
        FireSolid,
        MinusOutline,
        QuestionCircleOutline,
        StarSolid
    } from 'flowbite-svelte-icons';
    import CrownIcon from '$components/Icons/CrownIcon.svelte';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import WoodenSpoonIcon from '$components/Icons/WoodenSpoonIcon.svelte';
    import SoccerBootIcon from '$components/Icons/SoccerBootIcon.svelte';
    import BullseyeIcon from '$components/Icons/BullseyeIcon.svelte';
    import ShieldIcon from '$components/Icons/ShieldIcon.svelte';
    import GloveIcon from '$components/Icons/GloveIcon.svelte';
    import SnowflakeIcon from '$components/Icons/SnowflakeIcon.svelte';

    /**
     * @typedef {Object} MomentumEntry
     * @property {string} playerName
     * @property {number} value - signed momentum, -1 (cold) to 1 (hot)
     * @property {number} sessions
     * @property {boolean} provisional
     * @property {Array<{type: string, count: number}>} [badges] - ballers: per-award streaks
     * @property {Array<{league: boolean, cup: boolean}>} [trophyStreak] - champions: per-session run
     * @property {number} [woodenSpoonStreak] - champions: trailing last-place run
     * @property {Array<{date: string, value: number}>} [series] - per-session momentum trace
     */

    /**
     * @type {{ entries: MomentumEntry[], variant: 'champions'|'ballers' }}
     */
    let { entries = [], variant = 'champions' } = $props();

    let regularsOnly = $state(true);

    // Render the literal run up to this length, then collapse to "icon ×N".
    const STREAK_CAP = 6;

    /** @param {number} n */
    const range = (n) => Array.from({ length: n }, (_, i) => i);

    // Champions trophies, matching the rank progression chart's icon language.
    const LEAGUE = { icon: CrownIcon, color: 'text-yellow-500', label: 'League win' };
    const CUP = { icon: TrophyIcon, color: 'text-amber-600', label: 'Cup win' };

    // Ballers award streak icons mirror the Stars of the Day conventions.
    /** @type {Record<string, {icon: import('svelte').Component<any>, color: string, label: string}>} */
    const badgeMeta = {
        mvp: { icon: StarSolid, color: 'text-yellow-400', label: 'MVP streak' },
        goldenBoot: { icon: SoccerBootIcon, color: 'text-yellow-400', label: 'Golden Boot streak' },
        playmaker: { icon: BullseyeIcon, color: 'text-yellow-400', label: 'Playmaker streak' },
        brickWall: { icon: ShieldIcon, color: 'text-yellow-400', label: 'Brick Wall streak' },
        goldenGlove: { icon: GloveIcon, color: 'text-yellow-400', label: 'Golden Glove streak' }
    };

    // Form (the heat level) is shown as a row of flames (hot) or snowflakes
    // (cold), one icon per 20th percentile of magnitude (so 1-5 icons). Purely
    // presentational - the momentum value is computed server-side.
    const FORM_ICON_STEPS = 5;

    // Session-over-session change in (uncooled) momentum. Moves smaller than the
    // deadband read as "consistent"; moves past the strong threshold are the
    // standout movers/slumpers (~top fifth on real data) and get a louder label.
    const SWING_DEADBAND = 0.05;
    const SWING_STRONG = 0.3;

    /**
     * A "regular" has at least 2 observed sessions in the last 2 months,
     * mirroring the Rankings page's active-player filter.
     * @param {MomentumEntry} entry
     */
    function isRegular(entry) {
        const ref = new Date();
        const cutoff = new Date(ref.getFullYear(), ref.getMonth() - 2, ref.getDate());
        const recent = (entry.series ?? []).filter((point) => new Date(point.date) >= cutoff);
        return recent.length >= 2;
    }

    // Session-over-session swing: the change between the player's last two
    // (uncooled) series points. This is the "which way are they moving" signal
    // shown alongside the heat level, distinct from it (a player can be cold
    // overall yet swinging up after a strong session).
    /** @param {MomentumEntry} entry */
    function swingOf(entry) {
        const s = entry.series ?? [];
        if (s.length < 2) return 0;
        return s[s.length - 1].value - s[s.length - 2].value;
    }

    // Provisional (<5 sessions) players are always hidden so form is a meaningful
    // signal; the toggle additionally narrows to recent regulars. Hottest form
    // (heat level) sorts to the top.
    let visibleEntries = $derived(
        entries
            .filter((entry) => !entry.provisional)
            .filter((entry) => !regularsOnly || isRegular(entry))
            .toSorted((a, b) => b.value - a.value)
    );

    let hotCount = $derived(visibleEntries.filter((e) => e.value >= 0.1).length);
    let coldCount = $derived(visibleEntries.filter((e) => e.value <= -0.1).length);

    /**
     * Number of flame/snowflake icons for a momentum magnitude: one per 20th
     * percentile, so |value| 0.1-1.0 maps to 1-5 icons.
     * @param {number} value
     */
    function iconCount(value) {
        return Math.min(Math.ceil(Math.abs(value) * FORM_ICON_STEPS), FORM_ICON_STEPS);
    }

    /** Signed percentage, e.g. +34% / -12%. @param {number} swing */
    function formatSwing(swing) {
        const pct = Math.round(swing * 100);
        return `${pct > 0 ? '+' : ''}${pct}%`;
    }

    /** @param {string} playerName */
    function handlePlayerClick(playerName) {
        goto(resolve(`/rankings/${playerName}`, {}));
    }
</script>

<!-- Form (heat level) as flames (hot) or snowflakes (cold); one lit icon per
     20th percentile, the rest ghosted. Neutral (|value| < 0.1) is fully ghosted. -->
{#snippet formIcons(/** @type {number} */ value)}
    {@const ghost = 'text-gray-300 dark:text-gray-600'}
    {@const hot = value >= 0}
    {@const lit = Math.abs(value) >= 0.1 ? iconCount(value) : 0}
    {@const Icon = hot ? FireSolid : SnowflakeIcon}
    {@const litColor = hot ? 'text-orange-500' : 'text-blue-500'}
    {@const mood = lit === 0 ? 'Neutral' : hot ? 'Hot form' : 'Cold form'}
    <span
        class="flex items-center gap-0.5"
        title="{mood} ({Math.round(value * 100)}%)">
        {#each range(FORM_ICON_STEPS) as i (i)}
            <Icon class="h-4 w-4 shrink-0 {i < lit ? litColor : ghost}" />
        {/each}
    </span>
{/snippet}

<!-- Session-over-session direction: a coloured angle + label. Up/green = improved
     on last session, down/red = dropped, steady = held within the deadband. This
     is what explains a cold-but-rising (or hot-but-fading) player at a glance.
     The signed delta stays in the tooltip for anyone who wants the number. -->
{#snippet deltaTrend(/** @type {number} */ swing)}
    {@const up = swing >= SWING_DEADBAND}
    {@const down = swing <= -SWING_DEADBAND}
    {@const strong = Math.abs(swing) >= SWING_STRONG}
    {@const color = up
        ? 'text-green-600 dark:text-green-500'
        : down
          ? 'text-red-600 dark:text-red-500'
          : 'text-gray-400 dark:text-gray-500'}
    {@const label = up
        ? strong
            ? 'Surging'
            : 'Heating up'
        : down
          ? strong
              ? 'Slumping'
              : 'Cooling off'
          : 'Consistent'}
    <span
        class="flex items-center justify-end gap-0.5 whitespace-nowrap {color} {strong
            ? 'font-bold'
            : ''}"
        title="{label} ({formatSwing(swing)} on last session)">
        {#if up}
            <AngleUpOutline class="h-4 w-4 shrink-0" />
        {:else if down}
            <AngleDownOutline class="h-4 w-4 shrink-0" />
        {:else}
            <MinusOutline class="h-4 w-4 shrink-0" />
        {/if}
        <span class="text-sm">{label}</span>
    </span>
{/snippet}

<!-- A homogeneous streak: literal icons up to STREAK_CAP, then "icon ×N". -->
{#snippet iconRun(
    /** @type {import('svelte').Component<any>} */ Icon,
    /** @type {string} */ colorClass,
    /** @type {number} */ count,
    /** @type {string} */ label
)}
    {#if count <= STREAK_CAP}
        <span
            class="flex w-max items-center gap-1 {colorClass}"
            title="{label}: {count} sessions">
            {#each range(count) as i (i)}
                <Icon class="h-4 w-4 shrink-0" />
            {/each}
        </span>
    {:else}
        <span
            class="flex w-max items-center gap-1.5 {colorClass}"
            title="{label}: {count} sessions">
            <Icon class="h-4 w-4 shrink-0" />
            <span class="text-[10px] font-bold">×{count}</span>
        </span>
    {/if}
{/snippet}

<!-- Champions silverware run: one column per session, doubles stacked. -->
{#snippet trophyColumns(/** @type {Array<{league: boolean, cup: boolean}>} */ streak)}
    <span class="flex w-max items-center gap-1">
        {#each streak as session, i (i)}
            <span
                class="flex shrink-0 flex-col items-center gap-0.5"
                title={session.league && session.cup
                    ? 'League & cup double'
                    : session.league
                      ? 'League win'
                      : 'Cup win'}>
                {#if session.league}
                    <CrownIcon class="h-4 w-4 shrink-0 {LEAGUE.color}" />
                {/if}
                {#if session.cup}
                    <TrophyIcon class="h-4 w-4 shrink-0 {CUP.color}" />
                {/if}
            </span>
        {/each}
    </span>
{/snippet}

<!-- Champions fallback for long runs: per-type counts, keeping crown/cup apart. -->
{#snippet trophySummary(/** @type {Array<{league: boolean, cup: boolean}>} */ streak)}
    {@const leagueWins = streak.filter((s) => s.league).length}
    {@const cupWins = streak.filter((s) => s.cup).length}
    <span class="flex w-max items-center gap-2">
        {#if leagueWins}
            <span
                class="flex items-center gap-1 {LEAGUE.color}"
                title="League wins: {leagueWins}">
                <CrownIcon class="h-4 w-4 shrink-0" />
                <span class="text-[10px] font-bold">×{leagueWins}</span>
            </span>
        {/if}
        {#if cupWins}
            <span
                class="flex items-center gap-1 {CUP.color}"
                title="Cup wins: {cupWins}">
                <TrophyIcon class="h-4 w-4 shrink-0" />
                <span class="text-[10px] font-bold">×{cupWins}</span>
            </span>
        {/if}
    </span>
{/snippet}

{#if entries.length === 0}
    <p class="py-8 text-center text-gray-500">No form data yet.</p>
{:else}
    <div class="mb-2 flex items-center gap-1">
        <Toggle
            bind:checked={regularsOnly}
            class="text-sm">
            Regular players only
        </Toggle>
        <QuestionCircleOutline
            class="h-4 w-4 cursor-help text-gray-400 hover:text-gray-600"
            id="form-regulars-help" />
        <Tooltip
            triggeredBy="#form-regulars-help"
            class="text-xs">
            2+ sessions in the last 2 months
        </Tooltip>
    </div>
    {#if visibleEntries.length === 0}
        <p class="py-8 text-center text-gray-500">
            No regular players in form yet — toggle off to see everyone.
        </p>
    {:else}
        <div class="mb-2 flex items-center justify-between text-xs text-gray-400">
            <span>{hotCount} hot · {coldCount} cold</span>
            <span class="flex items-center gap-2">
                <span class="flex items-center gap-1">
                    <span class="inline-block h-2 w-2 rounded-full bg-orange-500"></span> hot
                </span>
                <span class="flex items-center gap-1">
                    <span class="inline-block h-2 w-2 rounded-full bg-blue-500"></span> cold
                </span>
            </span>
        </div>
        <Table
            classes={{ div: 'w-full' }}
            class="w-full dark:text-gray-300">
            <TableHead class="dark:text-gray-300">
                <TableHeadCell class="w-6 px-1 py-1.5 text-center">#</TableHeadCell>
                <TableHeadCell class="w-1/4 px-1 py-1.5 font-bold text-gray-900 dark:text-gray-100"
                    >Player</TableHeadCell>
                <TableHeadCell class="w-1/4 px-1 py-1.5 text-left">Streak</TableHeadCell>
                <TableHeadCell class="w-1/4 px-1 py-1.5 text-left">Form</TableHeadCell>
                <TableHeadCell class="w-1/4 px-1 py-1.5 text-right">Trend</TableHeadCell>
            </TableHead>
            <TableBody>
                {#each visibleEntries as entry, index (entry.playerName)}
                    <TableBodyRow>
                        <TableBodyCell class="w-6 px-1 py-1.5 text-center">
                            {index + 1}
                        </TableBodyCell>
                        <TableBodyCell class="w-1/4 px-1 py-1.5">
                            <span
                                class="block w-full cursor-pointer truncate font-semibold text-gray-900 hover:underline dark:text-gray-100"
                                role="button"
                                tabindex="0"
                                onclick={() => handlePlayerClick(entry.playerName)}
                                onkeydown={() => handlePlayerClick(entry.playerName)}>
                                {entry.playerName}
                            </span>
                        </TableBodyCell>
                        <TableBodyCell class="w-1/4 px-1 py-1.5">
                            {#if variant === 'champions'}
                                {#if entry.trophyStreak && entry.trophyStreak.length >= 2}
                                    {#if entry.trophyStreak.length <= STREAK_CAP}
                                        {@render trophyColumns(entry.trophyStreak)}
                                    {:else}
                                        {@render trophySummary(entry.trophyStreak)}
                                    {/if}
                                {:else if entry.woodenSpoonStreak && entry.woodenSpoonStreak >= 2}
                                    {@render iconRun(
                                        WoodenSpoonIcon,
                                        'text-amber-800',
                                        entry.woodenSpoonStreak,
                                        'Wooden spoon streak'
                                    )}
                                {/if}
                            {:else}
                                <span class="flex flex-col gap-0.5">
                                    {#each entry.badges ?? [] as badge (badge.type)}
                                        {@const meta = badgeMeta[badge.type]}
                                        {#if meta}
                                            {@render iconRun(
                                                meta.icon,
                                                meta.color,
                                                badge.count,
                                                meta.label
                                            )}
                                        {/if}
                                    {/each}
                                </span>
                            {/if}
                        </TableBodyCell>
                        <TableBodyCell class="w-1/4 px-1 py-1.5">
                            {@render formIcons(entry.value)}
                        </TableBodyCell>
                        <TableBodyCell class="w-1/4 px-1 py-1.5">
                            {@render deltaTrend(swingOf(entry))}
                        </TableBodyCell>
                    </TableBodyRow>
                {/each}
            </TableBody>
        </Table>
    {/if}
{/if}

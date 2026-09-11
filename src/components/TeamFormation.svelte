<script>
    import Avatar from '$components/avatars/Avatar.svelte';
    import LeagueIcon from '$components/Icons/LeagueIcon.svelte';
    import BullseyeIcon from '$components/Icons/BullseyeIcon.svelte';
    import ShieldIcon from '$components/Icons/ShieldIcon.svelte';
    import GloveIcon from '$components/Icons/GloveIcon.svelte';
    import {
        CloseOutline,
        ExclamationCircleSolid,
        PlusOutline,
        StarSolid
    } from 'flowbite-svelte-icons';
    import { teamStyles } from '$lib/shared/helpers.js';
    import { resolve } from '$app/paths';

    /**
     * The contributions panel: the four raw counters plus a derived total. This is the
     * default; a caller showing something else about a squad (fantasy price and points,
     * say) supplies its own `statDefs` and the matching keys on `playerStats`.
     */
    const CONTRIBUTION_STAT_DEFS = [
        { key: 'goals', label: 'goals', Icon: LeagueIcon },
        { key: 'attack', label: 'attack', Icon: BullseyeIcon },
        { key: 'defence', label: 'defence', Icon: ShieldIcon },
        { key: 'saves', label: 'saves', Icon: GloveIcon },
        { key: 'total', label: 'total', Icon: StarSolid, divider: true }
    ];

    /**
     * Callers supply the four raw counters; the contributions total is derived here.
     *
     * `statsLayout` picks between the labelled panel beside the player (five contribution
     * counters need the room) and a single line under their name, where `prefix`/`suffix`
     * are the only labelling — enough for two stats, and it keeps the pitch legible.
     *
     * A player with no name is an empty slot: a caller picking a squad passes one per
     * unfilled place so the pitch stays the same size while it fills up. `onselect` makes
     * the tiles buttons rather than links to a player's page — the pitch is then how the
     * squad is edited — and `onremove` puts a remove control on the filled ones.
     *
     * `captain` badges one tile with an armband; what that is worth is the caller's rule,
     * not the pitch's. `oncaptain` makes every filled tile's armband a button, so the
     * badge is also how the captain is moved.
     *
     * `withdrawnPlayers` names the players who are no longer in the session: their avatar
     * and name fade back and their stats give way to a `Withdrawn` marker, because a price
     * and a points total are both answers to questions that no longer apply to them. What
     * counts as withdrawn is, again, the caller's rule.
     * @typedef {{ goals: number, attack: number, defence: number, saves: number }} PlayerStat
     * @typedef {{ key: string, label: string, Icon?: any, divider?: boolean, prefix?: string, suffix?: string }} StatDef
     * @type {{
     *   players: Array<{name: string, avatar?: string | null, elo?: number}>,
     *   teamColor?: string,
     *   playerStats?: Record<string, PlayerStat | Record<string, number>>,
     *   statDefs?: StatDef[],
     *   statsLayout?: 'panel' | 'inline',
     *   captain?: string | null,
     *   withdrawnPlayers?: string[],
     *   onselect?: (playerName: string | null) => void,
     *   onremove?: (playerName: string) => void,
     *   oncaptain?: (playerName: string) => void
     * }}
     */
    let {
        players = [],
        teamColor = 'default',
        playerStats = {},
        statDefs = CONTRIBUTION_STAT_DEFS,
        statsLayout = 'panel',
        captain = null,
        withdrawnPlayers = [],
        onselect = undefined,
        onremove = undefined,
        oncaptain = undefined
    } = $props();

    // Geometry shared by the two corner badges. A badge is 20px across; the avatar is 40px
    // below `sm` and 80px above it, so the same 4px offset that grazes the big circle buries
    // half the badge in the small one. The breakpoint pair stands it further out below `sm`,
    // leaving the two circles just touching at either size.
    const BADGE_BASE =
        'absolute z-10 flex h-5 w-5 items-center justify-center rounded-full shadow-md ring-1 -top-3 sm:-top-1';

    // Gold for the armband the squad is wearing, muted for the ones it could wear instead.
    const ARMBAND_BASE = `${BADGE_BASE} -left-3 text-[10px] font-bold sm:-left-1`;

    const REMOVE_BASE = `${BADGE_BASE} bg-primary-600 -right-3 cursor-pointer text-white ring-white/60 sm:-right-1`;

    // Get team color styles
    const colorStyles = $derived(teamStyles[teamColor] || teamStyles.default);

    // Sort players by ELO (highest first)
    const sortedPlayers = $derived.by(() => {
        return [...players].sort((a, b) => {
            const eloA = a.elo || 0;
            const eloB = b.elo || 0;
            return eloB - eloA; // Descending order
        });
    });

    // Calculate formation based on number of players (e.g., 5 players = 1-2-1-1 formation)
    const formation = $derived.by(() => {
        const count = sortedPlayers.length;
        if (count <= 1) return [[sortedPlayers[0]]];
        if (count === 2) return [[sortedPlayers[0]], [sortedPlayers[1]]];
        if (count === 3) return [[sortedPlayers[0]], [sortedPlayers[1]], [sortedPlayers[2]]];
        if (count === 4)
            return [[sortedPlayers[0]], [sortedPlayers[1], sortedPlayers[2]], [sortedPlayers[3]]];
        if (count === 5)
            return [
                [sortedPlayers[0]],
                [sortedPlayers[1], sortedPlayers[2]],
                [sortedPlayers[3]],
                [sortedPlayers[4]]
            ];
        if (count === 6)
            return [
                [sortedPlayers[0]],
                [sortedPlayers[1], sortedPlayers[2]],
                [sortedPlayers[3], sortedPlayers[4]],
                [sortedPlayers[5]]
            ];
        // 7 players: 1-2-2-2
        return [
            [sortedPlayers[0]],
            [sortedPlayers[1], sortedPlayers[2]],
            [sortedPlayers[3], sortedPlayers[4]],
            [sortedPlayers[5], sortedPlayers[6]]
        ];
    });

    // Per-player stats augmented with the contributions total
    const statsWithTotal = $derived.by(() => {
        /** @type {Record<string, Record<string, number>>} */
        const out = {};
        for (const player of players) {
            const stat = player?.name ? playerStats[player.name] : null;
            if (!stat) continue;
            const goals = stat.goals ?? 0;
            const attack = stat.attack ?? 0;
            const defence = stat.defence ?? 0;
            const saves = stat.saves ?? 0;
            out[player.name] = {
                // Caller-supplied keys pass through untouched, so a custom statDefs set
                // reads its own values; the contribution keys stay derived either way.
                ...stat,
                goals,
                attack,
                defence,
                saves,
                total: goals + attack + defence + saves
            };
        }
        return out;
    });

    // Highest value per stat across this team; 0 means there is no leader to highlight
    const statMaxes = $derived.by(() => {
        /** @type {Record<string, number>} */
        const maxes = {};
        const rows = Object.values(statsWithTotal);
        for (const { key } of statDefs) {
            maxes[key] = Math.max(0, ...rows.map((row) => row[key] ?? 0));
        }
        return maxes;
    });
</script>

{#snippet tile(
    /** @type {any} */ player,
    /** @type {string | null} */ avatarUrl,
    /** @type {boolean} */ isEmpty,
    /** @type {boolean} */ isWithdrawn
)}
    {#if isEmpty}
        <!-- A place in the squad that has not been filled. It is drawn at the size of a
             real tile so the pitch does not resize as players are picked. -->
        <div
            class="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-white/60 bg-black/20 drop-shadow-lg drop-shadow-gray-800 sm:h-20 sm:w-20">
            <PlusOutline class="h-5 w-5 text-white/70 sm:h-8 sm:w-8" />
        </div>
        <div
            class="rounded bg-black/30 px-2 py-0.5 text-center drop-shadow-lg drop-shadow-gray-700">
            <div class="text-xs font-semibold text-white/70 sm:text-base">Empty</div>
        </div>
    {:else}
        <!-- A withdrawn pick recedes rather than shouting: they are still shown, because
             the squad was picked with them in it, but faded so the marker below reads as
             the thing that matters about the tile now. -->
        {@const faded = isWithdrawn ? 'opacity-50' : ''}
        <div class="block sm:hidden {faded}">
            <Avatar
                {avatarUrl}
                size="md"
                color={teamColor}
                shadow="lg" />
        </div>
        <div class="hidden sm:block {faded}">
            <Avatar
                {avatarUrl}
                size="lg"
                color={teamColor}
                shadow="lg" />
        </div>
        <div
            class={`rounded px-2 py-0.5 text-center ${colorStyles.header} ${faded} drop-shadow-lg drop-shadow-gray-700`}>
            <div class="text-xs font-semibold sm:text-base">{player?.name}</div>
        </div>
    {/if}
{/snippet}

<div class="relative mx-auto aspect-[2/3] w-full overflow-hidden rounded-xl shadow-lg">
    <!-- Soccer Pitch SVG Background -->
    <svg
        class="absolute inset-0 h-full w-full"
        viewBox="0 0 200 300"
        preserveAspectRatio="xMidYMid meet"
        xmlns="http://www.w3.org/2000/svg">
        <!-- Grass background -->
        <rect
            width="200"
            height="300"
            fill="#2d7a3e" />

        <!-- Pitch lines -->
        <g
            stroke="white"
            stroke-width="1.5"
            fill="none"
            opacity="0.6">
            <!-- Border -->
            <rect
                x="10"
                y="10"
                width="180"
                height="280" />

            <!-- Center line -->
            <line
                x1="10"
                y1="150"
                x2="190"
                y2="150" />

            <!-- Center circle -->
            <circle
                cx="100"
                cy="150"
                r="30" />
            <circle
                cx="100"
                cy="150"
                r="2"
                fill="white" />

            <!-- Penalty areas (large boxes) -->
            <rect
                x="40"
                y="10"
                width="120"
                height="35" />
            <rect
                x="40"
                y="255"
                width="120"
                height="35" />

            <!-- Goal areas (small boxes) -->
            <rect
                x="70"
                y="10"
                width="60"
                height="18" />
            <rect
                x="70"
                y="272"
                width="60"
                height="18" />

            <!-- Penalty spots (between small and big boxes) -->
            <circle
                cx="100"
                cy="33"
                r="2"
                fill="white" />
            <circle
                cx="100"
                cy="267"
                r="2"
                fill="white" />

            <!-- Penalty arcs (aligned with edge of penalty area) -->
            <path d="M 75 45 Q 100 65 125 45" />
            <path d="M 75 255 Q 100 235 125 255" />
        </g>
    </svg>

    <!-- Player Formation Overlay -->
    <div class="absolute inset-0 flex flex-col justify-evenly px-2 py-8">
        {#each formation as line, i (i)}
            <div class="flex items-center justify-around gap-2">
                {#each line as player, j (j)}
                    {@const isEmpty = !player?.name}
                    {@const isCaptain = !isEmpty && player.name === captain}
                    {@const isWithdrawn = !isEmpty && withdrawnPlayers.includes(player.name)}
                    {@const avatarUrl = player?.avatar
                        ? `/api/rankings/${encodeURIComponent(player.name)}/avatar`
                        : null}
                    {@const stats = isEmpty ? null : statsWithTotal[player.name]}
                    <div
                        class="relative {statsLayout === 'inline'
                            ? 'flex flex-col items-center gap-0.5'
                            : 'flex items-start gap-1.5'}">
                        <!-- Avatar + name, in a positioning context of their own so the
                             corner badges below can be hung off the avatar. A tile normally
                             links to the player's page; a caller that is picking a squad
                             takes the click instead, through the overlay below — the avatar
                             renders a button of its own, and one button cannot contain
                             another, which is also why the badges stay outside this. -->
                        <div class="relative flex flex-col items-center gap-1">
                            {#if onselect || isEmpty}
                                {@render tile(player, avatarUrl, isEmpty, isWithdrawn)}
                            {:else}
                                <a
                                    href={resolve(`/rankings/${encodeURIComponent(player?.name)}`)}
                                    class="flex flex-col items-center gap-1">
                                    {@render tile(player, avatarUrl, isEmpty, isWithdrawn)}
                                </a>
                            {/if}

                            {#if !isEmpty && (oncaptain || isCaptain || onremove)}
                                <!-- The badge layer is the avatar's own box, centred on it:
                                     hung off the tile instead, the corners moved with the
                                     name and the stats line and no two tiles agreed on
                                     where a badge lived. Transparent to clicks so the tile
                                     underneath still takes them. -->
                                <div
                                    class="pointer-events-none absolute top-0 left-1/2 h-10 w-10 -translate-x-1/2 sm:h-20 sm:w-20">
                                    {#if oncaptain || isCaptain}
                                        {@const label = isCaptain
                                            ? `${player.name} is captain`
                                            : `Make ${player.name} captain`}
                                        {@const colors = isCaptain
                                            ? 'bg-yellow-400 text-gray-900 ring-white/60'
                                            : 'bg-black/50 text-white/70 ring-white/40'}
                                        {#if oncaptain}
                                            <button
                                                type="button"
                                                class="{ARMBAND_BASE} {colors} pointer-events-auto cursor-pointer"
                                                aria-label={label}
                                                onclick={() => oncaptain(player.name)}>C</button>
                                        {:else}
                                            <div
                                                class="{ARMBAND_BASE} {colors}"
                                                role="img"
                                                aria-label={label}>
                                                C
                                            </div>
                                        {/if}
                                    {/if}

                                    {#if onremove}
                                        <button
                                            type="button"
                                            class="{REMOVE_BASE} pointer-events-auto"
                                            aria-label={`Remove ${player.name}`}
                                            onclick={() => onremove(player.name)}>
                                            <CloseOutline class="h-3 w-3" />
                                        </button>
                                    {/if}
                                </div>
                            {/if}
                        </div>

                        <!-- Stats -->
                        {#if isWithdrawn}
                            <!-- In the stats' place, and shaped like them, so a squad with a
                                 withdrawal is the same pitch with one tile changed. -->
                            <div
                                class="text-primary-500 flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-bold backdrop-blur-sm">
                                <ExclamationCircleSolid
                                    class="h-3 w-3 shrink-0"
                                    aria-hidden="true" />
                                <span>Withdrawn</span>
                            </div>
                        {:else if stats && statsLayout === 'inline'}
                            <div
                                class="flex items-center gap-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-sm">
                                {#each statDefs as { key, prefix, suffix }, index (key)}
                                    {@const val = stats[key]}
                                    {#if index > 0}
                                        <span
                                            class="font-normal text-white/40"
                                            aria-hidden="true">|</span>
                                    {/if}
                                    <!-- Null is "not scored yet", which a 0 would misreport. -->
                                    <span>
                                        {val === null || val === undefined
                                            ? '—'
                                            : `${prefix ?? ''}${val}${suffix ?? ''}`}
                                    </span>
                                {/each}
                            </div>
                        {:else if stats}
                            <div
                                class="flex flex-col gap-0.5 rounded bg-black/50 px-1.5 py-1 text-white backdrop-blur-sm">
                                {#each statDefs as { key, label, Icon, divider, prefix, suffix } (key)}
                                    {@const val = stats[key] ?? 0}
                                    {@const isLeader = val > 0 && val === statMaxes[key]}
                                    <div
                                        class="flex items-center gap-1 {divider
                                            ? 'mt-0.5 border-t border-white/25 pt-1'
                                            : ''}">
                                        {#if Icon}
                                            <Icon
                                                class="h-3 w-3 shrink-0 {isLeader
                                                    ? 'text-yellow-400'
                                                    : 'text-gray-300'}" />
                                        {/if}
                                        <span
                                            class="text-[10px] {isLeader
                                                ? 'text-yellow-400'
                                                : 'text-gray-300'}">{label}</span>
                                        <span
                                            class="ms-auto text-[10px] font-bold {isLeader
                                                ? 'text-yellow-400'
                                                : val === 0
                                                  ? 'text-gray-500'
                                                  : 'text-white'}">
                                            {prefix ?? ''}{val}{suffix ?? ''}
                                        </span>
                                    </div>
                                {/each}
                            </div>
                        {/if}

                        {#if onselect}
                            <button
                                type="button"
                                class="absolute inset-0 cursor-pointer rounded-lg focus:ring-2 focus:ring-white/70 focus:outline-none"
                                aria-label={isEmpty ? 'Pick a player' : `Change ${player.name}`}
                                onclick={() => onselect(isEmpty ? null : player.name)}></button>
                        {/if}
                    </div>
                {/each}
            </div>
        {/each}
    </div>
</div>

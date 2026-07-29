<script>
    import Avatar from '$components/avatars/Avatar.svelte';
    import LeagueIcon from '$components/Icons/LeagueIcon.svelte';
    import BullseyeIcon from '$components/Icons/BullseyeIcon.svelte';
    import ShieldIcon from '$components/Icons/ShieldIcon.svelte';
    import GloveIcon from '$components/Icons/GloveIcon.svelte';
    import { StarSolid } from 'flowbite-svelte-icons';
    import { teamStyles } from '$lib/shared/helpers.js';
    import { resolve } from '$app/paths';

    /**
     * Callers supply the four raw counters; the contributions total is derived here.
     * @typedef {{ goals: number, attack: number, defence: number, saves: number }} PlayerStat
     * @type {{
     *   players: Array<{name: string, avatar?: string | null, elo?: number}>,
     *   teamColor?: string,
     *   playerStats?: Record<string, PlayerStat>
     * }}
     */
    let { players = [], teamColor = 'default', playerStats = {} } = $props();

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

    const statDefs = [
        { key: 'goals', label: 'goals', Icon: LeagueIcon },
        { key: 'attack', label: 'attack', Icon: BullseyeIcon },
        { key: 'defence', label: 'defence', Icon: ShieldIcon },
        { key: 'saves', label: 'saves', Icon: GloveIcon },
        { key: 'total', label: 'total', Icon: StarSolid, divider: true }
    ];

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
                    {@const avatarUrl = player?.avatar
                        ? `/api/rankings/${encodeURIComponent(player.name)}/avatar`
                        : null}
                    {@const stats = player?.name ? statsWithTotal[player.name] : null}
                    <div class="flex items-start gap-1.5">
                        <!-- Avatar + name -->
                        <a
                            href={resolve(`/rankings/${encodeURIComponent(player?.name)}`)}
                            class="flex flex-col items-center gap-1">
                            <div class="block sm:hidden">
                                <Avatar
                                    {avatarUrl}
                                    size="md"
                                    color={teamColor}
                                    shadow="lg" />
                            </div>
                            <div class="hidden sm:block">
                                <Avatar
                                    {avatarUrl}
                                    size="lg"
                                    color={teamColor}
                                    shadow="lg" />
                            </div>
                            <div
                                class={`rounded px-2 py-0.5 text-center ${colorStyles.header} drop-shadow-lg drop-shadow-gray-700`}>
                                <div class="text-xs font-semibold sm:text-base">{player?.name}</div>
                            </div>
                        </a>

                        <!-- Stats panel -->
                        {#if stats}
                            <div
                                class="flex flex-col gap-0.5 rounded bg-black/50 px-1.5 py-1 text-white backdrop-blur-sm">
                                {#each statDefs as { key, label, Icon, divider } (key)}
                                    {@const val = stats[key] ?? 0}
                                    {@const isLeader = val > 0 && val === statMaxes[key]}
                                    <div
                                        class="flex items-center gap-1 {divider
                                            ? 'mt-0.5 border-t border-white/25 pt-1'
                                            : ''}">
                                        <Icon
                                            class="h-3 w-3 shrink-0 {isLeader
                                                ? 'text-yellow-400'
                                                : 'text-gray-300'}" />
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
                                            {val}
                                        </span>
                                    </div>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/each}
    </div>
</div>

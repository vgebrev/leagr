<script>
    import Avatar from '$components/avatars/Avatar.svelte';
    import { teamStyles } from '$lib/shared/helpers.js';

    /**
     * @type {{ players: Array<{name: string, avatar?: string | null, elo?: number}>, teamColor?: string }}
     */
    let { players = [], teamColor = 'default' } = $props();

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
    <div class="absolute inset-0 flex flex-col justify-around px-2 py-4">
        {#each formation as line, i (i)}
            <div class="flex items-center justify-around gap-2">
                {#each line as player, j (j)}
                    {@const avatarUrl = player?.avatar
                        ? `/api/rankings/${encodeURIComponent(player.name)}/avatar`
                        : null}
                    <div class="flex flex-col items-center gap-1">
                        <div class="block sm:hidden">
                            <Avatar
                                {avatarUrl}
                                size="md"
                                color={teamColor} />
                        </div>
                        <div class="hidden sm:block">
                            <Avatar
                                {avatarUrl}
                                size="lg"
                                color={teamColor} />
                        </div>
                        <div class={`rounded px-2 py-0.5 text-center ${colorStyles.header}`}>
                            <div class="text-xs font-semibold sm:text-base">{player?.name}</div>
                        </div>
                    </div>
                {/each}
            </div>
        {/each}
    </div>
</div>

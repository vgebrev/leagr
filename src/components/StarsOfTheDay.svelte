<script>
    import { StarSolid, ChevronRightOutline } from 'flowbite-svelte-icons';
    import { slide } from 'svelte/transition';
    import SoccerBootIcon from '$components/Icons/SoccerBootIcon.svelte';
    import BullseyeIcon from '$components/Icons/BullseyeIcon.svelte';
    import ShieldIcon from '$components/Icons/ShieldIcon.svelte';
    import GloveIcon from '$components/Icons/GloveIcon.svelte';
    import Avatar from '$components/avatars/Avatar.svelte';
    import { teamColours, teamStyles } from '$lib/shared/helpers.js';
    import { RESERVED_SCORER_KEYS } from '$lib/shared/validation.js';

    /** @type {{ leagueGames: any[], knockoutGames: any[], teams: Record<string, any> }} */
    let { leagueGames = [], knockoutGames = [], teams = {} } = $props();

    /**
     * @typedef {Object} PlayerStats
     * @property {string} playerName
     * @property {number} goals
     * @property {number} offensiveActions
     * @property {number} defensiveActions
     * @property {number} saveActions
     * @property {number} mvpScore
     * @property {string | null} teamName
     */

    /**
     * @param {Map<string, PlayerStats>} map
     * @param {string} name
     * @param {string | null} teamName
     */
    function ensurePlayer(map, name, teamName) {
        if (!map.has(name)) {
            map.set(name, {
                playerName: name,
                goals: 0,
                offensiveActions: 0,
                defensiveActions: 0,
                saveActions: 0,
                mvpScore: 0,
                teamName
            });
        } else {
            /** @type {PlayerStats} */ (map.get(name)).teamName = teamName;
        }
    }

    /**
     * @param {Map<string, PlayerStats>} map
     * @param {Record<string, any>} match
     * @param {'home' | 'away'} side
     */
    function processSide(map, match, side) {
        const teamName = match[side] ?? null;

        const scorers = match[`${side}Scorers`];
        if (scorers) {
            for (const [player, count] of Object.entries(scorers)) {
                if (player === RESERVED_SCORER_KEYS?.OWN_GOAL) continue;
                if (typeof count !== 'number' || count <= 0) continue;
                ensurePlayer(map, player, teamName);
                const s = /** @type {PlayerStats} */ (map.get(player));
                s.goals += count;
                s.mvpScore += count;
            }
        }

        const offActions = match[`${side}OffensiveActions`];
        if (offActions) {
            for (const [player, count] of Object.entries(offActions)) {
                if (typeof count !== 'number' || count <= 0) continue;
                ensurePlayer(map, player, teamName);
                const s = /** @type {PlayerStats} */ (map.get(player));
                s.offensiveActions += count;
                s.mvpScore += count;
            }
        }

        const defActions = match[`${side}DefensiveActions`];
        if (defActions) {
            for (const [player, count] of Object.entries(defActions)) {
                if (typeof count !== 'number' || count <= 0) continue;
                ensurePlayer(map, player, teamName);
                const s = /** @type {PlayerStats} */ (map.get(player));
                s.defensiveActions += count;
                s.mvpScore += count;
            }
        }

        const saveActs = match[`${side}SaveActions`];
        if (saveActs) {
            for (const [player, count] of Object.entries(saveActs)) {
                if (typeof count !== 'number' || count <= 0) continue;
                ensurePlayer(map, player, teamName);
                const s = /** @type {PlayerStats} */ (map.get(player));
                s.saveActions += count;
                s.mvpScore += count;
            }
        }
    }

    let allStats = $derived.by(() => {
        /** @type {Map<string, PlayerStats>} */
        const map = new Map();

        if (Array.isArray(leagueGames)) {
            for (const round of leagueGames) {
                if (!Array.isArray(round)) continue;
                for (const match of round) {
                    if (!match || match.bye) continue;
                    processSide(map, match, 'home');
                    processSide(map, match, 'away');
                }
            }
        }

        if (Array.isArray(knockoutGames)) {
            for (const match of knockoutGames) {
                if (!match || match.bye) continue;
                processSide(map, match, 'home');
                processSide(map, match, 'away');
            }
        }

        return map;
    });

    /**
     * @param {(s: PlayerStats) => number} getter
     * @returns {PlayerStats[]}
     */
    function topPlayers(getter) {
        return Array.from(allStats.values())
            .filter((s) => getter(s) > 0)
            .sort((a, b) => getter(b) - getter(a))
            .slice(0, 3);
    }

    let hasAnyStats = $derived(allStats.size > 0);

    /** @type {Record<string, boolean>} */
    let expanded = $state({});

    let awards = $derived([
        {
            label: 'MVP',
            players: topPlayers((s) => s.mvpScore),
            icon: StarSolid,
            stat: (/** @type {PlayerStats} */ s) => s.mvpScore,
            statLabel: 'total contributions'
        },
        {
            label: 'Golden Boot',
            players: topPlayers((s) => s.goals),
            icon: SoccerBootIcon,
            stat: (/** @type {PlayerStats} */ s) => s.goals,
            statLabel: 'goals'
        },
        {
            label: 'Playmaker',
            players: topPlayers((s) => s.offensiveActions),
            icon: BullseyeIcon,
            stat: (/** @type {PlayerStats} */ s) => s.offensiveActions,
            statLabel: 'attack contributions'
        },
        {
            label: 'Brick Wall',
            players: topPlayers((s) => s.defensiveActions),
            icon: ShieldIcon,
            stat: (/** @type {PlayerStats} */ s) => s.defensiveActions,
            statLabel: 'defence contributions'
        },
        {
            label: 'Golden Glove',
            players: topPlayers((s) => s.saveActions),
            icon: GloveIcon,
            stat: (/** @type {PlayerStats} */ s) => s.saveActions,
            statLabel: 'saves'
        }
    ]);

    /**
     * @param {string | null | undefined} teamName
     * @returns {string}
     */
    function getTeamColorClass(teamName) {
        if (!teamName) return '';
        const firstWord = teamName.split(' ')[0].toLowerCase();
        const colour = teamColours.includes(firstWord) ? firstWord : 'blue';
        return /** @type {any} */ (teamStyles)[colour]?.header ?? teamStyles.blue.header;
    }

    /**
     * @param {string | null | undefined} teamName
     * @returns {string}
     */
    function getTeamColor(teamName) {
        if (!teamName) return 'blue';
        const firstWord = teamName.split(' ')[0].toLowerCase();
        return teamColours.includes(firstWord) ? firstWord : 'blue';
    }

    /**
     * @param {string} playerName
     * @returns {string | null}
     */
    function getAvatarUrl(playerName) {
        for (const teamPlayers of Object.values(teams)) {
            if (!Array.isArray(teamPlayers)) continue;
            const player = teamPlayers.find((p) => p?.name === playerName);
            if (player?.avatar) return `/api/rankings/${encodeURIComponent(playerName)}/avatar`;
        }
        return null;
    }
</script>

{#if hasAnyStats}
    <div class="glass mb-2 w-full rounded-lg border border-gray-200 p-2 pt-1 dark:border-gray-700">
        <h3 class="mb-1 text-center text-base font-medium">Stars of the Day</h3>
        <!-- One shared grid across all awards so every player row uses the same column widths -->
        <div
            class="grid grid-cols-[auto_1fr_auto] items-center gap-x-2 border-t border-t-gray-200 dark:border-t-gray-700">
            {#each awards as award, i (i)}
                {@const AwardIcon = award.icon}
                {@const winner = award.players[0]}
                {@const runner = award.players.slice(1)}
                {#if winner}
                    <!-- Divider -->
                    {#if i > 0}
                        <div class="col-span-3 border-t border-gray-100 dark:border-gray-700"></div>
                    {/if}

                    <!-- Title row -->
                    <button
                        class="col-span-3 my-1.5 flex items-center gap-1.5 text-sm font-semibold dark:text-white {runner.length >
                        0
                            ? 'cursor-pointer select-none'
                            : ''}"
                        onclick={() =>
                            runner.length > 0 && (expanded[award.label] = !expanded[award.label])}>
                        <span class="text-yellow-400"><AwardIcon class="h-5 w-5" /></span>
                        {award.label}
                        {#if runner.length > 0}
                            <ChevronRightOutline
                                class="ml-auto h-5 w-5 text-gray-400 transition-transform duration-200 dark:text-gray-500 {expanded[
                                    award.label
                                ]
                                    ? 'rotate-90'
                                    : ''}" />
                        {/if}
                    </button>

                    <!-- Winner row -->
                    <div>
                        <Avatar
                            avatarUrl={getAvatarUrl(winner.playerName)}
                            color={getTeamColor(winner.teamName)}
                            size="sm" />
                    </div>
                    <span
                        class="{getTeamColorClass(
                            winner.teamName
                        )} mb-2 self-center overflow-hidden rounded-sm px-2 py-0.5 text-sm font-medium text-nowrap text-ellipsis shadow transition-opacity hover:opacity-80">
                        {winner.playerName}
                    </span>
                    <span class="mb-2 self-center text-sm text-nowrap dark:text-white">
                        <span class="font-bold">{award.stat(winner)}</span>
                        <span class="font-normal text-gray-500 dark:text-gray-400">
                            {award.statLabel}</span>
                    </span>

                    <!-- Runners-up: col-span-3 subgrid slide wrapper -->
                    {#if runner.length > 0 && expanded[award.label]}
                        <div
                            class="col-span-3 grid grid-cols-subgrid items-center gap-x-2"
                            transition:slide={{ duration: 200 }}>
                            {#each runner as player, i (i)}
                                <div>
                                    <Avatar
                                        avatarUrl={getAvatarUrl(player.playerName)}
                                        color={getTeamColor(player.teamName)}
                                        size="sm" />
                                </div>
                                <span
                                    class="{getTeamColorClass(
                                        player.teamName
                                    )} mb-1 self-center overflow-hidden rounded-sm px-2 py-0.5 text-sm font-medium text-nowrap text-ellipsis shadow transition-opacity hover:opacity-80">
                                    {player.playerName}
                                </span>
                                <span class="mb-1 self-center text-sm text-nowrap dark:text-white">
                                    <span class="font-bold">{award.stat(player)}</span>
                                    <span class="font-normal text-gray-500 dark:text-gray-400">
                                        {award.statLabel}</span>
                                </span>
                            {/each}
                        </div>
                    {/if}
                {/if}
            {/each}
        </div>
    </div>
{/if}

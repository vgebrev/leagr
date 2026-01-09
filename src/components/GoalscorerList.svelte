<script>
    import CrownIcon from '$components/Icons/CrownIcon.svelte';
    import TrophyIcon from '$components/Icons/TrophyIcon.svelte';
    import LeagueIcon from '$components/Icons/LeagueIcon.svelte';
    import Avatar from '$components/avatars/Avatar.svelte';
    import { teamColours, teamStyles } from '$lib/shared/helpers.js';
    import { RESERVED_SCORER_KEYS } from '$lib/shared/validation.js';
    import SoccerBootIcon from '$components/Icons/SoccerBootIcon.svelte';
    import { SvelteMap } from 'svelte/reactivity';

    /**
     * @typedef {Object} GoalscorerStats
     * @property {string} playerName
     * @property {number} totalGoals
     * @property {number} leagueGoals
     * @property {number} cupGoals
     * @property {string | null} teamName - Current team name for color styling
     */

    /** @type {{ leagueGames: Array, knockoutGames: Array, teams: Object, size?: number }} */
    let { leagueGames = [], knockoutGames = [], teams = {}, size = 5 } = $props();

    /**
     * Aggregate goals from all matches
     * @returns {GoalscorerStats[]}
     */
    let topScorers = $derived.by(() => {
        /** @type {SvelteMap<string, GoalscorerStats>} */
        const scorerMap = new SvelteMap();

        // Process league games
        if (leagueGames && Array.isArray(leagueGames)) {
            for (const round of leagueGames) {
                if (!Array.isArray(round)) continue;

                for (const match of round) {
                    if (!match || match.bye) continue;

                    // Process home scorers
                    if (match.homeScorers) {
                        for (const [player, goals] of Object.entries(match.homeScorers)) {
                            if (player === RESERVED_SCORER_KEYS.OWN_GOAL) continue;
                            if (typeof goals !== 'number' || goals <= 0) continue;

                            if (!scorerMap.has(player)) {
                                scorerMap.set(player, {
                                    playerName: player,
                                    totalGoals: 0,
                                    leagueGoals: 0,
                                    cupGoals: 0,
                                    teamName: match.home
                                });
                            }
                            const stats = scorerMap.get(player);
                            if (stats) {
                                stats.leagueGoals += goals;
                                stats.totalGoals += goals;
                                stats.teamName = match.home; // Update to latest team
                            }
                        }
                    }

                    // Process away scorers
                    if (match.awayScorers) {
                        for (const [player, goals] of Object.entries(match.awayScorers)) {
                            if (player === RESERVED_SCORER_KEYS.OWN_GOAL) continue;
                            if (typeof goals !== 'number' || goals <= 0) continue;

                            if (!scorerMap.has(player)) {
                                scorerMap.set(player, {
                                    playerName: player,
                                    totalGoals: 0,
                                    leagueGoals: 0,
                                    cupGoals: 0,
                                    teamName: match.away
                                });
                            }
                            const stats = scorerMap.get(player);
                            if (stats) {
                                stats.leagueGoals += goals;
                                stats.totalGoals += goals;
                                stats.teamName = match.away; // Update to latest team
                            }
                        }
                    }
                }
            }
        }

        // Process knockout games
        if (knockoutGames && Array.isArray(knockoutGames)) {
            for (const match of knockoutGames) {
                if (!match || match.bye) continue;

                // Process home scorers
                if (match.homeScorers) {
                    for (const [player, goals] of Object.entries(match.homeScorers)) {
                        if (player === RESERVED_SCORER_KEYS.OWN_GOAL) continue;
                        if (typeof goals !== 'number' || goals <= 0) continue;

                        if (!scorerMap.has(player)) {
                            scorerMap.set(player, {
                                playerName: player,
                                totalGoals: 0,
                                leagueGoals: 0,
                                cupGoals: 0,
                                teamName: match.home
                            });
                        }
                        const stats = scorerMap.get(player);
                        if (stats) {
                            stats.cupGoals += goals;
                            stats.totalGoals += goals;
                            stats.teamName = match.home; // Update to latest team
                        }
                    }
                }

                // Process away scorers
                if (match.awayScorers) {
                    for (const [player, goals] of Object.entries(match.awayScorers)) {
                        if (player === RESERVED_SCORER_KEYS.OWN_GOAL) continue;
                        if (typeof goals !== 'number' || goals <= 0) continue;

                        if (!scorerMap.has(player)) {
                            scorerMap.set(player, {
                                playerName: player,
                                totalGoals: 0,
                                leagueGoals: 0,
                                cupGoals: 0,
                                teamName: match.away
                            });
                        }
                        const stats = scorerMap.get(player);
                        if (stats) {
                            stats.cupGoals += goals;
                            stats.totalGoals += goals;
                            stats.teamName = match.away; // Update to latest team
                        }
                    }
                }
            }
        }

        // Convert to array and sort by: total goals (desc), league goals (desc), cup goals (desc)
        const scorers = Array.from(scorerMap.values()).sort((a, b) => {
            if (b.totalGoals !== a.totalGoals) return b.totalGoals - a.totalGoals;
            if (b.leagueGoals !== a.leagueGoals) return b.leagueGoals - a.leagueGoals;
            return b.cupGoals - a.cupGoals;
        });

        // Return top N
        return scorers.slice(0, size);
    });

    /**
     * Get team color class for player name
     * @param {string | null} teamName
     * @returns {string}
     */
    function getTeamColorClass(teamName) {
        if (!teamName) return '';
        const firstWord = teamName.split(' ')[0].toLowerCase();
        const teamColour = teamColours.includes(firstWord) ? firstWord : 'blue';
        const styles = /** @type {any} */ (teamStyles)[teamColour] || teamStyles.blue;
        return styles.header;
    }

    function getTeamColor(teamName) {
        if (!teamName) return '';
        const firstWord = teamName.split(' ')[0].toLowerCase();
        return teamColours.includes(firstWord) ? firstWord : 'blue';
    }
    /**
     * Get avatar URL for a player
     * @param {string} playerName
     * @returns {string | null}
     */
    function getPlayerAvatarUrl(playerName) {
        // Search through all teams to find the player and check if they have an avatar
        for (const teamPlayers of Object.values(teams)) {
            if (!Array.isArray(teamPlayers)) continue;
            const player = teamPlayers.find((p) => p?.name === playerName);
            if (player && player.avatar) {
                return `/api/rankings/${encodeURIComponent(playerName)}/avatar`;
            }
        }
        return null;
    }
</script>

{#if topScorers.length > 0}
    <div class="glass mb-2 w-full rounded-lg border border-gray-200 p-2 pt-1 dark:border-gray-700">
        <h3 class="mb-1 text-center font-semibold">Golden Boot</h3>
        <div class="border-t border-t-gray-200 pt-2 dark:border-t-gray-700">
            {#each topScorers as scorer, index (scorer.playerName)}
                <div class="flex items-center gap-3">
                    <!-- Golden boot for #1 -->
                    {#if index === 0}
                        <div class="text-yellow-400">
                            <SoccerBootIcon class="h-5 w-5" />
                        </div>
                    {:else}
                        <div class="h-5 w-5"></div>
                    {/if}

                    <!-- Player avatar -->
                    <div class="mt-1 shrink-0">
                        <Avatar
                            avatarUrl={getPlayerAvatarUrl(scorer.playerName)}
                            color={getTeamColor(scorer.teamName)}
                            size="xs" />
                    </div>

                    <!-- Player name with team color -->
                    <span
                        class="flex-1 font-medium {getTeamColorClass(
                            scorer.teamName
                        )} overflow-hidden rounded-sm px-2 py-0.5 text-start text-sm font-medium text-nowrap overflow-ellipsis shadow transition-opacity hover:opacity-80">
                        {scorer.playerName}
                    </span>

                    <!-- Goals stats -->
                    <div class="flex items-center gap-2">
                        <!-- Total goals -->
                        <div class="flex items-center gap-1">
                            <LeagueIcon
                                icon="soccer"
                                class="h-4 w-4" />
                            <span class="font-bold">{scorer.totalGoals}</span>
                        </div>

                        <!-- League + Cup breakdown -->
                        <span class="text-sm text-gray-400 dark:text-gray-500">
                            (
                            <span class="inline-flex items-center gap-1">
                                <CrownIcon class="h-3 w-3" />
                                {scorer.leagueGoals}
                            </span>

                            {#if scorer.leagueGoals > 0}<span class="mx-1">|</span>{/if}
                            <span class="inline-flex items-center gap-1">
                                <TrophyIcon class="h-3 w-3" />
                                {scorer.cupGoals}
                            </span>

                            )
                        </span>
                    </div>
                </div>
            {/each}
        </div>
    </div>
{/if}

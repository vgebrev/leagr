<script>
    import { Modal, Spinner } from 'flowbite-svelte';
    import TeamFormation from './TeamFormation.svelte';
    import TeamBadge from './TeamBadge.svelte';
    import { api } from '$lib/client/services/api-client.svelte.js';
    import { withLoading } from '$lib/client/stores/loading.js';
    import { setNotification } from '$lib/client/stores/notification.js';
    import TeamLogo from './TeamLogo.svelte';
    import { RESERVED_SCORER_KEYS } from '$lib/shared/validation.js';
    import { scale } from 'svelte/transition';

    /**
     * @type {{ teamName: string | null, date: string | null, open: boolean }}
     */
    let { teamName = $bindable(null), date = null, open = $bindable(false) } = $props();

    let teamPlayers = $state([]);
    let loadingError = $state(false);

    /** @type {{ rounds: any[], knockoutBracket: any[] }} */
    let gamesData = $state({ rounds: [], knockoutBracket: [] });

    // Extract team color from team name for avatar colors
    let teamColor = $derived(teamName?.split(' ')[0].toLowerCase() || 'default');

    /**
     * Accumulate per-player action counts from a match side into a stats map.
     * @param {Record<string, {goals: number, attack: number, defence: number, saves: number}>} stats
     * @param {Record<string, any>} match
     * @param {'home' | 'away'} side
     */
    function processSide(stats, match, side) {
        const scorers = match[`${side}Scorers`];
        if (scorers) {
            for (const [player, count] of Object.entries(scorers)) {
                if (player === RESERVED_SCORER_KEYS?.OWN_GOAL) continue;
                if (player === RESERVED_SCORER_KEYS?.UNASSIGNED) continue;
                if (typeof count !== 'number' || count <= 0) continue;
                if (!stats[player]) stats[player] = { goals: 0, attack: 0, defence: 0, saves: 0 };
                stats[player].goals += count;
            }
        }
        const offActions = match[`${side}OffensiveActions`];
        if (offActions) {
            for (const [player, count] of Object.entries(offActions)) {
                if (typeof count !== 'number' || count <= 0) continue;
                if (!stats[player]) stats[player] = { goals: 0, attack: 0, defence: 0, saves: 0 };
                stats[player].attack += count;
            }
        }
        const defActions = match[`${side}DefensiveActions`];
        if (defActions) {
            for (const [player, count] of Object.entries(defActions)) {
                if (typeof count !== 'number' || count <= 0) continue;
                if (!stats[player]) stats[player] = { goals: 0, attack: 0, defence: 0, saves: 0 };
                stats[player].defence += count;
            }
        }
        const saveActs = match[`${side}SaveActions`];
        if (saveActs) {
            for (const [player, count] of Object.entries(saveActs)) {
                if (typeof count !== 'number' || count <= 0) continue;
                if (!stats[player]) stats[player] = { goals: 0, attack: 0, defence: 0, saves: 0 };
                stats[player].saves += count;
            }
        }
    }

    /** Per-player session contribution stats derived from games data */
    let playerStats = $derived.by(() => {
        /** @type {Record<string, {goals: number, attack: number, defence: number, saves: number}>} */
        const stats = {};

        for (const round of gamesData.rounds) {
            if (!Array.isArray(round)) continue;
            for (const match of round) {
                if (!match || match.bye) continue;
                processSide(stats, match, 'home');
                processSide(stats, match, 'away');
            }
        }

        for (const match of gamesData.knockoutBracket) {
            if (!match || match.bye) continue;
            processSide(stats, match, 'home');
            processSide(stats, match, 'away');
        }

        return stats;
    });

    /**
     * Load team players with their avatars and ELO, and session game data.
     */
    async function loadTeamData() {
        if (!teamName || !date) {
            setNotification('Team name and date are required', 'error');
            return;
        }

        loadingError = false;
        teamPlayers = [];
        gamesData = { rounds: [], knockoutBracket: [] };

        await withLoading(
            async () => {
                const [teamResponse, gamesResponse] = await Promise.all([
                    api.get(`teams?date=${date}&teamName=${encodeURIComponent(teamName)}`),
                    api.get(`games?date=${date}`)
                ]);

                const teams = teamResponse.teams || {};
                const players = teams[teamName] || [];
                teamPlayers = players
                    .filter((player) => player !== null)
                    .map((player) => ({
                        name: player.name,
                        avatar: player.avatar || null,
                        elo: player.elo || null
                    }));

                gamesData = {
                    rounds: gamesResponse.rounds || [],
                    knockoutBracket: gamesResponse['knockout-games']?.bracket || []
                };
            },
            (err) => {
                console.error('Error loading team data:', err);
                loadingError = true;
                setNotification(
                    err.message || 'Failed to load team data. Please try again.',
                    'error'
                );
            }
        );
    }

    /**
     * Load team data when modal opens or teamName/date changes
     * Reset data when modal closes
     */
    $effect(() => {
        if (open && teamName && date) {
            loadTeamData();
        } else if (!open) {
            teamPlayers = [];
            loadingError = false;
            gamesData = { rounds: [], knockoutBracket: [] };
        }
    });
</script>

<Modal
    transition={scale}
    bind:open
    size="md"
    class="glass-strong max-w-md border backdrop:backdrop-blur-xs"
    classes={{ body: 'p-2', close: 'p-0' }}>
    {#snippet header()}
        {#if teamName && date}
            <div class="flex w-full items-center justify-center gap-3">
                <TeamLogo
                    {teamName}
                    {date}
                    size={64}
                    className="size-16 shrink-0" />
                <TeamBadge
                    {teamName}
                    className="text-lg px-3 py-1" />
            </div>
        {:else if teamName}
            <div class="flex w-full items-center justify-center">
                <TeamBadge
                    {teamName}
                    className="text-lg px-3 py-1" />
            </div>
        {:else}
            <div class="p-4 text-center text-lg font-semibold uppercase">Team Formation</div>
        {/if}
    {/snippet}

    {#if !teamPlayers.length && !loadingError}
        <div class="flex items-center justify-center gap-2 p-4">
            <Spinner size="6" />
            <div class="text-gray-500">Loading team...</div>
        </div>
    {:else if loadingError}
        <div class="p-4 text-center text-red-500">Failed to load team data</div>
    {:else if teamPlayers.length}
        <TeamFormation
            players={teamPlayers}
            {teamColor}
            {playerStats} />
    {:else}
        <div class="p-4 text-center text-gray-500">No players in this team</div>
    {/if}
</Modal>

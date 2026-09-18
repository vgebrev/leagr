import { api } from '$lib/client/services/api-client.svelte.js';
import { playersService } from '$lib/client/services/players.svelte.js';
import { setNotification } from '$lib/client/stores/notification.js';
import { withLoading } from '$lib/client/stores/loading.js';
import { settings } from '$lib/client/stores/settings.js';
import { isCompetitionEnded, errorMessage, errorStatus } from '$lib/shared/helpers.js';
import { defaultSettings } from '$lib/shared/defaults.js';
import { sessionUnlock } from '$lib/client/services/sessionUnlock.svelte.js';

class TeamsService {
    /** @type {ConsolidatedSettings} */
    #settings = $state(defaultSettings);

    // State
    /** @type {EnhancedTeamsData} */
    teams = $state({});

    /** @type {string | null} */
    currentDate = $state(null);

    /** @type {LeagueInfo | null} */
    leagueInfo = $state(null);

    /** @type {DrawHistoryData | null} */
    drawHistory = $state(null);

    /** @type {PlayerWithElo[]} Enhanced waiting list players with ELO data */
    waitingListWithElo = $state([]);

    /** @type {PlayerWithElo[]} Enhanced available players with ELO data */
    availablePlayersWithElo = $state([]);

    /** @type {boolean} */
    hasExistingTeams = $derived(Object.keys(this.teams).length > 0);

    /** @type {{available: number, eligible: number, excess: number, waitingList: number}} */
    playerSummary = $derived.by(() => {
        const players = playersService.players;
        const waitingList = playersService.waitingList;
        const dayOverride = this.currentDate ? this.#settings[this.currentDate] : null;
        const playerLimit = dayOverride?.playerLimit || this.#settings.playerLimit;

        return {
            available: players.length,
            eligible: Math.min(players.length, playerLimit),
            excess: Math.max(0, players.length - playerLimit),
            waitingList: waitingList.length
        };
    });

    /** @type {boolean} */
    isCompetitionEnded = $derived.by(() => {
        if (!this.currentDate) return false;
        return isCompetitionEnded(this.currentDate, this.#settings);
    });

    teamConfig = $derived.by(() => {
        return this.#teamConfigurations || [];
    });

    /** @type {TeamConfig[]} */
    #teamConfigurations = $state([]);

    /** @type {boolean} */
    canGenerateTeams = $derived.by(() => {
        return (
            !this.isLocked() &&
            playersService.canModifyList &&
            (this.#settings.canRegenerateTeams || Object.keys(this.teams).length === 0)
        );
    });

    /** @type {PlayerWithElo[]} */
    unassignedPlayersWithElo = $derived.by(() => {
        // A roster slot holds an enriched player object, or null for an empty slot, so
        // the comparison against the available list has to go through the name.
        const assignedPlayerNames = Object.values(this.teams)
            .flat()
            .filter((player) => player !== null)
            .map((player) => player.name);

        // Return enhanced available players not assigned to any team
        return this.availablePlayersWithElo.filter(
            (playerObj) => !assignedPlayerNames.includes(playerObj.name)
        );
    });

    /** @type {string[]} Legacy unassigned players for backward compatibility */
    unassignedPlayers = $derived.by(() => {
        return this.unassignedPlayersWithElo.map((p) => p.name);
    });

    constructor() {
        settings.subscribe((settings) => {
            this.#settings = settings;
        });
    }

    /**
     * Competition-end lock, honouring an admin session unlock.
     * Deliberately a method rather than a $derived: the service tests stub
     * `isCompetitionEnded` with Object.defineProperty, which a memoised derived
     * would not observe.
     * @returns {boolean}
     */
    isLocked() {
        return this.isCompetitionEnded && !sessionUnlock.isUnlocked(this.currentDate);
    }

    // Methods
    /**
     * Load team configurations from the server
     */
    async loadTeamConfigurations() {
        if (!this.currentDate) return;

        await withLoading(
            async () => {
                const configurations = await api.get('teams/configurations', this.currentDate);
                this.#teamConfigurations = configurations.configurations || [];
            },
            (err) => {
                console.error('Error loading team configurations:', err);
                setNotification(
                    errorMessage(err) || 'Failed to load team configurations. Please try again.',
                    'error'
                );
                this.#teamConfigurations = [];
            }
        );
    }

    /**
     * Generate teams using the selected configuration
     * @param {{teams?: number, teamSizes?: number[]}} options - Configuration object containing team options
     */
    async generateTeams(options) {
        if (this.isLocked() || !playersService.canModifyList) {
            setNotification('Teams cannot be changed.', 'warning');
            return false;
        }

        if (!options) {
            setNotification('Please choose a team option.', 'warning');
            return false;
        }

        const restoreTeams = { ...this.teams };
        let success = false;

        await withLoading(
            async () => {
                const method = this.#settings.seedTeams ? 'seeded' : 'random';
                const result = await api.post('teams', this.currentDate, {
                    method,
                    teamConfig: options
                });

                this.teams = result.teams || {};

                // Load draw history for the newly generated teams
                await this.loadDrawHistory();

                success = true;
            },
            (err) => {
                console.error('Error generating teams:', err);
                setNotification(
                    errorMessage(err) || 'Failed to generate teams. Please try again.',
                    'error'
                );
                this.teams = restoreTeams;
            }
        );

        return success;
    }

    /**
     * Unified player removal operation - handles all removal scenarios
     * @param {string} playerName - Player name to remove
     * @param {string} action - Action to take: 'waitingList', 'remove', or 'unassign'
     * @param {?string} [teamName] - Team name (auto-detected if not provided)
     */
    async removePlayer(playerName, action = 'waitingList', teamName = null) {
        if (this.isLocked() || !playersService.canModifyList) {
            setNotification('Players cannot be changed.', 'warning');
            return;
        }

        const restoreTeams = { ...this.teams };
        const restorePlayers = [...playersService.players];
        const restoreWaitingList = [...playersService.waitingList];

        await withLoading(
            async () => {
                // Auto-detect team name if not provided
                let detectedTeamName = teamName;
                if (!detectedTeamName) {
                    // Find which team the player is in
                    for (const [name, roster] of Object.entries(this.teams)) {
                        if (roster.some((player) => player?.name === playerName)) {
                            detectedTeamName = name;
                            break;
                        }
                    }
                }

                const result = await api.remove('teams/players', this.currentDate, {
                    playerName: playerName,
                    teamName: detectedTeamName,
                    action: action
                });

                if (result) {
                    // Update local state with server response
                    this.teams = result.teams;
                    // Store enhanced player data with ELO
                    this.availablePlayersWithElo = result.players.available;
                    this.waitingListWithElo = result.players.waitingList;
                    // Extract player names for legacy playersService
                    playersService.players = result.players.available.map(
                        (/** @type {PlayerWithElo} */ p) => p.name
                    );
                    playersService.waitingList = result.players.waitingList.map(
                        (/** @type {PlayerWithElo} */ p) => p.name
                    );
                    playersService.ownedByMe = result.ownedByMe || playersService.ownedByMe;

                    // Reload team configurations to reflect player changes
                    await this.loadTeamConfigurations();
                }
            },
            (err) => {
                console.error('Error removing player:', err);
                setNotification(
                    errorMessage(err) || 'Failed to remove player. Please try again.',
                    'error'
                );
                this.teams = restoreTeams;
                playersService.players = restorePlayers;
                playersService.waitingList = restoreWaitingList;
            }
        );
    }

    /**
     * Unified player assignment operation - handles all assignment scenarios
     * @param {?string} playerName - Player name to assign (optional for auto-assignment)
     * @param {string} teamName - Team name to assign to
     */
    async assignPlayerToTeam(playerName, teamName) {
        if (this.isLocked() || !playersService.canModifyList) {
            setNotification('Teams cannot be changed.', 'warning');
            return;
        }

        // Auto-select first unassigned player if none specified
        const selectedPlayer =
            playerName || this.unassignedPlayers[0] || playersService.waitingList[0];

        if (!selectedPlayer) {
            setNotification('No unassigned players available.', 'info');
            return;
        }

        const restoreTeams = { ...this.teams };
        const restorePlayers = [...playersService.players];
        const restoreWaitingList = [...playersService.waitingList];

        await withLoading(
            async () => {
                const result = await api.post('teams/players', this.currentDate, {
                    playerName: selectedPlayer,
                    teamName: teamName
                });

                if (result) {
                    // Update local state with server response
                    this.teams = result.teams;
                    // Store enhanced player data with ELO
                    this.availablePlayersWithElo = result.players.available;
                    this.waitingListWithElo = result.players.waitingList;
                    // Extract player names for legacy playersService
                    playersService.players = result.players.available.map(
                        (/** @type {PlayerWithElo} */ p) => p.name
                    );
                    playersService.waitingList = result.players.waitingList.map(
                        (/** @type {PlayerWithElo} */ p) => p.name
                    );
                    playersService.ownedByMe = result.ownedByMe || playersService.ownedByMe;

                    // Reload team configurations to reflect player changes
                    await this.loadTeamConfigurations();
                }
            },
            (err) => {
                console.error('Error assigning player to team:', err);
                setNotification(
                    errorMessage(err) || 'Failed to assign player to team. Please try again.',
                    'error'
                );
                this.teams = restoreTeams;
                playersService.players = restorePlayers;
                playersService.waitingList = restoreWaitingList;
            }
        );
    }

    /**
     * Apply an assignment API response (teams/players) to local state.
     * @param {{teams?: EnhancedTeamsData, players?: {available: PlayerWithElo[], waitingList: PlayerWithElo[]}, ownedByMe?: string[]}} result - API response with teams, players and ownedByMe
     */
    #applyAssignmentResult(result) {
        this.teams = result.teams ?? {};
        this.availablePlayersWithElo = result.players?.available ?? [];
        this.waitingListWithElo = result.players?.waitingList ?? [];
        playersService.players = this.availablePlayersWithElo.map((p) => p.name);
        playersService.waitingList = this.waitingListWithElo.map((p) => p.name);
        playersService.ownedByMe = result.ownedByMe || playersService.ownedByMe;
    }

    /**
     * Run a balance-aware auto-assign request and reconcile local state.
     * @param {{playerName?: string, teamName?: string}} body - Request body ({ playerName } | { teamName } | {})
     * @param {string} fallbackError - User-facing error message on failure
     */
    async #runAutoAssign(body, fallbackError) {
        const restoreTeams = { ...this.teams };
        const restorePlayers = [...playersService.players];
        const restoreWaitingList = [...playersService.waitingList];

        await withLoading(
            async () => {
                const result = await api.post('teams/auto-assign', this.currentDate, body);
                if (result) {
                    this.#applyAssignmentResult(result);
                    await this.loadTeamConfigurations();
                }
            },
            (err) => {
                console.error(fallbackError, err);
                setNotification(errorMessage(err) || fallbackError, 'error');
                this.teams = restoreTeams;
                playersService.players = restorePlayers;
                playersService.waitingList = restoreWaitingList;
            }
        );
    }

    /**
     * Auto-assign a single waiting/unassigned player to the best-balanced team.
     * @param {string} playerName - Player to assign
     */
    async autoAssignPlayer(playerName) {
        if (this.isLocked() || !playersService.canModifyList) {
            setNotification('Teams cannot be changed.', 'warning');
            return;
        }
        await this.#runAutoAssign({ playerName }, 'Failed to auto-assign player.');
    }

    /**
     * Auto-assign the best-balanced available/waiting player to a specific team.
     * @param {string} teamName - Team to fill
     */
    async autoAssignToTeam(teamName) {
        if (this.isLocked() || !playersService.canModifyList) {
            setNotification('Teams cannot be changed.', 'warning');
            return;
        }
        await this.#runAutoAssign({ teamName }, 'Failed to auto-assign player.');
    }

    /**
     * Auto-assign all waiting then unassigned players across teams, keeping balance
     * and even team sizes. Admin-only (enforced server-side).
     */
    async autoAssignAll() {
        if (this.isLocked()) {
            setNotification('Teams cannot be changed.', 'warning');
            return;
        }
        await this.#runAutoAssign({}, 'Failed to auto-assign players.');
    }

    /**
     * Load teams data for a specific date
     * @param {string} date - The date to load teams for
     */
    async loadTeams(date) {
        await withLoading(
            async () => {
                this.currentDate = date;

                // Load teams data with enhanced player information
                const teamsData = await api.get('teams', date);
                if (teamsData) {
                    // Extract teams and enhanced player data
                    this.teams = teamsData.teams || {};
                    this.availablePlayersWithElo = teamsData.players?.available || [];
                    this.waitingListWithElo = teamsData.players?.waitingList || [];

                    // Update playersService with extracted names for backward compatibility
                    playersService.players = this.availablePlayersWithElo.map((p) => p.name);
                    playersService.waitingList = this.waitingListWithElo.map((p) => p.name);
                    playersService.ownedByMe = teamsData.ownedByMe || [];
                    // Ensure playersService has the correct currentDate for derived calculations
                    playersService.currentDate = date;
                } else {
                    // Fallback: load basic player data if teams API fails
                    await playersService.loadPlayers(date);
                    this.teams = {};
                    this.availablePlayersWithElo = [];
                    this.waitingListWithElo = [];
                }

                // Load team configurations
                await this.loadTeamConfigurations();

                // Load draw history for replay (if available)
                await this.loadDrawHistory();
            },
            (err) => {
                console.error('Error fetching teams data:', err);
                setNotification(
                    errorMessage(err) || 'Failed to load teams data. Please try again.',
                    'error'
                );
            }
        );
    }

    /**
     * Load draw history for replay functionality
     */
    async loadDrawHistory() {
        if (!this.currentDate) return;

        await withLoading(
            async () => {
                try {
                    this.drawHistory = await api.get('teams/draw-history', this.currentDate);
                } catch (err) {
                    // Draw history is optional - don't show error if not found
                    if (
                        errorStatus(err) === 404 ||
                        errorMessage(err)?.includes('No draw history found')
                    ) {
                        this.drawHistory = null;
                    } else {
                        throw err;
                    }
                }
            },
            (err) => {
                console.error('Error loading draw history:', err);
                setNotification(
                    errorMessage(err) || 'Failed to load draw history. Please try again.',
                    'error'
                );
                this.drawHistory = null;
            }
        );
    }

    /**
     * Reset the teams service state
     */
    reset() {
        this.teams = {};
        this.currentDate = null;
        this.drawHistory = null;
        this.#teamConfigurations = [];
        this.waitingListWithElo = [];
        this.availablePlayersWithElo = [];
    }

    /**
     * Get all players (available and waiting list) for team table display
     */
    getAllPlayers() {
        return [...playersService.players, ...playersService.waitingList];
    }
}

// Export singleton instance
export const teamsService = new TeamsService();

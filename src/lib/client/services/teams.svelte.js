import { api } from '$lib/client/services/api-client.svelte.js';
import { playersService } from '$lib/client/services/players.svelte.js';
import { setNotification } from '$lib/client/stores/notification.js';
import { withLoading } from '$lib/client/stores/loading.js';
import { settings } from '$lib/client/stores/settings.js';
import { isDateInPast } from '$lib/shared/helpers.js';
import { defaultSettings } from '$lib/shared/defaults.js';

class TeamsService {
    #settings = $state(defaultSettings);

    // State
    /** @type {Object} */
    teams = $state({});

    /** @type {Object} */
    rankings = $state({});

    /** @type {string | null} */
    currentDate = $state(null);

    /** @type {Object | null} */
    leagueInfo = $state(null);

    /** @type {boolean} */
    hasExistingTeams = $derived(Object.keys(this.teams).length > 0);

    /** @type {Object} */
    playerSummary = $derived.by(() => {
        const players = playersService.players;
        const waitingList = playersService.waitingList;
        const playerLimit =
            this.#settings[this.currentDate]?.playerLimit || this.#settings.playerLimit;

        return {
            available: players.length,
            eligible: Math.min(players.length, playerLimit),
            excess: Math.max(0, players.length - playerLimit),
            waitingList: waitingList.length
        };
    });

    /** @type {boolean} */
    isPast = $derived.by(() => {
        if (!this.currentDate) return false;
        return isDateInPast(this.currentDate);
    });

    teamConfig = $derived.by(() => {
        return this.#teamConfigurations || [];
    });

    /** @type {Array} */
    #teamConfigurations = $state([]);

    /** @type {boolean} */
    confirmRegenerate = $state(false);

    /** @type {boolean} */
    canGenerateTeams = $derived.by(() => {
        return (
            !this.isPast &&
            playersService.canModifyList &&
            (this.#settings.canRegenerateTeams || Object.keys(this.teams).length === 0)
        );
    });

    /** @type {string[]} */
    unassignedPlayers = $derived.by(() => {
        const assignedPlayers = $state(new Set());

        // Collect all players currently assigned to teams
        Object.values(this.teams).forEach((team) => {
            team.forEach((player) => {
                if (player) {
                    assignedPlayers.add(player);
                }
            });
        });

        // Return available players not assigned to any team
        return playersService.players.filter((player) => !assignedPlayers.has(player));
    });

    constructor() {
        settings.subscribe((settings) => {
            this.#settings = settings;
        });
    }

    // Methods
    /**
     * Load team configurations from server
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
                    err.message || 'Failed to load team configurations. Please try again.',
                    'error'
                );
                this.#teamConfigurations = [];
            }
        );
    }

    /**
     * Generate teams using the selected configuration
     * @param {Object} options - Configuration object containing team options
     */
    async generateTeams(options) {
        if (this.isPast || !playersService.canModifyList) {
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
                success = true;
            },
            (err) => {
                console.error('Error generating teams:', err);
                setNotification(
                    err.message || 'Failed to generate teams. Please try again.',
                    'error'
                );
                this.teams = restoreTeams;
            }
        );

        return success;
    }

    /**
     * Remove a player from a team with enhanced actions
     * @param {string} player - Player name to remove
     * @param {number} teamIndex - Index of the team
     * @param {string} action - Action to take: 'waitingList' or 'remove'
     */
    async removePlayerFromTeam(player, teamIndex, action = 'waitingList') {
        if (this.isPast || !playersService.canModifyList) {
            setNotification('Teams cannot be changed.', 'warning');
            return;
        }

        const restoreTeams = { ...this.teams };
        const restorePlayers = { ...playersService.players };
        const restoreWaitingList = [...playersService.waitingList];

        await withLoading(
            async () => {
                const teamNames = Object.keys(this.teams);
                const teamName = teamNames[teamIndex];

                const result = await api.remove('teams/players', this.currentDate, {
                    playerName: player,
                    teamName: teamName,
                    action: action
                });

                if (result) {
                    // Update local state with server response
                    this.teams = result.teams;
                    playersService.players = result.players.available;
                    playersService.waitingList = result.players.waitingList;
                }
            },
            (err) => {
                console.error('Error removing player from team:', err);
                setNotification('Failed to remove player. Please try again.', 'error');
                this.teams = restoreTeams;
                playersService.players = restorePlayers;
                playersService.waitingList = restoreWaitingList;
            }
        );
    }

    /**
     * @deprecated Use removePlayerFromTeam instead
     */
    async removePlayer(player, teamIndex) {
        return this.removePlayerFromTeam(player, teamIndex, 'waitingList');
    }

    /**
     * Fill an empty spot from unassigned players (first available player)
     * @param {number} playerIndex - Index of the empty spot
     * @param {number} teamIndex - Index of the team
     */
    async fillEmptySpotFromWaitingList(playerIndex, teamIndex) {
        if (this.unassignedPlayers.length > 0) {
            const nextPlayer = this.unassignedPlayers[0];
            return this.fillEmptySpotWithPlayer(playerIndex, teamIndex, nextPlayer);
        } else {
            setNotification('No unassigned players available.', 'info');
        }
    }

    /**
     * Assign a player to a team by team name (finds first empty slot)
     * @param {string} playerName - Player name to assign
     * @param {string} teamName - Team name to assign to
     */
    async assignPlayerToTeam(playerName, teamName) {
        if (this.isPast || !playersService.canModifyList) {
            setNotification('Teams cannot be changed.', 'warning');
            return;
        }

        const restoreTeams = { ...this.teams };
        const restorePlayers = [...playersService.players];
        const restoreWaitingList = [...playersService.waitingList];

        await withLoading(
            async () => {
                const result = await api.post('teams/players', this.currentDate, {
                    playerName: playerName,
                    teamName: teamName
                });

                if (result) {
                    // Update local state with server response
                    this.teams = result.teams;
                    playersService.players = result.players.available;
                    playersService.waitingList = result.players.waitingList;
                }
            },
            (err) => {
                console.error('Error assigning player to team:', err);
                setNotification('Failed to assign player to team. Please try again.', 'error');
                this.teams = restoreTeams;
                playersService.players = restorePlayers;
                playersService.waitingList = restoreWaitingList;
            }
        );
    }

    /**
     * Fill an empty spot with a specific player from the waiting list
     * @param {number} playerIndex - Index of the empty spot
     * @param {number} teamIndex - Index of the team
     * @param {string} selectedPlayer - Player name to move from waiting list
     */
    async fillEmptySpotWithPlayer(playerIndex, teamIndex, selectedPlayer) {
        if (this.isPast || !playersService.canModifyList) {
            setNotification('Teams cannot be changed.', 'warning');
            return;
        }

        const restoreTeams = { ...this.teams };
        const restorePlayers = [...playersService.players];
        const restoreWaitingList = [...playersService.waitingList];

        await withLoading(
            async () => {
                const teamNames = Object.keys(this.teams);
                const teamName = teamNames[teamIndex];

                if (this.teams[teamName][playerIndex] !== null) {
                    setNotification('This spot is already filled.', 'warning');
                    return;
                }

                const result = await api.patch('teams/players', this.currentDate, {
                    operation: 'fillSlot',
                    playerName: selectedPlayer,
                    teamName: teamName
                });

                if (result) {
                    // Update local state with server response
                    this.teams = result.teams;
                    playersService.players = result.players.available;
                    playersService.waitingList = result.players.waitingList;
                }
            },
            (err) => {
                console.error('Error filling empty spot with specific player:', err);
                setNotification(
                    'Failed to assign player to empty spot. Please try again.',
                    'error'
                );
                this.teams = restoreTeams;
                playersService.players = restorePlayers;
                playersService.waitingList = restoreWaitingList;
            }
        );
    }

    /**
     * Load teams and rankings data for a specific date
     * @param {string} date - The date to load teams for
     */
    async loadTeams(date) {
        await withLoading(
            async () => {
                this.currentDate = date;

                // Load players first (teams depend on this)
                await playersService.loadPlayers(date);

                // Load rankings with enhanced data
                this.rankings = await api.get('rankings');

                // Load existing teams data
                this.teams = (await api.get('teams', date)) || {};

                // Load team configurations
                await this.loadTeamConfigurations();
            },
            (err) => {
                console.error('Error fetching teams data:', err);
                setNotification(
                    err.message || 'Failed to load teams data. Please try again.',
                    'error'
                );
            }
        );
    }

    /**
     * Reset the teams state
     */
    reset() {
        this.teams = {};
        this.rankings = {};
        this.currentDate = null;
        this.#teamConfigurations = [];
        this.confirmRegenerate = false;
    }

    /**
     * Get all players (available + waiting list) for team table display
     */
    getAllPlayers() {
        return [...playersService.players, ...playersService.waitingList];
    }
}

// Export singleton instance
export const teamsService = new TeamsService();

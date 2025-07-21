import { api } from '$lib/client/services/api-client.svelte.js';
import { playersService } from '$lib/client/services/players.svelte.js';
import { setNotification } from '$lib/client/stores/notification.js';
import { withLoading } from '$lib/client/stores/loading.js';
import { settings } from '$lib/client/stores/settings.js';
import { nouns } from '$lib/client/nouns.js';
import { teamColours, isDateInPast } from '$lib/shared/helpers.js';
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
        const effectivePlayerLimit =
            this.#settings[this.currentDate]?.playerLimit || this.#settings.playerLimit;
        const playerCount = Math.min(playersService.players.length, effectivePlayerLimit);
        return this.calculateTeamConfig(playerCount);
    });

    /** @type {boolean} */
    canGenerateTeams = $derived.by(() => {
        return (
            !this.isPast &&
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
    calculateTeamConfig(playerCount) {
        const teamLimits = {
            min: this.#settings.teamGeneration.minTeams,
            max: this.#settings.teamGeneration.maxTeams
        };
        const playerLimits = {
            min: this.#settings.teamGeneration.minPlayersPerTeam,
            max: this.#settings.teamGeneration.maxPlayersPerTeam
        };
        const config = [];

        for (
            let t = teamLimits.min;
            t <= teamLimits.max && t * playerLimits.min <= playerCount;
            t++
        ) {
            const minPlayers = Math.floor(playerCount / t);
            const extraPlayers = playerCount % t;
            const teamSizes = Array(t).fill(minPlayers);

            for (let i = 0; i < extraPlayers; i++) {
                teamSizes[i]++;
            }

            if (teamSizes.every((size) => size >= playerLimits.min && size <= playerLimits.max)) {
                config.push({
                    teams: t,
                    teamSizes: teamSizes
                });
            }
        }
        return config;
    }

    generateRandomTeams(options) {
        const players = playersService.players;
        const eligiblePlayers = players.slice(
            0,
            Math.min(
                players.length,
                this.#settings[this.currentDate]?.playerLimit || this.#settings.playerLimit
            )
        );
        const teams = {};
        const teamSizes = options.teamSizes;
        const shuffledPlayers = eligiblePlayers.sort(() => Math.random() - 0.5);

        for (let i = 0; i < teamSizes.length; i++) {
            const noun = nouns[Math.floor(Math.random() * nouns.length)];
            const name = `${teamColours[i]} ${noun}`;
            teams[name] = [...shuffledPlayers.splice(0, teamSizes[i])];
        }
        return teams;
    }

    generateSeededTeams(options) {
        const players = playersService.players;
        const eligiblePlayers = players.slice(
            0,
            Math.min(
                players.length,
                this.#settings[this.currentDate]?.playerLimit || this.#settings.playerLimit
            )
        );
        const teamSizes = options.teamSizes;
        const numTeams = teamSizes.length;
        const teams = {};

        // Sort players by ranking points first, then total points, then appearances
        const sortedPlayers = [...eligiblePlayers].sort((a, b) => {
            const playerA = this.rankings?.players?.[a];
            const playerB = this.rankings?.players?.[b];

            if (playerA?.rankingPoints !== undefined && playerB?.rankingPoints !== undefined) {
                if (playerA.rankingPoints !== playerB.rankingPoints) {
                    return playerB.rankingPoints - playerA.rankingPoints;
                }
            }

            if ((playerA?.points || 0) !== (playerB?.points || 0)) {
                return (playerB?.points || 0) - (playerA?.points || 0);
            }

            return (playerB?.appearances || 0) - (playerA?.appearances || 0);
        });

        // Create team structure
        for (let i = 0; i < numTeams; i++) {
            const noun = nouns[Math.floor(Math.random() * nouns.length)];
            const name = `${teamColours[i]} ${noun}`;
            teams[name] = [];
        }

        const teamNames = Object.keys(teams);
        let playerIndex = 0;

        // Fill teams round by round until all are complete
        while (
            teamNames.some((name, i) => teams[name].length < teamSizes[i]) &&
            playerIndex < sortedPlayers.length
        ) {
            // Create a pot of players for this round (double size for variability)
            const potSize = Math.min(numTeams * 2, sortedPlayers.length - playerIndex);
            const currentPot = sortedPlayers.slice(playerIndex, playerIndex + potSize);

            // Randomize within the pot
            currentPot.sort(() => Math.random() - 0.5);

            let potPlayerIndex = 0;

            // Distribute players from this pot to teams that still need players
            for (
                let teamIndex = 0;
                teamIndex < numTeams && potPlayerIndex < currentPot.length;
                teamIndex++
            ) {
                const teamName = teamNames[teamIndex];
                const currentTeamSize = teams[teamName].length;
                const targetTeamSize = teamSizes[teamIndex];

                // Skip if team is already full
                if (currentTeamSize >= targetTeamSize) continue;

                // Determine how many players to assign (1 or 2, but no more than available in pot)
                const remainingSpots = targetTeamSize - currentTeamSize;
                const availableInPot = currentPot.length - potPlayerIndex;
                const playersToAssign = Math.min(2, remainingSpots, availableInPot);

                // Assign players from pot to this team
                for (let p = 0; p < playersToAssign; p++) {
                    teams[teamName].push(currentPot[potPlayerIndex++]);
                }
            }

            // Move to next batch of players
            playerIndex += potSize;
        }

        return teams;
    }

    /**
     * Generate teams using the selected configuration
     * @param {Object} options - Configuration object containing team options
     */
    async generateTeams(options) {
        if (this.isPast) {
            setNotification('The date is in the past. Teams cannot be changed.', 'warning');
            return false;
        }

        if (!options) {
            setNotification('Please choose a team option.', 'warning');
            return false;
        }

        // Remove confirmRegenerate logic - let component handle it
        const restoreTeams = { ...this.teams };
        let success = false;

        await withLoading(
            async () => {
                this.teams = this.#settings.seedTeams
                    ? this.generateSeededTeams(options)
                    : this.generateRandomTeams(options);

                this.teams = (await api.post('teams', this.currentDate, this.teams)) || {};
                success = true;
            },
            (err) => {
                console.error('Error generating teams:', err);
                setNotification('Failed to generate teams. Please try again.', 'error');
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
        if (this.isPast) {
            setNotification('The date is in the past. Teams cannot be changed.', 'warning');
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
        if (this.isPast) {
            setNotification('The date is in the past. Teams cannot be changed.', 'warning');
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
        if (this.isPast) {
            setNotification('The date is in the past. Teams cannot be changed.', 'warning');
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

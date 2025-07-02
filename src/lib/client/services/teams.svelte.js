import { api } from '$lib/client/services/api-client.svelte.js';
import { playersService } from '$lib/client/services/players.svelte.js';
import { setError } from '$lib/client/stores/error.js';
import { withLoading } from '$lib/client/stores/loading.js';
import { settings, defaultSettings } from '$lib/client/stores/settings.js';
import { nouns } from '$lib/client/nouns.js';
import { teamColours, isDateInPast } from '$lib/shared/helpers.js';
import { get } from 'svelte/store';

class TeamsService {
    // State
    /** @type {Object} */
    teams = $state({});

    /** @type {Object} */
    rankings = $state({});

    /** @type {string | null} */
    currentDate = $state(null);

    /** @type {boolean} */
    confirmRegenerate = $state(false);

    // Derived state
    teamNames = $derived(Object.keys(this.teams || {}));

    isPast = $derived.by(() => {
        if (!this.currentDate) return false;
        return isDateInPast(this.currentDate);
    });

    teamConfig = $derived.by(() => {
        const playerCount = Math.min(playersService.players.length, this.#settings.playerLimit);
        return this.calculateTeamConfig(playerCount);
    });

    canGenerateTeams = $derived.by(() => {
        return (
            !this.isPast &&
            (this.#settings.canRegenerateTeams || Object.keys(this.teams).length === 0)
        );
    });

    #settings = $state(defaultSettings);
    constructor() {
        settings.subscribe((settings) => {
            this.#settings = settings;
        });
    }
    // Methods
    calculateTeamConfig(playerCount) {
        const teamLimits = { min: 2, max: 5 };
        const playerLimits = { min: 5, max: 7 };
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
            Math.min(players.length, this.#settings.playerLimit)
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
            Math.min(players.length, this.#settings.playerLimit)
        );
        const teamSizes = options.teamSizes;
        const numTeams = teamSizes.length;
        const teams = {};

        // Sort players by ranking points first, then total points, then appearances
        const sortedPlayers = [...eligiblePlayers].sort((a, b) => {
            const playerA = this.rankings?.players?.[a];
            const playerB = this.rankings?.players?.[b];

            // Primary sort: ranking points (if available)
            if (playerA?.rankingPoints !== undefined && playerB?.rankingPoints !== undefined) {
                if (playerA.rankingPoints !== playerB.rankingPoints) {
                    return playerB.rankingPoints - playerA.rankingPoints;
                }
            }

            // Secondary sort: total points
            if ((playerA?.points || 0) !== (playerB?.points || 0)) {
                return (playerB?.points || 0) - (playerA?.points || 0);
            }

            // Tertiary sort: appearances
            return (playerB?.appearances || 0) - (playerA?.appearances || 0);
        });

        // Create pots for snake draft
        const pots = [];
        for (let i = 0; i < Math.max(...teamSizes); i++) {
            pots.push([...sortedPlayers.splice(0, numTeams)]);
            while (pots[i].length < numTeams) {
                pots[i].push(null);
            }
        }

        // Randomize within each pot to prevent predictable team assignments
        for (let pot of pots) {
            pot.sort(() => Math.random() - 0.5);
        }

        // Create team structure
        for (let i = 0; i < numTeams; i++) {
            const noun = nouns[Math.floor(Math.random() * nouns.length)];
            const name = `${teamColours[i]} ${noun}`;
            teams[name] = [];
        }

        // Distribute players from pots to teams
        const teamNames = Object.keys(teams);
        for (let i = 0; i < teamNames.length; i++) {
            const teamName = teamNames[i];
            const teamSize = Math.max(...teamSizes);
            for (let j = 0; j < teamSize; j++) {
                if (pots[j] && pots[j].length > 0) {
                    const player = pots[j].shift();
                    if (player) teams[teamName].push(player);
                }
            }
        }

        return teams;
    }

    /**
     * Generate teams using the selected configuration
     * @param {Object} options - Configuration object containing team options
     * @param {boolean} regenerate - Whether to force regeneration
     */
    async generateTeams(options, regenerate = false) {
        if (this.isPast) {
            setError('The date is in the past. Teams cannot be changed.');
            return false;
        }

        if (!options) {
            setError('Please choose a team option.');
            return false;
        }

        if (Object.keys(this.teams).length > 0 && !regenerate) {
            this.confirmRegenerate = true;
            return false;
        }

        const restoreTeams = { ...this.teams };
        let success = false;

        await withLoading(
            async () => {
                this.teams = this.#settings.seedTeams
                    ? this.generateSeededTeams(options)
                    : this.generateRandomTeams(options);

                this.teams = (await api.post('teams', this.currentDate, this.teams)) || {};
                this.confirmRegenerate = false;
                success = true;
            },
            (err) => {
                console.error('Error generating teams:', err);
                setError('Failed to generate teams. Please try again.');
                this.teams = restoreTeams;
            }
        );

        return success;
    }

    /**
     * Remove a player from a team
     * @param {string} player - Player name to remove
     * @param {number} teamIndex - Index of the team
     */
    async removePlayer(player, teamIndex) {
        if (this.isPast) {
            setError('The date is in the past. Teams cannot be changed.');
            return;
        }

        const restoreTeams = { ...this.teams };

        await withLoading(
            async () => {
                const teamNames = Object.keys(this.teams);
                this.teams[teamNames[teamIndex]] = this.teams[teamNames[teamIndex]].filter(
                    (p) => p !== player
                );

                if (playersService.waitingList.length > 0) {
                    const nextPlayer = playersService.waitingList[0];
                    this.teams[teamNames[teamIndex]].push(nextPlayer);
                    // Remove from waiting list via players service
                    await playersService.removePlayer(nextPlayer, 'waitingList');
                } else {
                    this.teams[teamNames[teamIndex]].push(null);
                }

                this.teams = (await api.post('teams', this.currentDate, this.teams)) || {};
            },
            (err) => {
                console.error('Error removing player:', err);
                setError('Failed to remove player. Please try again.');
                this.teams = restoreTeams;
            }
        );
    }

    /**
     * Fill an empty spot from the waiting list
     * @param {number} playerIndex - Index of the empty spot
     * @param {number} teamIndex - Index of the team
     */
    async fillEmptySpotFromWaitingList(playerIndex, teamIndex) {
        if (this.isPast) {
            setError('The date is in the past. Teams cannot be changed.');
            return;
        }

        const restoreTeams = { ...this.teams };

        await withLoading(
            async () => {
                const teamNames = Object.keys(this.teams);
                if (this.teams[teamNames[teamIndex]][playerIndex] !== null) {
                    setError('This spot is already filled.');
                    return;
                }

                if (playersService.waitingList.length > 0) {
                    const nextPlayer = playersService.waitingList[0];
                    this.teams[teamNames[teamIndex]][playerIndex] = nextPlayer;
                    // Remove from waiting list via players service
                    await playersService.removePlayer(nextPlayer, 'waitingList');
                }

                this.teams = (await api.post('teams', this.currentDate, this.teams)) || {};
            },
            (err) => {
                console.error('Error filling empty spot with a player:', err);
                setError('Failed to assign waiting list player to empty spot. Please try again.');
                this.teams = restoreTeams;
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
                setError('Failed to load teams data. Please try again.');
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

    /**
     * Get summary statistics for display
     */
    getPlayerSummary() {
        const players = playersService.players;
        const waitingList = playersService.waitingList;
        const playerLimit = get(settings).playerLimit;

        return {
            available: players.length,
            eligible: Math.min(players.length, playerLimit),
            excess: Math.max(0, players.length - playerLimit),
            waitingList: waitingList.length
        };
    }
}

// Export singleton instance
export const teamsService = new TeamsService();

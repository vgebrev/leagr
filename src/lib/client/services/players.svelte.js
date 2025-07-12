import { api } from '$lib/client/services/api-client.svelte.js';
import { setError } from '$lib/client/stores/error.js';
import { withLoading } from '$lib/client/stores/loading.js';
import { settings } from '$lib/client/stores/settings.js';
import { get } from 'svelte/store';

class PlayersService {
    // State
    /** @type {string[]} */
    players = $state([]);

    /** @type {string[]} */
    waitingList = $state([]);

    /** @type {string[]} */
    rankedPlayers = $state([]);

    /** @type {string | null} */
    currentDate = $state(null);

    // Derived state - works perfectly in classes!
    registrationOpenDate = $derived.by(() => {
        if (!this.currentDate) return null;
        const limit = new Date(this.currentDate);
        limit.setDate(limit.getDate() - 2);
        limit.setHours(7, 30, 0, 0);
        return limit;
    });

    registrationCloseDate = $derived.by(() => {
        if (!this.currentDate) return null;
        const limit = new Date(this.currentDate);
        limit.setDate(limit.getDate());
        limit.setHours(7, 30, 0, 0);
        return limit;
    });

    canModifyList = $derived.by(() => {
        if (!this.registrationOpenDate || !this.registrationCloseDate) return false;
        const now = new Date();
        return now >= this.registrationOpenDate && now <= this.registrationCloseDate;
    });

    // Methods
    /**
     * Load players for a specific date
     * @param {string} date - The date to load players for
     */
    async loadPlayers(date) {
        await withLoading(async () => {
            this.currentDate = date;
            const playerData = await api.get('players', date);
            this.players = playerData.available || [];
            this.waitingList = playerData.waitingList || [];

            if (this.rankedPlayers.length === 0) {
                this.rankedPlayers = await api.get('players/ranked');
            }
        });
    }

    /**
     * Add a player to the current date's list
     * @param {string} name - Player name to add
     * @param {string} [list='available'] - List to add the player to ('available' or 'waitingList')
     * @returns {Promise<boolean>} True if successful
     */
    async addPlayer(name, list = 'available') {
        let success = false;

        await withLoading(
            async () => {
                const trimmedName = name.trim();

                if (!trimmedName) {
                    setError('Player name cannot be empty.');
                    return;
                }

                if (this.players.includes(trimmedName) || this.waitingList.includes(trimmedName)) {
                    setError(`Player ${trimmedName} already added.`);
                    return;
                }

                const originalList = list;
                if (list === 'available' && this.players.length >= get(settings).playerLimit) {
                    list = 'waitingList';
                }

                const result = await api.post(`players`, this.currentDate, {
                    playerName: trimmedName,
                    list
                });
                this.players = result.available || [];
                this.waitingList = result.waitingList || [];

                // Show notification if player was auto-redirected to waiting list
                if (
                    originalList === 'available' &&
                    (list === 'waitingList' || result.waitingList.includes(trimmedName))
                ) {
                    setError(`Player limit reached. ${trimmedName} added to waiting list.`);
                }

                success = true;
            },
            (error) => {
                console.error('Error adding player:', error);
                setError('Failed to add player. Please try again.');
            }
        );

        return success;
    }

    /**
     * Remove a player from the current date's list
     * @param {string} playerName - Player name to remove
     * @param {string} [list='available'] - List to remove the player from ('available' or 'waitingList')
     */
    async removePlayer(playerName, list = 'available') {
        await withLoading(
            async () => {
                const index =
                    list === 'available'
                        ? this.players.indexOf(playerName)
                        : this.waitingList.indexOf(playerName);
                if (playerName && index !== -1) {
                    const result = await api.remove('players', this.currentDate, {
                        playerName,
                        list
                    });
                    this.players = result.available || [];
                    this.waitingList = result.waitingList || [];
                }
            },
            (error) => {
                console.error('Error removing player:', error);
                setError('Failed to remove player. Please try again.');
            }
        );
    }

    /**
     * Move a player from one list to another
     * @param {string} playerName
     * @param {string} fromList - available or waitingList
     * @param {string} toList - available or waitingList
     * @returns {Promise<void>}
     */
    async movePlayer(playerName, fromList, toList) {
        if (fromList === toList) return;

        await withLoading(
            async () => {
                const result = await api.patch('players', this.currentDate, {
                    playerName,
                    fromList,
                    toList
                });
                this.players = result.available || [];
                this.waitingList = result.waitingList || [];
            },
            (error) => {
                console.error('Error moving player:', error);
                setError('Failed to move player. Please try again.');
            }
        );
    }
    /**
     * Reset the players state
     */
    reset() {
        this.players = [];
        this.waitingList = [];
        this.currentDate = null;
    }
}

// Export singleton instance
export const playersService = new PlayersService();

import { api } from '$lib/services/api-client.svelte.js';
import { setError } from '$lib/stores/error.js';
import { withLoading } from '$lib/stores/loading.js';

class PlayersService {
    // State
    /** @type {string[]} */
    players = $state([]);

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
            this.players = await api.get('players', date);

            if (this.rankedPlayers.length === 0) {
                this.rankedPlayers = await api.get('players/ranked');
            }
        });
    }

    /**
     * Add a player to the current date's list
     * @param {string} name - Player name to add
     * @returns {Promise<boolean>} True if successful
     */
    async addPlayer(name) {
        let success = false;

        await withLoading(
            async () => {
                const trimmedName = name.trim();

                if (!trimmedName) {
                    setError('Player name cannot be empty.');
                    return;
                }

                if (this.players.includes(trimmedName)) {
                    setError(`Player ${trimmedName} already added.`);
                    return;
                }

                this.players = await api.post('players', this.currentDate, {
                    playerName: trimmedName
                });
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
     */
    async removePlayer(playerName) {
        await withLoading(
            async () => {
                const index = this.players.indexOf(playerName);
                if (playerName && index !== -1) {
                    this.players = await api.remove('players', this.currentDate, { playerName });
                }
            },
            (error) => {
                console.error('Error removing player:', error);
                setError('Failed to remove player. Please try again.');
            }
        );
    }

    /**
     * Reset the players state
     */
    reset() {
        this.players = [];
        this.currentDate = null;
        // Keep rankedPlayers cached
    }
}

// Export singleton instance
export const playersService = new PlayersService();

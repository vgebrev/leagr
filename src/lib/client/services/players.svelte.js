import { api } from '$lib/client/services/api-client.svelte.js';
import { setNotification } from '$lib/client/stores/notification.js';
import { withLoading } from '$lib/client/stores/loading.js';
import { settings } from '$lib/client/stores/settings.js';
import { defaultSettings } from '$lib/shared/defaults.js';
import { validatePlayerNameForUI } from '$lib/shared/validation.js';

class PlayersService {
    #settings = $state(defaultSettings);

    // State
    /** @type {string[]} */
    players = $state([]);

    /** @type {string[]} */
    waitingList = $state([]);

    /** @type {string[]} */
    rankedPlayers = $state([]);

    /** @type {string | null} */
    currentDate = $state(null);

    // Derived state
    registrationOpenDate = $derived.by(() => {
        if (!this.currentDate) return null;

        if (!this.#settings.registrationWindow.enabled) return null;

        const [hours, minutes] = this.#settings.registrationWindow.startTime.split(':').map(Number);
        const limit = $state(new Date(this.currentDate));
        limit.setDate(limit.getDate() + this.#settings.registrationWindow.startDayOffset);
        limit.setHours(hours, minutes, 0, 0);
        return limit;
    });

    registrationCloseDate = $derived.by(() => {
        if (!this.currentDate) return null;

        if (!this.#settings.registrationWindow.enabled) return null;

        const [hours, minutes] = this.#settings.registrationWindow.endTime.split(':').map(Number);
        const limit = $state(new Date(this.currentDate));
        limit.setDate(limit.getDate() + this.#settings.registrationWindow.endDayOffset);
        limit.setHours(hours, minutes, 0, 0);
        return limit;
    });

    canModifyList = $derived.by(() => {
        if (!this.#settings.registrationWindow.enabled) return true;

        if (!this.registrationOpenDate || !this.registrationCloseDate) return false;
        const now = new Date();
        return now >= this.registrationOpenDate && now <= this.registrationCloseDate;
    });

    constructor() {
        settings.subscribe((settings) => {
            this.#settings = settings;
        });
    }

    // Methods
    /**
     * Load players for a specific date
     * @param {string} date - The date to load players for
     */
    async loadPlayers(date) {
        await withLoading(
            async () => {
                this.currentDate = date;
                const playerData = await api.get('players', date);
                this.players = playerData?.available || [];
                this.waitingList = playerData?.waitingList || [];
            },
            (error) => {
                setNotification(
                    error.message || 'Failed to load players. Please try again.',
                    'error'
                );
            }
        );
    }

    /**
     * Load ranked player names (for autocomplete)
     */
    async loadRankedPlayerNames() {
        if (this.rankedPlayers.length > 0) return; // Already loaded

        await withLoading(
            async () => {
                this.rankedPlayers = await api.get('players/ranked');
            },
            (error) => {
                console.error('Error loading ranked players:', error);
                setNotification(
                    error.message || 'Failed to load player suggestions. Please try again.',
                    'error'
                );
                this.rankedPlayers = [];
            }
        );
    }

    /**
     * Add a player to the current date's list
     * @param {string} name - Player name to add
     * @param {string} [list='available'] - List to add the player to ('available' or 'waitingList')
     * @returns {Promise<boolean>} True if successful
     */
    async addPlayer(name, list = 'available') {
        if (!this.canModifyList) {
            setNotification('Player lists cannot be changed.', 'warning');
            return false;
        }
        let success = false;

        await withLoading(
            async () => {
                // Validate and sanitise player name
                const validation = validatePlayerNameForUI(name);

                if (!validation.isValid) {
                    setNotification(validation.errorMessage, 'warning');
                    return;
                }

                const sanitizedName = validation.sanitizedName;

                if (
                    this.players.includes(sanitizedName) ||
                    this.waitingList.includes(sanitizedName)
                ) {
                    setNotification(`Player ${sanitizedName} already added.`, 'warning');
                    return;
                }

                const originalList = list;
                const effectivePlayerLimit =
                    this.#settings[this.currentDate]?.playerLimit || this.#settings.playerLimit;
                if (list === 'available' && this.players.length >= effectivePlayerLimit) {
                    list = 'waitingList';
                }

                const result = await api.post(`players`, this.currentDate, {
                    playerName: sanitizedName,
                    list
                });
                this.players = result.available || [];
                this.waitingList = result.waitingList || [];

                // Show notification if the player was auto-redirected to the waiting list
                if (
                    originalList === 'available' &&
                    (list === 'waitingList' || result.waitingList.includes(sanitizedName))
                ) {
                    setNotification(
                        `Player limit reached. ${sanitizedName} added to waiting list.`,
                        'info'
                    );
                }

                success = true;
            },
            (error) => {
                console.error('Error adding player:', error);
                setNotification(
                    error.message || 'Failed to add player. Please try again.',
                    'error'
                );
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
        if (!this.canModifyList) {
            setNotification('Player lists cannot be changed.', 'warning');
            return;
        }
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
                setNotification(
                    error.message || 'Failed to remove player. Please try again.',
                    'error'
                );
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
        if (!this.canModifyList) {
            setNotification('Player lists cannot be changed.', 'warning');
            return;
        }
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
                setNotification(
                    error.message || 'Failed to move player. Please try again.',
                    'error'
                );
            }
        );
    }
    /**
     * Reset the player service state
     */
    reset() {
        this.players = [];
        this.waitingList = [];
        this.rankedPlayers = [];
        this.currentDate = null;
    }
}

// Export singleton instance
export const playersService = new PlayersService();

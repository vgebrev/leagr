import fs from 'fs/promises';
import path from 'path';
import { Mutex } from 'async-mutex';
import { getLeagueDataPath } from './league.js';
import { defaultSettings } from '$lib/shared/defaults.js';

const disciplineMutexes = new Map();

/**
 * Custom error class for discipline operations
 */
export class DisciplineError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.name = 'DisciplineError';
        this.statusCode = statusCode;
    }
}

/**
 * Server-side discipline management service
 */
export class DisciplineManager {
    constructor() {
        this.leagueId = null;
    }

    /**
     * Set the league ID for operations
     * @param {string} leagueId - League identifier
     * @returns {DisciplineManager} - Returns this for chaining
     */
    setLeague(leagueId) {
        if (!leagueId) {
            throw new DisciplineError('League ID is required', 400);
        }
        this.leagueId = leagueId;
        return this;
    }

    /**
     * Get the data path for the current league
     * @returns {string} - Data path
     */
    getDataPath() {
        if (!this.leagueId) {
            throw new Error('League ID must be set before accessing data path');
        }
        return getLeagueDataPath(this.leagueId);
    }

    /**
     * Get the discipline file path for the current league
     * @returns {string} - Discipline file path
     */
    getDisciplinePath() {
        return path.join(this.getDataPath(), 'discipline.json');
    }

    /**
     * Get mutex for the current league
     * @returns {Mutex} - League-specific mutex
     */
    getDisciplineMutex() {
        if (!this.leagueId) {
            throw new Error('League ID must be set before accessing mutex');
        }
        if (!disciplineMutexes.has(this.leagueId)) {
            disciplineMutexes.set(this.leagueId, new Mutex());
        }
        return disciplineMutexes.get(this.leagueId);
    }

    /**
     * Load discipline data without mutex protection (internal use)
     * @returns {Promise<Object>} - Raw discipline data
     */
    async loadDisciplineDataUnsafe() {
        try {
            const raw = await fs.readFile(this.getDisciplinePath(), 'utf-8');
            return JSON.parse(raw);
        } catch {
            return {
                lastUpdated: null,
                players: {}
            };
        }
    }

    /**
     * Load discipline data with mutex protection
     * @returns {Promise<Object>} - Raw discipline data
     */
    async loadDisciplineData() {
        const mutex = this.getDisciplineMutex();
        return await mutex.runExclusive(async () => {
            return await this.loadDisciplineDataUnsafe();
        });
    }

    /**
     * Save discipline data without mutex protection (internal use)
     * @param {Object} disciplineData - Discipline data to save
     * @returns {Promise<void>}
     */
    async saveDisciplineDataUnsafe(disciplineData) {
        disciplineData.lastUpdated = new Date().toISOString();
        await fs.writeFile(this.getDisciplinePath(), JSON.stringify(disciplineData, null, 2));
    }

    /**
     * Get player's discipline record
     * @param {string} playerName - Player name
     * @returns {Promise<Object>} - Player discipline record
     */
    async getPlayerRecord(playerName) {
        const disciplineData = await this.loadDisciplineData();
        return (
            disciplineData.players[playerName] || {
                noShows: 0,
                suspensions: [],
                totalSuspensions: 0
            }
        );
    }

    /**
     * Increment no-show count for a player
     * @param {string} playerName - Player name
     * @returns {Promise<Object>} - Updated discipline data
     */
    async incrementNoShow(playerName) {
        if (!this.leagueId) {
            throw new DisciplineError('League ID must be set before operations', 400);
        }

        const mutex = this.getDisciplineMutex();
        return await mutex.runExclusive(async () => {
            const disciplineData = await this.loadDisciplineDataUnsafe();

            if (!disciplineData.players[playerName]) {
                disciplineData.players[playerName] = {
                    noShows: 0,
                    suspensions: [],
                    totalSuspensions: 0
                };
            }

            disciplineData.players[playerName].noShows += 1;
            await this.saveDisciplineDataUnsafe(disciplineData);
            return disciplineData;
        });
    }

    /**
     * Check if player should be suspended based on no-shows
     * @param {string} playerName - Player name
     * @param {Object} settings - League settings
     * @returns {Promise<Object>} - Suspension check result
     */
    async shouldSuspend(playerName, settings) {
        const playerRecord = await this.getPlayerRecord(playerName);
        const disciplineSettings = settings.discipline || {};

        if (!disciplineSettings.enabled) {
            return { shouldSuspend: false, reason: 'Discipline system disabled' };
        }

        const threshold =
            disciplineSettings.noShowThreshold || defaultSettings.discipline.noShowThreshold;

        if (playerRecord.noShows >= threshold) {
            return {
                shouldSuspend: true,
                reason: `Player has ${playerRecord.noShows} no-shows (threshold: ${threshold})`
            };
        }

        return { shouldSuspend: false, reason: 'Below no-show threshold' };
    }

    /**
     * Apply suspension to player
     * @param {string} playerName - Player name
     * @param {string} sessionDate - Date when suspension should be applied
     * @param {string} reason - Reason for suspension
     * @returns {Promise<Object>} - Updated discipline data
     */
    async applySuspension(playerName, sessionDate, reason = 'Repeated no-shows') {
        if (!this.leagueId) {
            throw new DisciplineError('League ID must be set before operations', 400);
        }

        const mutex = this.getDisciplineMutex();
        return await mutex.runExclusive(async () => {
            const disciplineData = await this.loadDisciplineDataUnsafe();

            if (!disciplineData.players[playerName]) {
                disciplineData.players[playerName] = {
                    noShows: 0,
                    suspensions: [],
                    totalSuspensions: 0
                };
            }

            const suspension = {
                date: sessionDate,
                reason: reason,
                applied: new Date().toISOString()
            };

            disciplineData.players[playerName].suspensions.push(suspension);
            disciplineData.players[playerName].totalSuspensions += 1;
            // Reset no-show count after suspension is applied
            disciplineData.players[playerName].noShows = 0;

            await this.saveDisciplineDataUnsafe(disciplineData);
            return disciplineData;
        });
    }

    /**
     * Check if player is currently suspended for a session
     * @param {string} playerName - Player name
     * @param {string} sessionDate - Session date to check
     * @returns {Promise<Object>} - Suspension status
     */
    async isPlayerSuspended(playerName, sessionDate) {
        const playerRecord = await this.getPlayerRecord(playerName);

        // Check if player has any suspensions for this specific date
        const suspensionForDate = playerRecord.suspensions.find((s) => s.date === sessionDate);

        if (suspensionForDate) {
            return {
                suspended: true,
                reason: `${suspensionForDate.reason}`,
                suspension: suspensionForDate
            };
        }

        return { suspended: false };
    }

    /**
     * Evaluate suspension on signup attempt
     * @param {string} playerName - Player name
     * @param {string} sessionDate - Date of the session they're trying to join
     * @param {Object} settings - League settings
     * @returns {Promise<Object>} - Suspension evaluation result
     */
    async evaluateSuspensionOnSignup(playerName, sessionDate, settings) {
        // First check if player is already suspended for this specific session
        const currentSuspension = await this.isPlayerSuspended(playerName, sessionDate);
        if (currentSuspension.suspended) {
            return currentSuspension;
        }

        // Check if player should be suspended based on no-show count
        const suspensionCheck = await this.shouldSuspend(playerName, settings);
        if (suspensionCheck.shouldSuspend) {
            // Apply suspension for this session
            await this.applySuspension(
                playerName,
                sessionDate,
                'Suspended for 1 session due to repeated no-shows'
            );

            return {
                suspended: true,
                reason: 'You have been suspended for this session due to repeated no-shows. This suspension will be lifted after this session.',
                newSuspension: true
            };
        }

        return { suspended: false };
    }

    /**
     * Update suspension readiness if threshold is reached
     * @param {string} playerName - Player name
     * @param {Object} settings - League settings
     * @returns {Promise<void>}
     */
    async updateSuspensionReadinessIfNeeded(playerName, settings) {
        const suspensionCheck = await this.shouldSuspend(playerName, settings);

        // Note: We don't automatically apply suspension here as it should only be applied
        // when the player tries to sign up for the next session
        if (suspensionCheck.shouldSuspend) {
            console.warn(`Player ${playerName} is ready for suspension: ${suspensionCheck.reason}`);
        }
    }

    /**
     * Get all discipline records for reporting
     * @returns {Promise<Object>} - All discipline data
     */
    async getAllRecords() {
        return await this.loadDisciplineData();
    }
}

/**
 * Factory function to create a DisciplineManager instance
 * @returns {DisciplineManager} - New DisciplineManager instance
 */
export function createDisciplineManager() {
    return new DisciplineManager();
}

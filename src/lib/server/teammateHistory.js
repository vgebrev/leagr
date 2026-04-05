import { readdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

/**
 * Teammate History Tracker
 *
 * Tracks how many times players have been teammates across all sessions.
 * Creates a PxP matrix where P = total unique players and TH[i][j] = number of times players i and j were teammates.
 */
export class TeammateHistoryTracker {
    constructor() {
        this.leagueDataPath = 'data';
    }

    /**
     * Get all session files for a league, sorted by date descending
     * @param {string} leagueId - League identifier
     * @param {number | null} fileLimit - Max files to return. Default 70 covers the worst case for a
     *   10-session window (10 weeks × 7 days). Pass null for no limit.
     * @returns {Promise<string[]>} Array of session file paths
     */
    async getSessionFiles(leagueId, fileLimit = 70) {
        const leaguePath = join(this.leagueDataPath, leagueId);
        const files = await readdir(leaguePath);

        const sorted = files
            .filter((file) => file.match(/^\d{4}-\d{2}-\d{2}\.json$/))
            .sort((a, b) => b.localeCompare(a)); // Sort by date descending (newest first)

        return (fileLimit != null ? sorted.slice(0, fileLimit) : sorted).map((file) =>
            join(leaguePath, file)
        );
    }

    /**
     * Load session data from a file
     * @param {string} filePath - Path to session file
     * @returns {Promise<Object|null>} Session data or null if loading fails
     */
    async loadSessionData(filePath) {
        try {
            const data = await readFile(filePath, 'utf8');
            return JSON.parse(data);
        } catch {
            // Failed to load or parse session data, return null to be skipped by the caller
            return null;
        }
    }

    /**
     * Extract teammate pairs from a single session
     * @param {Object} sessionData - Session data containing teams
     * @returns {Array<Array<string>>} Array of player pairs who were teammates
     */
    extractTeammatePairs(sessionData) {
        const pairs = [];

        if (!sessionData?.teams) {
            return pairs;
        }

        // For each team, create pairs of all players
        Object.values(sessionData.teams).forEach((team) => {
            if (!Array.isArray(team)) return;

            // Filter out null/undefined/empty players
            const validPlayers = team.filter(
                (player) => player && typeof player === 'string' && player.trim().length > 0
            );

            // Generate all unique pairs within the team
            for (let i = 0; i < validPlayers.length; i++) {
                for (let j = i + 1; j < validPlayers.length; j++) {
                    // Sort pair to ensure consistent ordering (A,B) same as (B,A)
                    const pair = [validPlayers[i], validPlayers[j]].sort();
                    pairs.push(pair);
                }
            }
        });

        return pairs;
    }

    /**
     * Build teammate history matrix from recent sessions
     * @param {string} leagueId - League identifier
     * @param {number} sessionLimit - Maximum number of recent sessions to include (default: 12)
     * @returns {Promise<Object>} Teammate history data
     */
    async buildTeammateHistory(leagueId, sessionLimit = 10) {
        const sessionFiles = await this.getSessionFiles(leagueId);
        const allPlayers = new Set();
        const pairCounts = new Map();

        // Process sessions, counting only those with actual teams toward the limit
        let sessionsWithTeams = 0;
        for (const filePath of sessionFiles) {
            if (sessionsWithTeams >= sessionLimit) break;

            const sessionData = await this.loadSessionData(filePath);
            if (!sessionData) continue;

            const pairs = this.extractTeammatePairs(sessionData);
            if (pairs.length === 0) continue; // skip sessions with no teams

            sessionsWithTeams++;

            // Track all unique players
            pairs.forEach(([player1, player2]) => {
                allPlayers.add(player1);
                allPlayers.add(player2);

                // Create pair key (sorted for consistency)
                const pairKey = `${player1}|${player2}`;
                pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
            });
        }

        // Convert to sorted array for consistent indexing
        const playerList = Array.from(allPlayers).sort();
        const playerCount = playerList.length;

        // Create PxP matrix
        const matrix = Array(playerCount)
            .fill(null)
            .map(() => Array(playerCount).fill(0));

        // Fill matrix with pair counts
        pairCounts.forEach((count, pairKey) => {
            const [player1, player2] = pairKey.split('|');
            const index1 = playerList.indexOf(player1);
            const index2 = playerList.indexOf(player2);

            // Check if both indices are valid
            if (index1 >= 0 && index2 >= 0 && index1 < playerCount && index2 < playerCount) {
                // Matrix is symmetric - set both [i][j] and [j][i]
                matrix[index1][index2] = count;
                matrix[index2][index1] = count;
            }
        });

        return {
            leagueId,
            players: playerList,
            matrix,
            totalSessions: sessionsWithTeams,
            lastUpdated: new Date().toISOString(),
            metadata: {
                totalPlayers: playerCount,
                totalUniquePairs: pairCounts.size,
                maxPairings: pairCounts.size > 0 ? Math.max(...pairCounts.values()) : 0
            }
        };
    }

    /**
     * Save teammate history to file
     * @param {string} leagueId - League identifier
     * @param {Object} historyData - Teammate history data
     */
    async saveTeammateHistory(leagueId, historyData) {
        const filePath = join(this.leagueDataPath, leagueId, 'teammate-history.json');
        await writeFile(filePath, JSON.stringify(historyData, null, 2));
    }

    /**
     * Update teammate history for a league (main function)
     * @param {string} leagueId - League identifier
     * @param {number} sessionLimit - Maximum number of recent sessions to include (default: 12)
     * @returns {Promise<{historyData: Object}>} Updated history data
     */
    async updateTeammateHistory(leagueId, sessionLimit = 10) {
        const historyData = await this.buildTeammateHistory(leagueId, sessionLimit);
        await this.saveTeammateHistory(leagueId, historyData);
        return { historyData };
    }
}

/**
 * Create a new TeammateHistoryTracker instance
 * @returns {TeammateHistoryTracker}
 */
export function createTeammateHistoryTracker() {
    return new TeammateHistoryTracker();
}

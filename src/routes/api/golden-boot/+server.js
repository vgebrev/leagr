import { json } from '@sveltejs/kit';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { getLeagueDataPath } from '$lib/server/league.js';
import { MIN_YEAR, MAX_YEAR } from '$lib/shared/yearConfig.js';

/**
 * Extract goals from a scorers object
 * @param {Object|null} scorers - Scorer object { "PlayerName": goalCount, ... }
 * @param {Object} totals - Accumulated goals object to update
 * @param {'league'|'cup'} type - Type of goals (league or cup)
 */
function extractGoals(scorers, totals, type) {
    if (!scorers || typeof scorers !== 'object') return;

    for (const [player, goals] of Object.entries(scorers)) {
        // Skip reserved keys like __ownGoal__ and __unassigned__
        if (player.startsWith('__') && player.endsWith('__')) continue;

        const goalCount = typeof goals === 'number' && goals > 0 ? goals : 0;
        if (goalCount === 0) continue;

        if (!totals[player]) {
            totals[player] = { leagueGoals: 0, cupGoals: 0 };
        }

        if (type === 'league') {
            totals[player].leagueGoals += goalCount;
        } else {
            totals[player].cupGoals += goalCount;
        }
    }
}

/**
 * Process a single session file and extract goal data
 * @param {string} filePath - Path to session file
 * @param {Object} totals - Accumulated goals object to update
 */
async function processSessionFile(filePath, totals) {
    try {
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        // Process league games (rounds)
        if (data.games?.rounds && Array.isArray(data.games.rounds)) {
            for (const round of data.games.rounds) {
                if (!Array.isArray(round)) continue;
                for (const match of round) {
                    if (match.bye) continue;
                    extractGoals(match.homeScorers, totals, 'league');
                    extractGoals(match.awayScorers, totals, 'league');
                }
            }
        }

        // Process knockout cup games
        if (
            data.games?.['knockout-games']?.bracket &&
            Array.isArray(data.games['knockout-games'].bracket)
        ) {
            for (const match of data.games['knockout-games'].bracket) {
                if (match.bye) continue;
                extractGoals(match.homeScorers, totals, 'cup');
                extractGoals(match.awayScorers, totals, 'cup');
            }
        }
    } catch {
        // File doesn't exist or is invalid, skip it
    }
}

/**
 * Get all session dates for a specific year
 * @param {string} dataPath - League data directory path
 * @param {number} year - Year to filter by
 * @returns {Promise<string[]>} - Array of session file paths
 */
async function getSessionFilesForYear(dataPath, year) {
    try {
        const files = await readdir(dataPath);
        const pattern = new RegExp(`^${year}-\\d{2}-\\d{2}\\.json$`);
        return files.filter((file) => pattern.test(file)).map((file) => join(dataPath, file));
    } catch {
        return [];
    }
}

/**
 * GET /api/golden-boot - Get golden boot (top scorers) data
 * Query params:
 *   - year=YYYY to get scorers for a specific year, or year=all to aggregate all years (default: current year)
 */
export async function GET({ locals, url }) {
    try {
        const leagueId = locals.leagueId;

        if (!leagueId) {
            return json({ error: 'League ID is required' }, { status: 400 });
        }

        const yearParam = url.searchParams.get('year');
        const dataPath = getLeagueDataPath(leagueId);

        const totals = {};

        // Determine which years to process
        if (yearParam === 'all') {
            // Process all years
            for (let year = MIN_YEAR; year <= MAX_YEAR; year++) {
                const sessionFiles = await getSessionFilesForYear(dataPath, year);
                for (const filePath of sessionFiles) {
                    await processSessionFile(filePath, totals);
                }
            }
        } else {
            // Process specific year (default to current year)
            const year = yearParam ? parseInt(yearParam, 10) : new Date().getFullYear();
            const sessionFiles = await getSessionFilesForYear(dataPath, year);
            for (const filePath of sessionFiles) {
                await processSessionFile(filePath, totals);
            }
        }

        // Convert to sorted array
        const scorers = Object.entries(totals)
            .map(([playerName, goals]) => ({
                playerName,
                leagueGoals: goals.leagueGoals,
                cupGoals: goals.cupGoals,
                totalGoals: goals.leagueGoals + goals.cupGoals
            }))
            .filter((scorer) => scorer.totalGoals > 0)
            .sort((a, b) => {
                // Sort by total goals first, then league goals, then cup goals
                if (b.totalGoals !== a.totalGoals) {
                    return b.totalGoals - a.totalGoals;
                }
                if (b.leagueGoals !== a.leagueGoals) {
                    return b.leagueGoals - a.leagueGoals;
                }
                return b.cupGoals - a.cupGoals;
            });

        return json({ scorers });
    } catch (error) {
        console.error('Error loading golden boot data:', error);
        return json(
            {
                error: 'Failed to load golden boot data',
                details: error.message
            },
            { status: 500 }
        );
    }
}

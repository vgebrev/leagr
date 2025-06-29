import fs from 'fs/promises';
import path from 'path';

const dataPath = path.join(process.cwd(), 'data');
const rankingsPath = path.join(dataPath, 'rankings.json');
const BONUS_MULTIPLIER = 2;

// Hybrid ranking algorithm configuration
const CONFIDENCE_FRACTION = 0.66; // Full confidence at 66% of max appearances
const PULL_STRENGTH = 1.0; // Multiplier for proportional pull below threshold

async function loadRankings() {
    try {
        const raw = await fs.readFile(rankingsPath, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return {
            lastUpdated: null,
            calculatedDates: [],
            players: {}
        };
    }
}

async function saveRankings(rankings) {
    await fs.writeFile(rankingsPath, JSON.stringify(rankings, null, 2));
}

function getMatchResults(rounds) {
    const results = [];
    for (const round of rounds) {
        for (const game of round) {
            const { home, away, homeScore, awayScore } = game;
            if (homeScore != null && awayScore != null) {
                results.push({ home, away, homeScore, awayScore });
            }
        }
    }
    return results;
}

function getTeamStats(teamNames, results) {
    const stats = {};

    for (const name of teamNames) {
        stats[name] = { points: 0, gf: 0, ga: 0 };
    }

    for (const { home, away, homeScore, awayScore } of results) {
        // Points
        if (homeScore > awayScore) {
            stats[home].points += 3;
        } else if (homeScore < awayScore) {
            stats[away].points += 3;
        } else {
            stats[home].points += 1;
            stats[away].points += 1;
        }

        // Goals
        stats[home].gf += homeScore;
        stats[home].ga += awayScore;

        stats[away].gf += awayScore;
        stats[away].ga += homeScore;
    }

    return stats;
}

function getStandings(teamNames, results) {
    const stats = getTeamStats(teamNames, results);

    const ranked = teamNames.map((name) => ({
        name,
        ...stats[name],
        gd: stats[name].gf - stats[name].ga
    }));

    ranked.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.gd !== a.gd) return b.gd - a.gd;
        return b.gf - a.gf;
    });

    const standings = {};
    ranked.forEach((entry, index) => {
        standings[entry.name] = index;
    });

    return standings;
}

/**
 * Apply hybrid ranking algorithm to raw player data
 * @param {Object} rawRankings - Rankings with basic points/appearances
 * @returns {Object} Enhanced rankings with calculated fields
 */
function calculateEnhancedRankings(rawRankings) {
    if (!rawRankings || !rawRankings.players || Object.keys(rawRankings.players).length === 0) {
        return {
            ...rawRankings,
            players: {},
            rankingMetadata: {
                globalAverage: 0,
                minAverage: 0,
                maxAppearances: 0,
                confidenceThreshold: 0,
                lastCalculated: new Date().toISOString()
            }
        };
    }

    // Step 1: Calculate global statistics
    let totalPoints = 0;
    let totalAppearances = 0;
    let maxAppearances = 0;
    const allAverages = [];

    Object.values(rawRankings.players).forEach((player) => {
        totalPoints += player.points;
        totalAppearances += player.appearances;
        maxAppearances = Math.max(maxAppearances, player.appearances);
        allAverages.push(player.points / player.appearances);
    });

    const globalAverage = totalPoints / totalAppearances;
    const minAverage = Math.min(...allAverages);
    const confidenceThreshold = Math.max(1, Math.round(maxAppearances * CONFIDENCE_FRACTION));

    // Step 2: Calculate enhanced player data
    const enhancedPlayers = {};

    Object.entries(rawRankings.players).forEach(([name, data]) => {
        const rawAverage = data.points / data.appearances;

        let weightedAverage, pullFactor, hasFullConfidence;

        if (data.appearances >= confidenceThreshold) {
            // Above threshold: full confidence (no pull)
            weightedAverage = rawAverage;
            pullFactor = 0;
            hasFullConfidence = true;
        } else {
            // Below threshold: proportional pull toward minimum
            const gamesNeeded = confidenceThreshold - data.appearances;
            pullFactor = (gamesNeeded / confidenceThreshold) * PULL_STRENGTH;

            // Clamp pullFactor between 0 and 1
            pullFactor = Math.max(0, Math.min(1, pullFactor));

            // Apply proportional pull toward minimum
            weightedAverage = rawAverage - pullFactor * (rawAverage - minAverage);
            hasFullConfidence = false;
        }

        // Calculate ranking points (weighted average * max appearances)
        const rankingPoints = weightedAverage * maxAppearances;

        enhancedPlayers[name] = {
            // Original data
            points: data.points,
            appearances: data.appearances,

            // Calculated averages
            rawAverage: parseFloat(rawAverage.toFixed(2)),
            weightedAverage: parseFloat(weightedAverage.toFixed(2)),

            // New ranking points (primary ranking metric)
            rankingPoints: parseFloat(rankingPoints.toFixed(1)),

            // Metadata for transparency
            pullFactor: parseFloat(pullFactor.toFixed(3)),
            hasFullConfidence: hasFullConfidence,
            gamesUntilFullConfidence: hasFullConfidence ? 0 : confidenceThreshold - data.appearances
        };
    });

    // Step 3: Add ranking positions
    const playersArray = Object.entries(enhancedPlayers);

    // Sort by ranking points (descending)
    playersArray.sort((a, b) => b[1].rankingPoints - a[1].rankingPoints);

    // Add rank positions
    playersArray.forEach(([name, playerData], index) => {
        enhancedPlayers[name].rank = index + 1;
    });

    return {
        ...rawRankings,
        players: enhancedPlayers,
        rankingMetadata: {
            globalAverage: parseFloat(globalAverage.toFixed(2)),
            minAverage: parseFloat(minAverage.toFixed(2)),
            maxAppearances: maxAppearances,
            confidenceThreshold: confidenceThreshold,
            confidenceFraction: CONFIDENCE_FRACTION,
            pullStrength: PULL_STRENGTH,
            totalPlayers: Object.keys(enhancedPlayers).length,
            lastCalculated: new Date().toISOString()
        }
    };
}

async function updateRankings() {
    const files = await fs.readdir(dataPath);
    const dateFiles = files.filter((f) => /^\d{4}-\d{2}-\d{2}\.json$/.test(f));

    const rankings = await loadRankings();

    for (const file of dateFiles) {
        const date = file.replace('.json', '');
        if (rankings.calculatedDates.includes(date)) continue;

        const raw = await fs.readFile(path.join(dataPath, file), 'utf-8');
        const { teams, games } = JSON.parse(raw);

        const teamEntries = Object.entries(teams?.teams ?? {});
        const rounds = games?.rounds ?? [];
        if (!teamEntries.length || !rounds.length) continue;

        const teamNames = teamEntries.map(([name]) => name);
        const results = getMatchResults(rounds);
        const teamStats = getTeamStats(teamNames, results);
        const standings = getStandings(teamNames, results);

        for (const [teamName, players] of teamEntries) {
            const matchPoints = teamStats[teamName].points;
            const bonusPoints = (teamNames.length - standings[teamName]) * BONUS_MULTIPLIER;

            for (const player of players) {
                if (!player) continue;

                if (!rankings.players[player]) {
                    rankings.players[player] = { points: 0, appearances: 0 };
                }

                rankings.players[player].points += 1; // attendance
                rankings.players[player].points += matchPoints;
                rankings.players[player].points += bonusPoints;
                rankings.players[player].appearances += 1;
            }
        }

        rankings.calculatedDates.push(date);
        rankings.lastUpdated = date;
    }

    // Apply hybrid ranking algorithm to the raw data
    const enhancedRankings = calculateEnhancedRankings(rankings);

    await saveRankings(enhancedRankings);
    return enhancedRankings;
}

/**
 * Load rankings and ensure they have enhanced data
 */
async function loadEnhancedRankings() {
    const rawRankings = await loadRankings();

    // Check if rankings already have enhanced data
    if (rawRankings.rankingMetadata && rawRankings.players) {
        const firstPlayer = Object.values(rawRankings.players)[0];
        if (firstPlayer && typeof firstPlayer.rankingPoints === 'number') {
            // Already enhanced, return as-is
            return rawRankings;
        }
    }

    // Need to enhance the raw data
    return calculateEnhancedRankings(rawRankings);
}

/**
 * Get players data suitable for team generation
 */
async function getPlayersForTeamGeneration() {
    const enhancedRankings = await loadEnhancedRankings();

    if (!enhancedRankings.players) {
        return {
            players: [],
            metadata: enhancedRankings.rankingMetadata || {}
        };
    }

    const players = Object.entries(enhancedRankings.players).map(([name, data]) => ({
        name: name,
        rankingPoints: data.rankingPoints,
        weightedAverage: data.weightedAverage,
        appearances: data.appearances,
        hasFullConfidence: data.hasFullConfidence,
        rank: data.rank
    }));

    // Sort by ranking points for consistency
    players.sort((a, b) => b.rankingPoints - a.rankingPoints);

    return {
        players: players,
        metadata: enhancedRankings.rankingMetadata
    };
}

export const rankings = {
    loadRankings,
    loadEnhancedRankings,
    updateRankings,
    getPlayersForTeamGeneration,
    calculateEnhancedRankings
};

// Export configuration for easy tuning
export const rankingConfig = {
    CONFIDENCE_FRACTION,
    PULL_STRENGTH,
    BONUS_MULTIPLIER
};

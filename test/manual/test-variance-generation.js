#!/usr/bin/env node
/* eslint-disable no-console */

import { readFile } from 'fs/promises';

// Import with relative paths to avoid module resolution issues
import { nouns } from '../../src/lib/shared/nouns.js';
import { teamColours } from '../../src/lib/shared/helpers.js';

// Inline the TeamGenerator class to avoid import issues
class TeamGenerator {
    constructor() {
        this.settings = null;
        this.players = [];
        this.rankings = null;
        this.recordHistory = false;
        this.drawHistory = [];
        this.initialPots = [];
        this.teammateHistory = null;
    }

    setSettings(settings) {
        this.settings = settings;
        return this;
    }

    setPlayers(players) {
        this.players = players;
        return this;
    }

    setRankings(rankings) {
        this.rankings = rankings;
        return this;
    }

    setTeammateHistory(teammateHistory) {
        this.teammateHistory = teammateHistory;
        return this;
    }

    setHistoryRecording(enabled) {
        this.recordHistory = enabled;
        this.drawHistory = [];
        this.initialPots = [];
        return this;
    }

    calculateTeamEloAverages(teams) {
        const defaultElo = 1000;
        const teamAverages = [];

        Object.values(teams).forEach((teamPlayers) => {
            const teamEloSum = teamPlayers.reduce((sum, playerName) => {
                const playerRanking = this.rankings?.players?.[playerName];
                const playerElo = playerRanking?.elo?.rating ?? defaultElo;
                return sum + playerElo;
            }, 0);

            teamAverages.push(teamPlayers.length > 0 ? teamEloSum / teamPlayers.length : 0);
        });

        return teamAverages;
    }

    calculateEloDelta(teamEloAverages) {
        if (teamEloAverages.length === 0) return 0;
        const maxElo = Math.max(...teamEloAverages);
        const minElo = Math.min(...teamEloAverages);
        return maxElo - minElo;
    }

    extractTeammatePairs(teams) {
        const pairs = [];

        Object.values(teams).forEach((team) => {
            if (!Array.isArray(team)) return;

            // Generate all unique pairs within each team
            for (let i = 0; i < team.length; i++) {
                for (let j = i + 1; j < team.length; j++) {
                    // Sort pair for consistent lookup
                    const pair = [team[i], team[j]].sort();
                    pairs.push(pair);
                }
            }
        });

        return pairs;
    }

    calculatePairingPenalty(teams) {
        if (!this.teammateHistory) {
            return 0; // No score if no history available
        }

        const pairs = this.extractTeammatePairs(teams);
        let totalScore = 0;

        pairs.forEach(([player1, player2]) => {
            const index1 = this.teammateHistory.players.indexOf(player1);
            const index2 = this.teammateHistory.players.indexOf(player2);

            if (index1 >= 0 && index2 >= 0) {
                // Get pairing count from history matrix
                const pairingCount = this.teammateHistory.matrix[index1][index2];

                if (pairingCount === 0) {
                    totalScore -= 2; // Reward for a new pair
                } else if (pairingCount === 1) {
                    totalScore -= 1; // Lesser reward for a rare pair
                } else {
                    // Apply exponential penalty for frequent pairs: 2→4, 3→9, 4→16, etc.
                    totalScore += Math.pow(pairingCount, 2);
                }
            } else {
                // If players not in history, it's a new pair
                totalScore -= 2;
            }
        });

        return totalScore;
    }

    generateTeamNames(count) {
        const usedNouns = new Set();
        const teamNames = [];

        const colorSlice = teamColours.slice(0, count);
        const shuffledColours = colorSlice.sort(() => Math.random() - 0.5);

        for (let i = 0; i < count; i++) {
            let noun;
            let attempts = 0;

            // Find a unique noun, fallback to index-based if all nouns used
            do {
                noun = nouns[Math.floor(Math.random() * nouns.length)];
                attempts++;
            } while (usedNouns.has(noun) && attempts < 50);

            usedNouns.add(noun);
            const color = shuffledColours[i % shuffledColours.length];
            teamNames.push(`${color} ${noun}`);
        }

        return teamNames;
    }

    // Simple seeded generation for testing (without iteration complexity)
    generateSeededTeams(config) {
        if (!this.players.length) {
            throw new Error('No players available for team generation');
        }

        const teamSizes = config.teamSizes;
        const numTeams = teamSizes.length;
        const teamNames = this.generateTeamNames(numTeams);
        const defaultElo = 1000;

        // Sort players by ELO rating
        const sortedPlayers = [...this.players].sort((a, b) => {
            const playerA = this.rankings?.players?.[a];
            const playerB = this.rankings?.players?.[b];

            const eloA = playerA?.elo?.rating ?? defaultElo;
            const eloB = playerB?.elo?.rating ?? defaultElo;

            return eloB - eloA;
        });

        // Test both approaches
        const maxIterations = this.teammateHistory ? 25 : 1;
        const varianceWeight = 5;

        let bestTeams = null;
        let bestScore = Infinity;

        for (let iteration = 0; iteration < maxIterations; iteration++) {
            const teams = {};

            // Initialize teams
            for (let i = 0; i < numTeams; i++) {
                teams[teamNames[i]] = [];
            }

            // Simple round-robin distribution with randomization
            let playerIndex = 0;
            const shuffledPlayers = [...sortedPlayers].sort(() => Math.random() - 0.5);

            // Distribute players
            for (let round = 0; round < Math.max(...teamSizes); round++) {
                for (
                    let teamIndex = 0;
                    teamIndex < numTeams && playerIndex < shuffledPlayers.length;
                    teamIndex++
                ) {
                    const teamName = teamNames[teamIndex];
                    if (teams[teamName].length < teamSizes[teamIndex]) {
                        teams[teamName].push(shuffledPlayers[playerIndex]);
                        playerIndex++;
                    }
                }
            }

            // Score this iteration
            const teamAverages = this.calculateTeamEloAverages(teams);
            const eloDelta = this.calculateEloDelta(teamAverages);
            const pairingPenalty = this.calculatePairingPenalty(teams);
            const totalScore = eloDelta + pairingPenalty * varianceWeight;

            if (totalScore < bestScore) {
                bestScore = totalScore;
                bestTeams = JSON.parse(JSON.stringify(teams));
            }
        }

        return { teams: bestTeams };
    }

    generateTeams(method, config) {
        if (method === 'seeded') {
            return this.generateSeededTeams(config);
        }
        throw new Error('Only seeded method supported in test');
    }
}

function createTeamGenerator() {
    return new TeamGenerator();
}

/**
 * Test script for variance-conscious team generation
 */
async function testVarianceGeneration() {
    try {
        // Load teammate history from pirates league
        const historyData = JSON.parse(
            await readFile('../../data/pirates/teammate-history.json', 'utf8')
        );

        // Mock settings
        const mockSettings = {
            teamGeneration: {
                minTeams: 2,
                maxTeams: 6,
                minPlayersPerTeam: 3,
                maxPlayersPerTeam: 7
            }
        };

        // Mock rankings with ELO data (using some real pirates players)
        const mockRankings = {
            players: {
                Dan: { elo: { rating: 1200 } },
                Kat: { elo: { rating: 1180 } }, // Similar to Dan (frequent pair)
                Bobinho: { elo: { rating: 1150 } },
                Chris: { elo: { rating: 1140 } }, // Similar to Bobinho (frequent pair)
                Jonathen: { elo: { rating: 1100 } },
                Morena: { elo: { rating: 1080 } }, // Similar to Jonathen (frequent pair)
                Veli: { elo: { rating: 1050 } },
                Wayne: { elo: { rating: 1000 } },
                Angelo: { elo: { rating: 980 } },
                Hayden: { elo: { rating: 950 } },
                Luyanda: { elo: { rating: 920 } },
                Tinashe: { elo: { rating: 900 } }
            }
        };

        // Test players (12 players for 3 teams of 4)
        const testPlayers = Object.keys(mockRankings.players);
        const config = { teamSizes: [4, 4, 4] };

        console.log('=== TESTING VARIANCE-CONSCIOUS TEAM GENERATION ===\n');
        console.log(`Test players: ${testPlayers.join(', ')}`);
        console.log(
            `Configuration: ${config.teamSizes.length} teams of ${config.teamSizes.join(', ')} players\n`
        );

        // Test WITHOUT variance consideration (original approach)
        console.log('🔄 TESTING WITHOUT VARIANCE (Original Algorithm)');
        console.log('─'.repeat(60));

        const generatorOriginal = createTeamGenerator()
            .setSettings(mockSettings)
            .setPlayers(testPlayers)
            .setRankings(mockRankings);
        // No teammate history set - should behave like original

        const originalResult = generatorOriginal.generateTeams('seeded', config);

        console.log('Teams generated:');
        Object.entries(originalResult.teams).forEach(([teamName, players], index) => {
            const teamAvg = generatorOriginal.calculateTeamEloAverages({ [teamName]: players })[0];
            console.log(
                `  ${index + 1}. ${teamName}: ${players.join(', ')} (Avg ELO: ${teamAvg.toFixed(1)})`
            );
        });

        const originalEloDelta = generatorOriginal.calculateEloDelta(
            generatorOriginal.calculateTeamEloAverages(originalResult.teams)
        );
        const originalPenalty = generatorOriginal.calculatePairingPenalty(originalResult.teams);

        console.log(`ELO Delta: ${originalEloDelta.toFixed(2)}`);
        console.log(`Pairing Score: ${originalPenalty} (not considered)\n`);

        // Test WITH variance consideration
        // Artificially increase Kat + Dan pairing count to test hard constraint (3+)
        const katIndex = historyData.players.indexOf('Kat');
        const danIndex = historyData.players.indexOf('Dan');
        if (katIndex >= 0 && danIndex >= 0) {
            console.log(
                `🔧 ARTIFICIALLY INCREASING Kat + Dan pairing count to 4 for hard constraint testing`
            );
            historyData.matrix[katIndex][danIndex] = 4; // Above hard limit of 3
            historyData.matrix[danIndex][katIndex] = 4;
        }

        console.log('🎯 TESTING WITH VARIANCE (New Algorithm)');
        console.log('─'.repeat(60));

        const generatorVariance = createTeamGenerator()
            .setSettings(mockSettings)
            .setPlayers(testPlayers)
            .setRankings(mockRankings)
            .setTeammateHistory(historyData); // Enable variance consideration

        const varianceResult = generatorVariance.generateTeams('seeded', config);

        console.log('Teams generated:');
        Object.entries(varianceResult.teams).forEach(([teamName, players], index) => {
            const teamAvg = generatorVariance.calculateTeamEloAverages({ [teamName]: players })[0];
            console.log(
                `  ${index + 1}. ${teamName}: ${players.join(', ')} (Avg ELO: ${teamAvg.toFixed(1)})`
            );
        });

        const varianceEloDelta = generatorVariance.calculateEloDelta(
            generatorVariance.calculateTeamEloAverages(varianceResult.teams)
        );
        const variancePenalty = generatorVariance.calculatePairingPenalty(varianceResult.teams);
        const totalScore = varianceEloDelta + variancePenalty * 5;

        console.log(`ELO Delta: ${varianceEloDelta.toFixed(2)}`);
        console.log(
            `Pairing Score: ${variancePenalty} (rewards fresh pairs, penalizes frequent ones)`
        );
        console.log(
            `Total Score: ${totalScore.toFixed(2)} (${varianceEloDelta.toFixed(2)} + ${(variancePenalty * 5).toFixed(2)})\n`
        );

        // Analyze pairing frequencies in generated teams
        console.log('📊 PAIRING ANALYSIS');
        console.log('─'.repeat(60));

        const variancePairs = generatorVariance.extractTeammatePairs(varianceResult.teams);
        console.log('Pairs in variance-conscious teams:');
        variancePairs.forEach(([p1, p2]) => {
            const index1 = historyData.players.indexOf(p1);
            const index2 = historyData.players.indexOf(p2);
            const histCount = index1 >= 0 && index2 >= 0 ? historyData.matrix[index1][index2] : 0;
            console.log(`  ${p1} & ${p2}: ${histCount} previous pairings`);
        });

        console.log('\n✅ Variance-conscious generation test complete!');
    } catch (error) {
        console.error('Error testing variance generation:', error);
        process.exit(1);
    }
}

testVarianceGeneration();

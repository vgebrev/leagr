#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Analyze team generation balance and competitiveness across all Pirates league sessions.
 */

import fs from 'fs';
import path from 'path';

function loadSession(filepath) {
    const data = fs.readFileSync(filepath, 'utf-8');
    return JSON.parse(data);
}

function calculateLeagueStandings(sessionData) {
    const games = sessionData.games || {};
    const rounds = games.rounds || [];
    const teamsData = sessionData.teams || {};
    const teamNames = Object.keys(teamsData);

    // Initialize stats
    const stats = {};
    for (const name of teamNames) {
        stats[name] = { points: 0, gf: 0, ga: 0, w: 0, d: 0, l: 0 };
    }

    // Process matches
    for (const roundGames of rounds) {
        for (const game of roundGames) {
            const { home, away, homeScore, awayScore } = game;

            if (homeScore === null || awayScore === null) continue;
            if (!stats[home] || !stats[away]) continue;

            stats[home].gf += homeScore;
            stats[home].ga += awayScore;
            stats[away].gf += awayScore;
            stats[away].ga += homeScore;

            if (homeScore > awayScore) {
                stats[home].points += 3;
                stats[home].w += 1;
                stats[away].l += 1;
            } else if (homeScore < awayScore) {
                stats[away].points += 3;
                stats[away].w += 1;
                stats[home].l += 1;
            } else {
                stats[home].points += 1;
                stats[away].points += 1;
                stats[home].d += 1;
                stats[away].d += 1;
            }
        }
    }

    // Sort by points, then goal difference
    const sortedTeams = Object.entries(stats).sort((a, b) => {
        const pointsDiff = b[1].points - a[1].points;
        if (pointsDiff !== 0) return pointsDiff;
        return b[1].gf - b[1].ga - (a[1].gf - a[1].ga);
    });

    return { sortedTeams, stats };
}

function calculateTeamEloAverage(teamPlayers, pots) {
    const playerElos = {};
    for (const pot of pots) {
        for (const player of pot.players) {
            playerElos[player.name] = player.elo;
        }
    }

    const totalElo = teamPlayers.reduce((sum, p) => sum + (playerElos[p] || 1000), 0);
    return teamPlayers.length > 0 ? totalElo / teamPlayers.length : 1000;
}

function stdDev(values) {
    if (values.length <= 1) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((v) => Math.pow(v - mean, 2));
    const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(variance);
}

function analyzeSession(filepath) {
    const sessionData = loadSession(filepath);
    const date = path.basename(filepath, '.json');

    // Get draw history if available
    const drawHistory = sessionData.drawHistory || {};
    const pots = drawHistory.initialPots || [];

    // Calculate league standings
    const { sortedTeams: standings } = calculateLeagueStandings(sessionData);

    if (!standings || standings.length < 2) return null;

    // Calculate competitiveness metrics
    const pointsList = standings.map((team) => team[1].points);
    const gdList = standings.map((team) => team[1].gf - team[1].ga);

    const result = {
        date,
        numTeams: standings.length,
        firstPlace: standings[0][0],
        firstPoints: standings[0][1].points,
        firstGd: standings[0][1].gf - standings[0][1].ga,
        lastPlace: standings[standings.length - 1][0],
        lastPoints: standings[standings.length - 1][1].points,
        lastGd: standings[standings.length - 1][1].gf - standings[standings.length - 1][1].ga,
        pointsRange: Math.max(...pointsList) - Math.min(...pointsList),
        pointsStd: stdDev(pointsList),
        gdRange: Math.max(...gdList) - Math.min(...gdList),
        gdStd: stdDev(gdList),
        standings
    };

    // Calculate ELO averages if pots available
    if (pots.length > 0) {
        const teamsData = sessionData.teams || {};
        const teamElos = {};
        for (const [teamName, players] of Object.entries(teamsData)) {
            teamElos[teamName] = calculateTeamEloAverage(players, pots);
        }

        const eloValues = Object.values(teamElos);
        result.teamElos = teamElos;
        result.eloRange =
            eloValues.length > 0 ? Math.max(...eloValues) - Math.min(...eloValues) : 0;
        result.eloStd = stdDev(eloValues);
    }

    return result;
}

function main() {
    const dataDir = 'data/pirates';
    const files = fs
        .readdirSync(dataDir)
        .filter((f) => f.match(/^2025-.*\.json$/))
        .sort();

    console.log('='.repeat(80));
    console.log('PIRATES LEAGUE COMPETITIVENESS ANALYSIS - 2025 SEASON');
    console.log('='.repeat(80));
    console.log();

    const allResults = [];
    const dominationSessions = [];
    const weakTeamSessions = [];

    for (const file of files) {
        const filepath = path.join(dataDir, file);
        const result = analyzeSession(filepath);
        if (!result) continue;

        allResults.push(result);

        // Identify problematic sessions
        if (result.numTeams === 4) {
            const avgPoints = result.standings.reduce((sum, t) => sum + t[1].points, 0) / 4;
            const secondPoints = result.standings[1][1].points;
            const firstMargin = result.firstPoints - secondPoints;

            if (firstMargin >= 6 || result.firstPoints > avgPoints * 1.4) {
                dominationSessions.push(result);
            }

            if (result.lastPoints <= 3 || result.lastGd <= -5) {
                weakTeamSessions.push(result);
            }
        }
    }

    // Summary statistics
    console.log(`Total sessions analyzed: ${allResults.length}`);
    console.log(
        `Sessions with runaway winner: ${dominationSessions.length} (${((dominationSessions.length / allResults.length) * 100).toFixed(1)}%)`
    );
    console.log(
        `Sessions with dominated bottom team: ${weakTeamSessions.length} (${((weakTeamSessions.length / allResults.length) * 100).toFixed(1)}%)`
    );
    console.log();

    // Overall metrics
    if (allResults.length > 0) {
        const avgPointsRange =
            allResults.reduce((sum, r) => sum + r.pointsRange, 0) / allResults.length;
        const avgPointsStd =
            allResults.reduce((sum, r) => sum + r.pointsStd, 0) / allResults.length;
        const avgGdRange = allResults.reduce((sum, r) => sum + r.gdRange, 0) / allResults.length;
        const eloRangeResults = allResults.filter((r) => 'eloRange' in r);
        const avgEloRange =
            eloRangeResults.length > 0
                ? eloRangeResults.reduce((sum, r) => sum + r.eloRange, 0) / eloRangeResults.length
                : 0;

        console.log('AVERAGE METRICS ACROSS ALL SESSIONS:');
        console.log(`  Points range (max-min): ${avgPointsRange.toFixed(1)}`);
        console.log(`  Points std dev: ${avgPointsStd.toFixed(1)}`);
        console.log(`  Goal difference range: ${avgGdRange.toFixed(1)}`);
        console.log(`  Team ELO range at generation: ${avgEloRange.toFixed(1)}`);
        console.log();
    }

    // Show worst balance cases
    console.log('='.repeat(80));
    console.log('TOP 10 MOST UNBALANCED SESSIONS (by points range):');
    console.log('='.repeat(80));
    const worstSessions = allResults.sort((a, b) => b.pointsRange - a.pointsRange).slice(0, 10);

    worstSessions.forEach((session, i) => {
        console.log(`\n${i + 1}. ${session.date}`);
        console.log(`   Points range: ${session.pointsRange} | GD range: ${session.gdRange}`);
        if ('eloRange' in session) {
            console.log(`   Initial ELO range: ${session.eloRange.toFixed(1)}`);
        }
        console.log(`   Final standings:`);
        session.standings.forEach(([team, stats], j) => {
            const eloStr =
                'teamElos' in session ? ` (ELO: ${session.teamElos[team].toFixed(0)})` : '';
            const gd = stats.gf - stats.ga;
            console.log(
                `     ${j + 1}. ${team}: ${stats.points} pts (${stats.w}-${stats.d}-${stats.l}) GD: ${gd >= 0 ? '+' : ''}${gd}${eloStr}`
            );
        });
    });

    console.log('\n' + '='.repeat(80));
    console.log('ANALYSIS OF PROBLEMATIC PATTERNS:');
    console.log('='.repeat(80));

    // Analyze ELO ranges in unbalanced sessions
    if (worstSessions.length > 0) {
        const eloRangesWorst = worstSessions.filter((s) => 'eloRange' in s).map((s) => s.eloRange);
        const eloRangesAll = allResults.filter((s) => 'eloRange' in s).map((s) => s.eloRange);

        if (eloRangesWorst.length > 0 && eloRangesAll.length > 0) {
            const avgWorst = eloRangesWorst.reduce((a, b) => a + b, 0) / eloRangesWorst.length;
            const avgAll = eloRangesAll.reduce((a, b) => a + b, 0) / eloRangesAll.length;
            console.log(`\nELO Range Comparison:`);
            console.log(`  Worst 10 sessions avg ELO range: ${avgWorst.toFixed(1)}`);
            console.log(`  All sessions avg ELO range: ${avgAll.toFixed(1)}`);
            console.log(`  Ratio: ${(avgWorst / avgAll).toFixed(2)}x`);
        }
    }

    // Detailed analysis of most recent sessions
    console.log('\n' + '='.repeat(80));
    console.log('LAST 5 SESSIONS DETAILED BREAKDOWN:');
    console.log('='.repeat(80));

    allResults.slice(-5).forEach((session) => {
        console.log(`\n${session.date}:`);
        console.log(
            `  Competitiveness: Points range=${session.pointsRange}, GD range=${session.gdRange}`
        );
        if ('teamElos' in session) {
            console.log(`  Initial team ELOs:`);
            Object.entries(session.teamElos)
                .sort((a, b) => b[1] - a[1])
                .forEach(([team, elo]) => {
                    console.log(`    ${team}: ${elo.toFixed(1)}`);
                });
        }
        console.log(`  Final standings:`);
        session.standings.forEach(([team, stats], j) => {
            const gd = stats.gf - stats.ga;
            console.log(
                `    ${j + 1}. ${team}: ${stats.points} pts (${stats.w}-${stats.d}-${stats.l}) GD: ${gd >= 0 ? '+' : ''}${gd}`
            );
        });
    });
}

main();

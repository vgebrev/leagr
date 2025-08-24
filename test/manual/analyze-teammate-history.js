#!/usr/bin/env node
/* eslint-disable no-console */

import { createTeammateHistoryTracker } from '../../src/lib/server/teammateHistory.js';
import { join } from 'path';
import { writeFile } from 'fs/promises';

/**
 * Generate a report of all player pairings ordered by frequency
 * @param {Object} historyData - Teammate history data
 * @returns {Array} Sorted array of pairing reports
 */
function generatePairingReport(historyData) {
    const { players, matrix } = historyData;
    const pairings = [];

    // Extract all pairings from matrix (avoiding duplicates)
    for (let i = 0; i < players.length; i++) {
        for (let j = i + 1; j < players.length; j++) {
            const count = matrix[i][j];
            pairings.push({
                player1: players[i],
                player2: players[j],
                timesPaired: count,
                pairKey: `${players[i]} & ${players[j]}`
            });
        }
    }

    // Sort by frequency (descending) then alphabetically by pair key
    return pairings.sort((a, b) => {
        if (a.timesPaired !== b.timesPaired) {
            return b.timesPaired - a.timesPaired;
        }
        return a.pairKey.localeCompare(b.pairKey);
    });
}

/**
 * Print pairing report to console
 * @param {Array} pairingReport - Array of pairing data
 * @param {number} limit - Maximum number of pairings to show (default: all)
 */
function printPairingReport(pairingReport, limit = null) {
    console.log('\n=== TEAMMATE PAIRING REPORT ===');
    console.log('(Ordered by frequency, descending)\n');

    const itemsToShow = limit ? pairingReport.slice(0, limit) : pairingReport;

    itemsToShow.forEach((pairing, index) => {
        console.log(
            `${(index + 1).toString().padStart(3)}: ${pairing.pairKey.padEnd(30)} - ${pairing.timesPaired} times`
        );
    });

    if (limit && pairingReport.length > limit) {
        console.log(`\n... and ${pairingReport.length - limit} more pairings`);
    }

    console.log(`\nTotal unique pairings: ${pairingReport.length}`);
}

/**
 * Generate comprehensive pairing report file
 * @param {Object} historyData - Teammate history data
 * @param {Array} pairingReport - Array of pairing data
 */
async function generatePairingReportFile(historyData, pairingReport) {
    const filePath = join('data', historyData.leagueId, 'pairing-report.txt');

    // Calculate statistics
    const pairCounts = pairingReport.map((p) => p.timesPaired);
    const averagePairings = pairCounts.reduce((sum, count) => sum + count, 0) / pairCounts.length;
    const variance =
        pairCounts.reduce((sum, count) => sum + Math.pow(count - averagePairings, 2), 0) /
        pairCounts.length;
    const stdDev = Math.sqrt(variance);

    // Calculate distribution
    const distribution = {};
    pairCounts.forEach((count) => {
        distribution[count] = (distribution[count] || 0) + 1;
    });

    // Generate report content
    const reportContent = [
        '='.repeat(80),
        '                    TEAMMATE PAIRING ANALYSIS REPORT',
        `                           ${historyData.leagueId.toUpperCase()} LEAGUE`,
        '='.repeat(80),
        '',
        `Analysis Date: ${new Date(historyData.lastUpdated).toLocaleString()}`,
        `Data Period: ${historyData.totalSessions} sessions analyzed`,
        '',
        '📊 SUMMARY STATISTICS',
        '─'.repeat(50),
        `Total Players: ${historyData.metadata.totalPlayers}`,
        `Total Sessions: ${historyData.totalSessions}`,
        `Possible Player Pairs: ${(historyData.players.length * (historyData.players.length - 1)) / 2}`,
        `Actual Pairings: ${historyData.metadata.totalUniquePairs}`,
        `Maximum Pairings (any pair): ${historyData.metadata.maxPairings}`,
        '',
        '📈 PAIRING VARIANCE ANALYSIS',
        '─'.repeat(50),
        `Average pairings per pair: ${averagePairings.toFixed(2)}`,
        `Standard deviation: ${stdDev.toFixed(2)}`,
        `Variance: ${variance.toFixed(2)}`,
        '',
        '📋 FREQUENCY DISTRIBUTION',
        '─'.repeat(50)
    ];

    // Add distribution data
    Object.keys(distribution)
        .map(Number)
        .sort((a, b) => b - a)
        .forEach((count) => {
            const frequency = distribution[count];
            const percentage = ((frequency / pairCounts.length) * 100).toFixed(1);
            const bar = '█'.repeat(Math.floor(percentage / 2)); // Visual bar
            reportContent.push(
                `${count} pairings: ${frequency.toString().padStart(4)} pairs (${percentage.padStart(5)}%) ${bar}`
            );
        });

    reportContent.push('');
    reportContent.push('🔍 KEY FINDINGS');
    reportContent.push('─'.repeat(50));

    // Add insights
    const neverPaired = distribution[0] || 0;
    const pairedOnce = distribution[1] || 0;
    const frequentPairs = pairCounts.filter((count) => count >= 4).length;

    reportContent.push(
        `• ${neverPaired} pairs (${((neverPaired / pairCounts.length) * 100).toFixed(1)}%) have NEVER been teammates`
    );
    reportContent.push(
        `• ${pairedOnce} pairs (${((pairedOnce / pairCounts.length) * 100).toFixed(1)}%) have been teammates exactly ONCE`
    );
    reportContent.push(
        `• ${frequentPairs} pairs (${((frequentPairs / pairCounts.length) * 100).toFixed(1)}%) have been teammates 4+ times`
    );
    reportContent.push(`• Highest pairing frequency: ${historyData.metadata.maxPairings} times`);
    reportContent.push('');

    if (stdDev > 1.0) {
        reportContent.push('⚠️  HIGH VARIANCE detected - significant pairing imbalance exists');
    } else if (stdDev > 0.5) {
        reportContent.push('⚡ MODERATE VARIANCE - some pairing patterns emerging');
    } else {
        reportContent.push('✅ LOW VARIANCE - relatively balanced pairing distribution');
    }

    reportContent.push('');
    reportContent.push('👥 COMPLETE PAIRING REPORT');
    reportContent.push('─'.repeat(50));
    reportContent.push('(Ordered by frequency, then alphabetically)');
    reportContent.push('');

    // Add all pairings
    pairingReport.forEach((pairing, index) => {
        const rank = (index + 1).toString().padStart(4);
        const pairKey = pairing.pairKey.padEnd(35);
        const times = pairing.timesPaired.toString().padStart(2);
        reportContent.push(`${rank}: ${pairKey} - ${times} times`);
    });

    reportContent.push('');
    reportContent.push('='.repeat(80));
    reportContent.push(`Report generated by Leagr Teammate History Tracker`);
    reportContent.push(`${new Date().toLocaleString()}`);
    reportContent.push('='.repeat(80));

    // Write to file
    await writeFile(filePath, reportContent.join('\n'));
    console.log(`\n📄 Full pairing report saved to: ${filePath}`);
}

/**
 * Script to analyze teammate history for the pirates league
 */
async function main() {
    try {
        const tracker = createTeammateHistoryTracker();

        // Update teammate history for pirates league
        const { historyData } = await tracker.updateTeammateHistory('pirates');
        const pairingReport = generatePairingReport(historyData);

        // Print summary statistics
        console.log('\n=== SUMMARY STATISTICS ===');
        console.log(`League: ${historyData.leagueId}`);
        console.log(`Total players: ${historyData.metadata.totalPlayers}`);
        console.log(`Total sessions processed: ${historyData.totalSessions}`);
        console.log(`Total unique player pairs: ${historyData.metadata.totalUniquePairs}`);
        console.log(
            `Maximum pairings between any two players: ${historyData.metadata.maxPairings}`
        );
        console.log(`Last updated: ${historyData.lastUpdated}`);

        // Print pairing report (top 20 most frequent pairings) to console
        printPairingReport(pairingReport, 20);

        // Generate full pairing report file
        await generatePairingReportFile(historyData, pairingReport);

        // Print some statistics about pairing variance
        const pairCounts = pairingReport.map((p) => p.timesPaired);
        const averagePairings =
            pairCounts.reduce((sum, count) => sum + count, 0) / pairCounts.length;
        const variance =
            pairCounts.reduce((sum, count) => sum + Math.pow(count - averagePairings, 2), 0) /
            pairCounts.length;
        const stdDev = Math.sqrt(variance);

        console.log('\n=== PAIRING VARIANCE ANALYSIS ===');
        console.log(`Average pairings per pair: ${averagePairings.toFixed(2)}`);
        console.log(`Standard deviation: ${stdDev.toFixed(2)}`);
        console.log(`Variance: ${variance.toFixed(2)}`);

        // Show distribution
        const distribution = {};
        pairCounts.forEach((count) => {
            distribution[count] = (distribution[count] || 0) + 1;
        });

        console.log('\n=== PAIRING FREQUENCY DISTRIBUTION ===');
        Object.keys(distribution)
            .map(Number)
            .sort((a, b) => b - a)
            .forEach((count) => {
                const frequency = distribution[count];
                const percentage = ((frequency / pairCounts.length) * 100).toFixed(1);
                console.log(`${count} pairings: ${frequency} pairs (${percentage}%)`);
            });
    } catch (error) {
        console.error('Error analyzing teammate history:', error);
        process.exit(1);
    }
}

main();

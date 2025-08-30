#!/usr/bin/env node
/* eslint-disable no-console */

import { createRankingsManager } from '../../src/lib/server/rankings.js';

/**
 * Script to manually trigger a rankings update for a specific league
 * This is useful for testing ELO fixes or manually refreshing rankings
 * 
 * Usage: node test/manual/update-rankings.js [leagueId]
 * Example: node test/manual/update-rankings.js pirates
 */
async function main() {
    try {
        // Get league ID from command line arguments, default to 'pirates'
        const leagueId = process.argv[2] || 'pirates';
        
        console.log(`\n=== UPDATING RANKINGS FOR LEAGUE: ${leagueId} ===\n`);
        console.log('Starting rankings update...');
        
        const startTime = Date.now();
        
        // Create rankings manager and set league
        const rankingsManager = createRankingsManager().setLeague(leagueId);
        
        // Trigger the rankings update (same method used by POST /api/rankings)
        const updatedRankings = await rankingsManager.updateRankings();
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        console.log(`✅ Rankings update completed in ${duration}ms\n`);
        
        // Display summary information
        const { players, calculatedDates, rankingMetadata } = updatedRankings;
        
        console.log('=== RANKING SUMMARY ===');
        console.log(`Total players: ${Object.keys(players).length}`);
        console.log(`Sessions processed: ${calculatedDates.length}`);
        console.log(`Last session: ${calculatedDates[calculatedDates.length - 1] || 'None'}`);
        console.log(`Last updated: ${updatedRankings.lastUpdated || 'Never'}`);
        
        if (rankingMetadata) {
            console.log(`Global average: ${rankingMetadata.globalAverage}`);
            console.log(`Confidence threshold: ${rankingMetadata.confidenceThreshold} games`);
        }
        
        // Display top 10 players
        const playerEntries = Object.entries(players)
            .sort((a, b) => (a[1].rank || 999) - (b[1].rank || 999))
            .slice(0, 10);
            
        if (playerEntries.length > 0) {
            console.log('\n=== TOP 10 PLAYERS ===');
            playerEntries.forEach(([name, data]) => {
                const rank = data.rank || '?';
                const points = data.rankingPoints?.toFixed(1) || data.points;
                const appearances = data.appearances;
                const eloRating = data.elo?.rating?.toFixed(0) || 'N/A';
                const movement = data.rankMovement > 0 ? `↑${data.rankMovement}` : 
                                data.rankMovement < 0 ? `↓${Math.abs(data.rankMovement)}` : '─';
                
                console.log(`${rank.toString().padStart(2)}: ${name.padEnd(20)} | ${points.toString().padStart(6)} pts | ${appearances} games | ELO: ${eloRating.padStart(4)} | ${movement}`);
            });
        }
        
        // Check for players with ELO data to verify fix worked
        const playersWithElo = Object.entries(players)
            .filter(([, data]) => data.elo && typeof data.elo.rating === 'number')
            .length;
            
        console.log(`\n=== ELO VERIFICATION ===`);
        console.log(`Players with ELO data: ${playersWithElo}/${Object.keys(players).length}`);
        
        if (playersWithElo > 0) {
            console.log('✅ ELO system is working - players have ELO ratings');
            
            // Show a few example ELO ratings
            const eloExamples = Object.entries(players)
                .filter(([, data]) => data.elo && typeof data.elo.rating === 'number')
                .slice(0, 5);
                
            console.log('\nExample ELO ratings:');
            eloExamples.forEach(([name, data]) => {
                console.log(`  ${name}: ${data.elo.rating.toFixed(0)} (${data.elo.gamesPlayed || 0} games played)`);
            });
        } else {
            console.log('⚠️  Warning: No players have ELO data - check ELO implementation');
        }
        
        console.log(`\n=== RANKINGS UPDATE COMPLETE ===\n`);
        
    } catch (error) {
        console.error('\n❌ Error updating rankings:', error);
        process.exit(1);
    }
}

main();
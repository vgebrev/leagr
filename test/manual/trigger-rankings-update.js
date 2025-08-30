#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Script to trigger a rankings update via the API endpoint
 * This mimics what the frontend would do and uses the actual API
 * 
 * Usage: node test/manual/trigger-rankings-update.js [leagueId] [port]
 * Example: node test/manual/trigger-rankings-update.js pirates 3000
 */
async function main() {
    try {
        const leagueId = process.argv[2] || 'pirates';
        const port = process.argv[3] || '3000';
        
        console.log(`\n=== TRIGGERING RANKINGS UPDATE FOR LEAGUE: ${leagueId} ===\n`);
        
        // Construct the URL - if leagueId is provided, use subdomain format
        let baseUrl;
        if (leagueId && leagueId !== 'default') {
            baseUrl = `http://${leagueId}.localhost:${port}`;
        } else {
            baseUrl = `http://localhost:${port}`;
        }
        
        const apiUrl = `${baseUrl}/api/rankings`;
        
        console.log(`Making POST request to: ${apiUrl}`);
        console.log('Starting rankings update...');
        
        const startTime = Date.now();
        
        // Make the API request
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
        }
        
        const updatedRankings = await response.json();
        
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
        console.error('\n❌ Error updating rankings:', error.message);
        
        if (error.code === 'ECONNREFUSED') {
            console.error('\n💡 Make sure the development server is running:');
            console.error('   npm run dev');
            console.error('\n   Then try again.');
        }
        
        process.exit(1);
    }
}

main();
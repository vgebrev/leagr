import fs from 'fs/promises';
import path from 'path';

const dataPath = path.join(process.cwd(), 'data');
const rankingsPath = path.join(dataPath, 'rankings.json');
const BONUS_MULTIPLIER = 2;

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
        const standings = getStandings(teamNames, results); // uses teamStats internally

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

    await saveRankings(rankings);
    return rankings;
}

export const rankings = {
    loadRankings,
    updateRankings
};

import { describe, it, expect } from 'vitest';
import { createTeamGenerator } from '$lib/server/teamGenerator.js';

describe('TeamGenerator color distribution', () => {
  it('should not assign the same color to a player excessively in seeded generation', () => {
    const players = [
      "Chris", "Offie", "Jonathen", "Dan", "Wayne", "Les", "Talent", "Tinashe",
      "Morena", "Luyanda", "Lidudumalingani", "Angelo", "Mandisi", "Bu", "Bobinho",
      "Sibusiso", "Michael M", "Princelinho", "Brent", "Mufasa", "Kat", "Veli",
      "Teboho", "Thapelo"
    ];

    const teamGenerator = createTeamGenerator();
    teamGenerator.setPlayers(players);
    teamGenerator.setSettings({
        teamGeneration: {
            minTeams: 2, maxTeams: 5, minPlayersPerTeam: 3, maxPlayersPerTeam: 10
        }
    });

    // Create mock rankings to ensure players are sorted consistently
    const rankings = { players: {} };
    players.forEach((player, i) => {
        rankings.players[player] = { rankingPoints: 24 - i, points: 100, appearances: 10 };
    });
    teamGenerator.setRankings(rankings);

    // Only the first 4 colours are used for 4 teams
    const colorCounts = { blue: 0, white: 0, orange: 0, green: 0 };

    const config = {
      teams: 4,
      teamSizes: [6, 6, 6, 6]
    };

    for (let i = 0; i < 1000; i++) {
      const { teams } = teamGenerator.generateTeams('seeded', config);
      for (const teamName in teams) {
        if (teams[teamName].includes('Veli')) {
          const color = teamName.split(' ')[0].toLowerCase();
          if (colorCounts[color] !== undefined) {
            colorCounts[color]++;
          }
          break;
        }
      }
    }

    // Check if any color was assigned more than the threshold
    // With 4 teams, perfect distribution is 250 each. 350 allows for reasonable variance.
    for (const color in colorCounts) {
      expect(colorCounts[color]).toBeLessThanOrEqual(350);
    }

    // Sanity check to ensure the test actually ran and didn't result in all zeros
    const totalOccurrences = Object.values(colorCounts).reduce((sum, count) => sum + count, 0);
    expect(totalOccurrences).toBe(1000);
  });
});
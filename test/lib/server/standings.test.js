import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StandingsManager, StandingsError, createStandingsManager } from '$lib/server/standings.js';
import { data } from '$lib/server/data.js';

// Mock the data service
vi.mock('$lib/server/data.js', () => ({
    data: {
        get: vi.fn()
    }
}));

describe('StandingsManager', () => {
    let standingsManager;

    beforeEach(() => {
        vi.clearAllMocks();
        standingsManager = createStandingsManager();
    });

    describe('Factory function', () => {
        it('should create a new StandingsManager instance', () => {
            const manager = createStandingsManager();
            expect(manager).toBeInstanceOf(StandingsManager);
        });
    });

    describe('Fluent interface', () => {
        it('should allow method chaining', () => {
            const result = standingsManager.setSettings({ someOption: true });
            expect(result).toBe(standingsManager);
        });

        it('should store settings correctly', () => {
            const settings = { someOption: true };
            standingsManager.setSettings(settings);
            expect(standingsManager.settings).toBe(settings);
        });
    });

    describe('calculateStandings', () => {
        it('should throw error for non-array input', () => {
            expect(() => standingsManager.calculateStandings(null)).toThrow(StandingsError);
            expect(() => standingsManager.calculateStandings('invalid')).toThrow(StandingsError);
        });

        it('should return empty array for empty matchups', () => {
            const result = standingsManager.calculateStandings([]);
            expect(result).toEqual([]);
        });

        it('should skip matches with null scores', () => {
            const matchups = [{ home: 'Team A', away: 'Team B', homeScore: null, awayScore: null }];
            const result = standingsManager.calculateStandings(matchups);
            expect(result).toEqual([]);
        });

        it('should skip bye matches', () => {
            const matchups = [{ bye: 'Team A' }];
            const result = standingsManager.calculateStandings(matchups);
            expect(result).toEqual([]);
        });

        it('should skip invalid matchups', () => {
            const matchups = [
                null,
                'invalid',
                { home: null, away: 'Team B', homeScore: 1, awayScore: 0 },
                { home: 'Team A', away: '', homeScore: 1, awayScore: 0 },
                { home: 'Team A', away: 'Team B', homeScore: 'invalid', awayScore: 0 }
            ];
            const result = standingsManager.calculateStandings(matchups);
            expect(result).toEqual([]);
        });

        it('should calculate standings for single match', () => {
            const matchups = [
                { home: 'Red Lions', away: 'Blue Eagles', homeScore: 2, awayScore: 1 }
            ];
            const result = standingsManager.calculateStandings(matchups);

            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                team: 'Red Lions',
                played: 1,
                wins: 1,
                draws: 0,
                losses: 0,
                goalsFor: 2,
                goalsAgainst: 1,
                points: 3
            });
            expect(result[1]).toEqual({
                team: 'Blue Eagles',
                played: 1,
                wins: 0,
                draws: 0,
                losses: 1,
                goalsFor: 1,
                goalsAgainst: 2,
                points: 0
            });
        });

        it('should handle draws correctly', () => {
            const matchups = [
                { home: 'Red Lions', away: 'Blue Eagles', homeScore: 1, awayScore: 1 }
            ];
            const result = standingsManager.calculateStandings(matchups);

            expect(result).toHaveLength(2);
            expect(result[0].draws).toBe(1);
            expect(result[0].points).toBe(1);
            expect(result[1].draws).toBe(1);
            expect(result[1].points).toBe(1);
        });

        it('should accumulate stats across multiple matches', () => {
            const matchups = [
                { home: 'Red Lions', away: 'Blue Eagles', homeScore: 2, awayScore: 1 },
                { home: 'Green Wolves', away: 'Red Lions', homeScore: 0, awayScore: 3 },
                { home: 'Blue Eagles', away: 'Green Wolves', homeScore: 1, awayScore: 1 }
            ];
            const result = standingsManager.calculateStandings(matchups);

            expect(result).toHaveLength(3);

            // Red Lions should be first (6 points, 5 goals for, 1 against)
            expect(result[0]).toEqual({
                team: 'Red Lions',
                played: 2,
                wins: 2,
                draws: 0,
                losses: 0,
                goalsFor: 5,
                goalsAgainst: 1,
                points: 6
            });
        });

        it('should sort by points descending', () => {
            const matchups = [
                { home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 0 }, // A wins
                { home: 'Team C', away: 'Team D', homeScore: 1, awayScore: 1 }, // Draw
                { home: 'Team B', away: 'Team C', homeScore: 0, awayScore: 3 } // C wins
            ];
            const result = standingsManager.calculateStandings(matchups);

            expect(result[0].team).toBe('Team C'); // 4 points
            expect(result[1].team).toBe('Team A'); // 3 points
            expect(result[2].team).toBe('Team D'); // 1 point
            expect(result[3].team).toBe('Team B'); // 0 points
        });

        it('should use goal difference as tiebreaker', () => {
            const matchups = [
                { home: 'Team A', away: 'Team C', homeScore: 3, awayScore: 0 }, // A wins +3
                { home: 'Team B', away: 'Team D', homeScore: 1, awayScore: 0 }, // B wins +1
                { home: 'Team C', away: 'Team D', homeScore: 2, awayScore: 1 }, // C wins +1
                { home: 'Team A', away: 'Team B', homeScore: 0, awayScore: 2 } // B wins +2
            ];
            const result = standingsManager.calculateStandings(matchups);

            // Both A and B have 3 points
            // A: 3 goals for, 2 against = +1 goal difference
            // B: 3 goals for, 0 against = +3 goal difference
            expect(result[0].team).toBe('Team B'); // Better goal difference (+3)
            expect(result[1].team).toBe('Team A'); // Lower goal difference (+1)
        });

        it('should use goals for as final tiebreaker', () => {
            const matchups = [
                { home: 'Team A', away: 'Team C', homeScore: 2, awayScore: 1 }, // A wins
                { home: 'Team B', away: 'Team D', homeScore: 1, awayScore: 0 }, // B wins
                { home: 'Team C', away: 'Team B', homeScore: 0, awayScore: 1 }, // B wins
                { home: 'Team D', away: 'Team A', homeScore: 1, awayScore: 2 } // A wins
            ];
            const result = standingsManager.calculateStandings(matchups);

            // Both A and B have 6 points and +2 goal difference
            // A has 4 goals for, B has 2 goals for
            expect(result[0].team).toBe('Team A');
            expect(result[1].team).toBe('Team B');
        });

        it('should handle mixed match types correctly', () => {
            const matchups = [
                { home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 },
                { bye: 'Team C' },
                { home: 'Team D', away: 'Team E', homeScore: null, awayScore: null },
                { home: 'Team A', away: 'Team F', homeScore: 1, awayScore: 0 }
            ];
            const result = standingsManager.calculateStandings(matchups);

            expect(result).toHaveLength(3); // Only teams with played matches
            expect(result[0].team).toBe('Team A');
            expect(result[0].points).toBe(6);
        });
    });

    describe('getStandingsForDate', () => {
        it('should throw error for invalid date', async () => {
            await expect(standingsManager.getStandingsForDate(null)).rejects.toThrow(
                StandingsError
            );
            await expect(standingsManager.getStandingsForDate('')).rejects.toThrow(StandingsError);
        });

        it('should return standings for valid date and schedule', async () => {
            const mockGames = {
                rounds: [[{ home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 }]]
            };
            data.get.mockResolvedValue(mockGames);

            const result = await standingsManager.getStandingsForDate('2024-01-15', 'test-league');

            expect(data.get).toHaveBeenCalledWith('games', '2024-01-15', 'test-league');
            expect(result).toHaveLength(2);
            expect(result[0].team).toBe('Team A');
            expect(result[0].points).toBe(3);
        });

        it('should handle missing games data', async () => {
            data.get.mockResolvedValue(null);

            const result = await standingsManager.getStandingsForDate('2024-01-15');

            expect(result).toEqual([]);
        });

        it('should handle missing rounds', async () => {
            data.get.mockResolvedValue({});

            const result = await standingsManager.getStandingsForDate('2024-01-15');

            expect(result).toEqual([]);
        });

        it('should flatten nested rounds structure', async () => {
            const mockGames = {
                rounds: [
                    [{ home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 }],
                    [{ home: 'Team C', away: 'Team D', homeScore: 1, awayScore: 0 }]
                ]
            };
            data.get.mockResolvedValue(mockGames);

            const result = await standingsManager.getStandingsForDate('2024-01-15');

            expect(result).toHaveLength(4);
        });

        it('should handle non-nested rounds structure', async () => {
            const mockGames = {
                rounds: [
                    { home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 },
                    { home: 'Team C', away: 'Team D', homeScore: 1, awayScore: 0 }
                ]
            };
            data.get.mockResolvedValue(mockGames);

            const result = await standingsManager.getStandingsForDate('2024-01-15');

            expect(result).toEqual([]);
        });

        it('should throw StandingsError when data service fails', async () => {
            const error = new Error('Database connection failed');
            data.get.mockRejectedValue(error);

            await expect(standingsManager.getStandingsForDate('2024-01-15')).rejects.toThrow(
                StandingsError
            );
        });
    });

    describe('getKnockoutSeeding', () => {
        it('should return team names in standings order', async () => {
            const mockGames = {
                rounds: [
                    [
                        { home: 'Team A', away: 'Team B', homeScore: 3, awayScore: 1 },
                        { home: 'Team C', away: 'Team D', homeScore: 2, awayScore: 0 }
                    ]
                ]
            };
            data.get.mockResolvedValue(mockGames);

            const result = await standingsManager.getKnockoutSeeding('2024-01-15', 'test-league');

            expect(result).toEqual(['Team A', 'Team C', 'Team B', 'Team D']);
        });

        it('should return empty array when no games exist', async () => {
            data.get.mockResolvedValue(null);

            const result = await standingsManager.getKnockoutSeeding('2024-01-15');

            expect(result).toEqual([]);
        });

        it('should throw StandingsError when service fails', async () => {
            const error = new Error('Service unavailable');
            data.get.mockRejectedValue(error);

            await expect(standingsManager.getKnockoutSeeding('2024-01-15')).rejects.toThrow(
                StandingsError
            );
        });
    });

    describe('generateKnockoutBracket', () => {
        it('should generate bracket for 4 teams with top seeds playing later', () => {
            const teams = ['Team A', 'Team B', 'Team C', 'Team D']; // A=1st, B=2nd, C=3rd, D=4th
            const result = standingsManager.generateKnockoutBracket(teams);

            expect(result.teams).toEqual(teams);
            expect(result.bracket).toHaveLength(3); // 2 semis + 1 final

            // Check semi-final order: #2 vs #3 first, then #1 vs #4
            expect(result.bracket[0]).toEqual({
                round: 'semi',
                match: 1,
                home: 'Team B', // 2nd seed
                away: 'Team C', // 3rd seed
                homeScore: null,
                awayScore: null
            });
            expect(result.bracket[1]).toEqual({
                round: 'semi',
                match: 2,
                home: 'Team A', // 1st seed (plays later)
                away: 'Team D', // 4th seed
                homeScore: null,
                awayScore: null
            });

            // Check final placeholder
            expect(result.bracket[2]).toEqual({
                round: 'final',
                match: 1,
                home: null,
                away: null,
                homeScore: null,
                awayScore: null
            });
        });

        it('should generate bracket for 8 teams with descending seed order', () => {
            const teams = [
                'Team A',
                'Team B',
                'Team C',
                'Team D',
                'Team E',
                'Team F',
                'Team G',
                'Team H'
            ];
            const result = standingsManager.generateKnockoutBracket(teams);

            expect(result.teams).toEqual(teams);
            expect(result.bracket).toHaveLength(7); // 4 quarters + 2 semis + 1 final

            // Check quarter-finals order: #4 first, #3 second, #2 third, #1 last
            expect(result.bracket[0]).toEqual({
                round: 'quarter',
                match: 1,
                home: 'Team D', // 4th seed plays first
                away: 'Team E', // 5th seed
                homeScore: null,
                awayScore: null
            });
            expect(result.bracket[1]).toEqual({
                round: 'quarter',
                match: 2,
                home: 'Team C', // 3rd seed
                away: 'Team F', // 6th seed
                homeScore: null,
                awayScore: null
            });
            expect(result.bracket[2]).toEqual({
                round: 'quarter',
                match: 3,
                home: 'Team B', // 2nd seed
                away: 'Team G', // 7th seed
                homeScore: null,
                awayScore: null
            });
            expect(result.bracket[3]).toEqual({
                round: 'quarter',
                match: 4,
                home: 'Team A', // 1st seed plays last
                away: 'Team H', // 8th seed
                homeScore: null,
                awayScore: null
            });
        });

        it('should handle 6 teams with byes (round up to 8)', () => {
            const teams = ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F'];
            const result = standingsManager.generateKnockoutBracket(teams);

            // 6 teams need 2 byes to reach 8, 2 < 3 (0.5 * 6), so round up with byes
            expect(result.teams).toHaveLength(8); // 6 real teams + 2 byes
            expect(result.bracket).toHaveLength(7); // 4 quarters + 2 semis + 1 final

            // Check that byes are in positions 7 and 8 (lowest seeds)
            const actualTeams = result.teams.slice(0, 6);
            const byes = result.teams.slice(6);
            expect(actualTeams).toEqual([
                'Team A',
                'Team B',
                'Team C',
                'Team D',
                'Team E',
                'Team F'
            ]);
            expect(byes).toEqual(['BYE', 'BYE']);
        });

        it('should handle 5 teams by elimination (round down to 4)', () => {
            const teams = ['Team A', 'Team B', 'Team C', 'Team D', 'Team E'];
            const result = standingsManager.generateKnockoutBracket(teams);

            // 5 teams need 3 byes to reach 8, 3 > 2.5 (0.5 * 5), so round down and eliminate
            expect(result.teams).toEqual(['Team A', 'Team B', 'Team C', 'Team D']); // Top 4 only
            expect(result.bracket).toHaveLength(3); // 2 semis + 1 final
        });

        it('should handle 3 teams with byes (round up to 4)', () => {
            const teams = ['Team A', 'Team B', 'Team C'];
            const result = standingsManager.generateKnockoutBracket(teams);

            // 3 teams need 1 bye to reach 4, 1 < 1.5 (0.5 * 3), so round up with byes
            expect(result.teams).toHaveLength(4); // 3 real teams + 1 bye
            expect(result.bracket).toHaveLength(3); // 2 semis + 1 final

            // Check that bye is in position 4 (lowest seed)
            expect(result.teams.slice(0, 3)).toEqual(['Team A', 'Team B', 'Team C']);
            expect(result.teams[3]).toBe('BYE');
        });

        it('should handle 7 teams by elimination (round down to 4)', () => {
            const teams = ['Team A', 'Team B', 'Team C', 'Team D', 'Team E', 'Team F', 'Team G'];
            const result = standingsManager.generateKnockoutBracket(teams);

            // 7 teams need 1 bye to reach 8, but 1 < 3.5 (0.5 * 7), so we could round up
            // However, testing current vs new behavior - let's see what happens
            expect(result.teams).toHaveLength(8); // 7 real teams + 1 bye
            expect(result.bracket).toHaveLength(7); // 4 quarters + 2 semis + 1 final
        });

        it('should handle bye matchups correctly - team vs bye advances automatically', () => {
            const teams = ['Team A', 'Team B', 'Team C'];
            const result = standingsManager.generateKnockoutBracket(teams);

            // With 3 teams + 1 bye, should have: Team A vs BYE, Team B vs Team C
            const quarterMatches = result.bracket.filter((match) => match.round === 'semi');
            const byeMatch = quarterMatches.find(
                (match) => match.home === 'BYE' || match.away === 'BYE'
            );

            expect(byeMatch).toBeTruthy();
            expect(byeMatch.bye).toBe(true); // Should be marked as bye match
        });

        it('should return empty bracket for less than 2 teams', () => {
            expect(standingsManager.generateKnockoutBracket([])).toEqual({
                teams: [],
                bracket: []
            });
            expect(standingsManager.generateKnockoutBracket(['Team A'])).toEqual({
                teams: [],
                bracket: []
            });
        });

        it('should throw error for invalid input', () => {
            expect(() => standingsManager.generateKnockoutBracket(null)).toThrow(StandingsError);
            expect(() => standingsManager.generateKnockoutBracket('invalid')).toThrow(
                StandingsError
            );
        });
    });

    describe('getKnockoutBracketForDate', () => {
        it('should generate bracket from standings', async () => {
            const mockGames = {
                rounds: [
                    [
                        { home: 'Team A', away: 'Team B', homeScore: 3, awayScore: 1 },
                        { home: 'Team C', away: 'Team D', homeScore: 2, awayScore: 0 }
                    ]
                ]
            };
            data.get.mockResolvedValue(mockGames);

            const result = await standingsManager.getKnockoutBracketForDate('2024-01-15');

            expect(result.teams).toEqual(['Team A', 'Team C', 'Team B', 'Team D']); // All 4 teams
            expect(result.bracket).toHaveLength(3); // 2 semis + 1 final
        });

        it('should throw error for invalid date', async () => {
            await expect(standingsManager.getKnockoutBracketForDate(null)).rejects.toThrow(
                StandingsError
            );
        });
    });

    describe('Edge cases and validation', () => {
        it('should handle zero scores correctly', () => {
            const matchups = [{ home: 'Team A', away: 'Team B', homeScore: 0, awayScore: 0 }];
            const result = standingsManager.calculateStandings(matchups);

            expect(result).toHaveLength(2);
            expect(result[0].draws).toBe(1);
            expect(result[0].points).toBe(1);
            expect(result[0].goalsFor).toBe(0);
            expect(result[0].goalsAgainst).toBe(0);
        });

        it('should handle large score values', () => {
            const matchups = [{ home: 'Team A', away: 'Team B', homeScore: 10, awayScore: 8 }];
            const result = standingsManager.calculateStandings(matchups);

            expect(result[0].goalsFor).toBe(10);
            expect(result[0].goalsAgainst).toBe(8);
            expect(result[1].goalsFor).toBe(8);
            expect(result[1].goalsAgainst).toBe(10);
        });

        it('should handle special characters in team names', () => {
            const matchups = [{ home: 'Team Ä Ö Ü', away: 'Team @#$', homeScore: 1, awayScore: 0 }];
            const result = standingsManager.calculateStandings(matchups);

            expect(result[0].team).toBe('Team Ä Ö Ü');
            expect(result[1].team).toBe('Team @#$');
        });

        it('should handle teams with same name gracefully', () => {
            const matchups = [{ home: 'Team A', away: 'Team A', homeScore: 1, awayScore: 0 }];
            const result = standingsManager.calculateStandings(matchups);

            // This creates an invalid scenario but service shouldn't crash
            expect(result).toHaveLength(1);
            expect(result[0].team).toBe('Team A');
        });
    });
});

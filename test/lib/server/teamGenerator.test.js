import { describe, it, expect, beforeEach } from 'vitest';
import { createTeamGenerator, TeamGenerator, TeamError } from '$lib/server/teamGenerator.js';

describe('TeamGenerator', () => {
    let teamGenerator;
    let mockSettings;
    let mockPlayers;
    let mockRankings;

    beforeEach(() => {
        teamGenerator = createTeamGenerator();

        mockSettings = {
            teamGeneration: {
                minTeams: 2,
                maxTeams: 6,
                minPlayersPerTeam: 3,
                maxPlayersPerTeam: 7
            }
        };

        mockPlayers = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry'];

        mockRankings = {
            players: {
                Alice: { rankingPoints: 100, weightedAverage: 4.5, appearances: 10 },
                Bob: { rankingPoints: 90, weightedAverage: 4.2, appearances: 8 },
                Charlie: { rankingPoints: 85, weightedAverage: 4.0, appearances: 9 },
                Diana: { rankingPoints: 80, weightedAverage: 3.8, appearances: 7 },
                Eve: { rankingPoints: 75, weightedAverage: 3.5, appearances: 6 },
                Frank: { rankingPoints: 70, weightedAverage: 3.2, appearances: 5 },
                Grace: { rankingPoints: 65, weightedAverage: 3.0, appearances: 4 },
                Henry: { rankingPoints: 60, weightedAverage: 2.8, appearances: 3 }
            }
        };
    });

    describe('Factory function', () => {
        it('should create a new TeamGenerator instance', () => {
            const generator = createTeamGenerator();
            expect(generator).toBeInstanceOf(TeamGenerator);
        });
    });

    describe('Fluent interface', () => {
        it('should allow method chaining', () => {
            const result = teamGenerator
                .setSettings(mockSettings)
                .setPlayers(mockPlayers)
                .setRankings(mockRankings);

            expect(result).toBe(teamGenerator);
        });

        it('should store settings correctly', () => {
            teamGenerator.setSettings(mockSettings);
            expect(teamGenerator.settings).toBe(mockSettings);
        });

        it('should store players correctly', () => {
            teamGenerator.setPlayers(mockPlayers);
            expect(teamGenerator.players).toBe(mockPlayers);
        });

        it('should store rankings correctly', () => {
            teamGenerator.setRankings(mockRankings);
            expect(teamGenerator.rankings).toBe(mockRankings);
        });
    });

    describe('calculateConfigurations', () => {
        beforeEach(() => {
            teamGenerator.setSettings(mockSettings);
        });

        it('should throw TeamError if settings not set', () => {
            const generator = createTeamGenerator();
            expect(() => generator.calculateConfigurations(8)).toThrow(TeamError);
            expect(() => generator.calculateConfigurations(8)).toThrow(
                'Settings must be set before calculating configurations'
            );
        });

        it('should calculate valid configurations for 8 players', () => {
            teamGenerator.setPlayers(mockPlayers);
            const configs = teamGenerator.calculateConfigurations();

            // Should find at least the 2-team configuration
            expect(configs.length).toBeGreaterThanOrEqual(1);
            expect(configs[0]).toEqual({ teams: 2, teamSizes: [4, 4] });

            // Check that all configurations are valid
            configs.forEach((config) => {
                const totalPlayers = config.teamSizes.reduce((sum, size) => sum + size, 0);
                expect(totalPlayers).toBe(8);
                expect(config.teams).toBe(config.teamSizes.length);
            });
        });

        it('should calculate configurations for custom player count', () => {
            const configs = teamGenerator.calculateConfigurations(12);

            expect(configs.length).toBeGreaterThan(0);
            configs.forEach((config) => {
                const totalPlayers = config.teamSizes.reduce((sum, size) => sum + size, 0);
                expect(totalPlayers).toBe(12);
                expect(config.teams).toBe(config.teamSizes.length);
            });
        });

        it('should respect team and player limits', () => {
            const configs = teamGenerator.calculateConfigurations(20);

            configs.forEach((config) => {
                expect(config.teams).toBeGreaterThanOrEqual(mockSettings.teamGeneration.minTeams);
                expect(config.teams).toBeLessThanOrEqual(mockSettings.teamGeneration.maxTeams);

                config.teamSizes.forEach((size) => {
                    expect(size).toBeGreaterThanOrEqual(
                        mockSettings.teamGeneration.minPlayersPerTeam
                    );
                    expect(size).toBeLessThanOrEqual(mockSettings.teamGeneration.maxPlayersPerTeam);
                });
            });
        });

        it('should return empty array for impossible configurations', () => {
            const configs = teamGenerator.calculateConfigurations(1);
            expect(configs).toEqual([]);
        });
    });

    describe('generateTeamNames', () => {
        it('should generate the correct number of team names', () => {
            const names = teamGenerator.generateTeamNames(3);
            expect(names).toHaveLength(3);
        });

        it('should generate unique team names', () => {
            const names = teamGenerator.generateTeamNames(5);
            const uniqueNames = new Set(names);
            expect(uniqueNames.size).toBe(5);
        });

        it('should include color and noun in each name', () => {
            const names = teamGenerator.generateTeamNames(2);
            names.forEach((name) => {
                expect(name).toMatch(/^\w+ \w+$/); // Format: "Color Noun"
                expect(name.split(' ')).toHaveLength(2);
            });
        });
    });

    describe('generateRandomTeams', () => {
        beforeEach(() => {
            teamGenerator.setSettings(mockSettings).setPlayers(mockPlayers);
        });

        it('should throw TeamError for no players', () => {
            teamGenerator.setPlayers([]);
            const config = { teamSizes: [4, 4] };

            expect(() => teamGenerator.generateRandomTeams(config)).toThrow(TeamError);
            expect(() => teamGenerator.generateRandomTeams(config)).toThrow(
                'No players available for team generation'
            );
        });

        it('should generate teams with correct sizes', () => {
            const config = { teamSizes: [3, 3, 2] };
            const teams = teamGenerator.generateRandomTeams(config);

            const teamNames = Object.keys(teams);
            expect(teamNames).toHaveLength(3);

            const sizes = Object.values(teams).map((team) => team.length);
            expect(sizes.sort()).toEqual([2, 3, 3]);
        });

        it('should distribute all players', () => {
            const config = { teamSizes: [4, 4] };
            const teams = teamGenerator.generateRandomTeams(config);

            const allAssignedPlayers = Object.values(teams).flat();
            expect(allAssignedPlayers).toHaveLength(8);
            expect(new Set(allAssignedPlayers).size).toBe(8); // All unique
        });

        it('should assign every player from the original list', () => {
            const config = { teamSizes: [4, 4] };
            const teams = teamGenerator.generateRandomTeams(config);

            const allAssignedPlayers = Object.values(teams).flat();
            mockPlayers.forEach((player) => {
                expect(allAssignedPlayers).toContain(player);
            });
        });
    });

    describe('generateSeededTeams', () => {
        beforeEach(() => {
            teamGenerator
                .setSettings(mockSettings)
                .setPlayers(mockPlayers)
                .setRankings(mockRankings);
        });

        it('should throw TeamError for no players', () => {
            teamGenerator.setPlayers([]);
            const config = { teamSizes: [4, 4] };

            expect(() => teamGenerator.generateSeededTeams(config)).toThrow(TeamError);
            expect(() => teamGenerator.generateSeededTeams(config)).toThrow(
                'No players available for team generation'
            );
        });

        it('should generate teams with correct sizes', () => {
            const config = { teamSizes: [3, 3, 2] };
            const teams = teamGenerator.generateSeededTeams(config);

            const teamNames = Object.keys(teams);
            expect(teamNames).toHaveLength(3);

            const sizes = Object.values(teams).map((team) => team.length);
            expect(sizes.sort()).toEqual([2, 3, 3]);
        });

        it('should distribute all players', () => {
            const config = { teamSizes: [4, 4] };
            const teams = teamGenerator.generateSeededTeams(config);

            const allAssignedPlayers = Object.values(teams).flat();
            expect(allAssignedPlayers).toHaveLength(8);
            expect(new Set(allAssignedPlayers).size).toBe(8);
        });

        it('should work without rankings data', () => {
            teamGenerator.setRankings(null);
            const config = { teamSizes: [4, 4] };

            expect(() => teamGenerator.generateSeededTeams(config)).not.toThrow();
            const teams = teamGenerator.generateSeededTeams(config);

            const allAssignedPlayers = Object.values(teams).flat();
            expect(allAssignedPlayers).toHaveLength(8);
        });

        it('should handle players not in rankings', () => {
            const playersWithUnranked = [...mockPlayers, 'NewPlayer1', 'NewPlayer2'];
            teamGenerator.setPlayers(playersWithUnranked);

            const config = { teamSizes: [5, 5] };
            const teams = teamGenerator.generateSeededTeams(config);

            const allAssignedPlayers = Object.values(teams).flat();
            expect(allAssignedPlayers).toHaveLength(10);
            expect(allAssignedPlayers).toContain('NewPlayer1');
            expect(allAssignedPlayers).toContain('NewPlayer2');
        });
    });

    describe('generateTeams', () => {
        beforeEach(() => {
            teamGenerator
                .setSettings(mockSettings)
                .setPlayers(mockPlayers)
                .setRankings(mockRankings);
        });

        it('should throw TeamError if settings not set', () => {
            const generator = createTeamGenerator().setPlayers(mockPlayers);
            const config = { teamSizes: [4, 4] };

            expect(() => generator.generateTeams('random', config)).toThrow(TeamError);
            expect(() => generator.generateTeams('random', config)).toThrow(
                'Settings must be set before generating teams'
            );
        });

        it('should throw TeamError for invalid config', () => {
            expect(() => teamGenerator.generateTeams('random', null)).toThrow(TeamError);
            expect(() => teamGenerator.generateTeams('random', {})).toThrow(TeamError);
            expect(() => teamGenerator.generateTeams('random', { teamSizes: 'invalid' })).toThrow(
                TeamError
            );
        });

        it('should throw TeamError for invalid method', () => {
            const config = { teamSizes: [4, 4] };

            expect(() => teamGenerator.generateTeams('invalid', config)).toThrow(TeamError);
            expect(() => teamGenerator.generateTeams('invalid', config)).toThrow(
                'Invalid team generation method: invalid'
            );
        });

        it('should throw TeamError for insufficient players', () => {
            const config = { teamSizes: [5, 5, 5] }; // Need 15 players, only have 8

            expect(() => teamGenerator.generateTeams('random', config)).toThrow(TeamError);
            expect(() => teamGenerator.generateTeams('random', config)).toThrow(
                'Not enough players: need 15, have 8'
            );
        });

        it('should generate random teams successfully', () => {
            const config = { teamSizes: [4, 4] };
            const result = teamGenerator.generateTeams('random', config);

            expect(result).toHaveProperty('teams');
            expect(result).toHaveProperty('config');
            expect(result.config.method).toBe('random');
            expect(result.config.totalPlayers).toBe(8);
            expect(result.config.playersUsed).toBe(8);
        });

        it('should generate seeded teams successfully', () => {
            const config = { teamSizes: [4, 4] };
            const result = teamGenerator.generateTeams('seeded', config);

            expect(result).toHaveProperty('teams');
            expect(result).toHaveProperty('config');
            expect(result.config.method).toBe('seeded');
            expect(result.config.totalPlayers).toBe(8);
            expect(result.config.playersUsed).toBe(8);
        });

        it('should handle partial player usage', () => {
            const config = { teamSizes: [3, 3] }; // Use 6 out of 8 players
            const result = teamGenerator.generateTeams('random', config);

            expect(result.config.totalPlayers).toBe(8);
            expect(result.config.playersUsed).toBe(6);

            const allAssignedPlayers = Object.values(result.teams).flat();
            expect(allAssignedPlayers).toHaveLength(6);
        });
    });

    describe('TeamError', () => {
        it('should create TeamError with default status code', () => {
            const error = new TeamError('Test message');
            expect(error.name).toBe('TeamError');
            expect(error.message).toBe('Test message');
            expect(error.statusCode).toBe(500);
        });

        it('should create TeamError with custom status code', () => {
            const error = new TeamError('Validation error', 400);
            expect(error.name).toBe('TeamError');
            expect(error.message).toBe('Validation error');
            expect(error.statusCode).toBe(400);
        });

        it('should be instance of Error', () => {
            const error = new TeamError('Test');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(TeamError);
        });
    });
});

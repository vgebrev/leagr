import { describe, it, expect, beforeEach } from 'vitest';
import {
    createGameScheduler,
    GameScheduler,
    GameSchedulerError
} from '$lib/server/gameScheduler.js';

describe('GameScheduler', () => {
    let gameScheduler;
    let mockTeams;

    beforeEach(() => {
        gameScheduler = createGameScheduler();
        mockTeams = ['Red Lions', 'Blue Eagles', 'Green Wolves', 'Yellow Tigers'];
    });

    describe('Factory function', () => {
        it('should create a new GameScheduler instance', () => {
            const scheduler = createGameScheduler();
            expect(scheduler).toBeInstanceOf(GameScheduler);
        });
    });

    describe('Fluent interface', () => {
        it('should allow method chaining', () => {
            const result = gameScheduler.setTeams(mockTeams).setSettings({ someOption: true });

            expect(result).toBe(gameScheduler);
        });

        it('should store teams correctly', () => {
            gameScheduler.setTeams(mockTeams);
            expect(gameScheduler.teams).toEqual(mockTeams);
        });

        it('should store settings correctly', () => {
            const settings = { someOption: true };
            gameScheduler.setSettings(settings);
            expect(gameScheduler.settings).toBe(settings);
        });
    });

    describe('setTeams', () => {
        it('should accept valid team array', () => {
            gameScheduler.setTeams(mockTeams);
            expect(gameScheduler.teams).toEqual(mockTeams);
        });

        it('should filter out empty/invalid teams', () => {
            const teamsWithInvalid = ['Team A', '', null, 'Team B', undefined, 123, 'Team C'];
            gameScheduler.setTeams(teamsWithInvalid);
            expect(gameScheduler.teams).toEqual(['Team A', 'Team B', 'Team C']);
        });

        it('should throw error for non-array input', () => {
            expect(() => gameScheduler.setTeams('not an array')).toThrow(GameSchedulerError);
            expect(() => gameScheduler.setTeams('not an array')).toThrow('Teams must be an array');
        });

        it('should handle empty array', () => {
            gameScheduler.setTeams([]);
            expect(gameScheduler.teams).toEqual([]);
        });
    });

    describe('generateRoundRobinRounds', () => {
        it('should generate correct rounds for even number of teams', () => {
            const teams = ['A', 'B', 'C', 'D'];
            const rounds = gameScheduler.generateRoundRobinRounds(teams, 0);

            expect(rounds).toHaveLength(3); // n-1 rounds for n teams

            // Check first round structure
            expect(rounds[0]).toHaveLength(2); // n/2 matches per round
            expect(rounds[0][0]).toHaveProperty('home');
            expect(rounds[0][0]).toHaveProperty('away');
            expect(rounds[0][0]).toHaveProperty('homeScore', null);
            expect(rounds[0][0]).toHaveProperty('awayScore', null);
        });

        it('should generate correct rounds for odd number of teams (with bye)', () => {
            const teams = ['A', 'B', 'C'];
            const rounds = gameScheduler.generateRoundRobinRounds(teams, 0);

            expect(rounds).toHaveLength(3); // n rounds for n teams (odd)

            // Each round should have one bye
            rounds.forEach((round) => {
                const byeMatches = round.filter((match) => match.bye);
                expect(byeMatches).toHaveLength(1);
            });
        });

        it('should ensure each team plays every other team exactly once', () => {
            const teams = ['A', 'B', 'C', 'D'];
            const rounds = gameScheduler.generateRoundRobinRounds(teams, 0);

            const allMatches = rounds.flat().filter((match) => !match.bye);
            const matchPairs = new Set();

            allMatches.forEach((match) => {
                const pair = [match.home, match.away].sort().join('-');
                expect(matchPairs.has(pair)).toBe(false); // No duplicate pairings
                matchPairs.add(pair);
            });

            // Should have n*(n-1)/2 unique pairings
            expect(matchPairs.size).toBe(6); // 4*3/2 = 6
        });

        it('should ensure all teams participate in games', () => {
            const teams = ['A', 'B', 'C', 'D'];
            const rounds = gameScheduler.generateRoundRobinRounds(teams, 0);

            // Check that all teams participate
            const teamAppearances = {};

            // Initialize counters for all teams
            teams.forEach((team) => {
                teamAppearances[team] = 0;
            });

            rounds
                .flat()
                .filter((match) => !match.bye)
                .forEach((match) => {
                    teamAppearances[match.home] = (teamAppearances[match.home] || 0) + 1;
                    teamAppearances[match.away] = (teamAppearances[match.away] || 0) + 1;
                });

            // Each team should play n-1 games total
            teams.forEach((team) => {
                expect(teamAppearances[team]).toBe(teams.length - 1);
            });
        });

        it('should throw error for empty teams array', () => {
            expect(() => gameScheduler.generateRoundRobinRounds([])).toThrow(GameSchedulerError);
            expect(() => gameScheduler.generateRoundRobinRounds([])).toThrow(
                'Teams array is required and cannot be empty'
            );
        });

        it('should throw error for single team', () => {
            expect(() => gameScheduler.generateRoundRobinRounds(['Team A'])).toThrow(
                GameSchedulerError
            );
            expect(() => gameScheduler.generateRoundRobinRounds(['Team A'])).toThrow(
                'At least 2 teams are required for scheduling'
            );
        });

        it('should throw error for invalid anchor index', () => {
            expect(() => gameScheduler.generateRoundRobinRounds(mockTeams, -1)).toThrow(
                GameSchedulerError
            );
            expect(() => gameScheduler.generateRoundRobinRounds(mockTeams, 'invalid')).toThrow(
                GameSchedulerError
            );
        });

        it('should handle anchor index larger than team count', () => {
            const teams = ['A', 'B', 'C', 'D'];
            // Should not throw error, should use modulo
            expect(() => gameScheduler.generateRoundRobinRounds(teams, 10)).not.toThrow();
        });
    });

    describe('generateFullRoundRobinSchedule', () => {
        it('should generate double round-robin (home and away)', () => {
            const teams = ['A', 'B', 'C', 'D'];
            const fullSchedule = gameScheduler.generateFullRoundRobinSchedule(teams, 0);

            // Should have 2 * (n-1) rounds
            expect(fullSchedule).toHaveLength(6);

            // Count all matches (excluding byes)
            const allMatches = fullSchedule.flat().filter((match) => !match.bye);

            // Should have n*(n-1) total matches (each pairing twice)
            expect(allMatches).toHaveLength(12); // 4*3 = 12
        });

        it('should ensure each team plays every other team twice (home and away)', () => {
            const teams = ['A', 'B', 'C', 'D'];
            const fullSchedule = gameScheduler.generateFullRoundRobinSchedule(teams, 0);

            const allMatches = fullSchedule.flat().filter((match) => !match.bye);
            const matchCount = {};

            allMatches.forEach((match) => {
                const pair = [match.home, match.away].sort().join('-');
                matchCount[pair] = (matchCount[pair] || 0) + 1;
            });

            // Each pairing should appear exactly twice
            Object.values(matchCount).forEach((count) => {
                expect(count).toBe(2);
            });
        });

        it('should have symmetric home/away distribution', () => {
            const teams = ['A', 'B', 'C', 'D'];
            const fullSchedule = gameScheduler.generateFullRoundRobinSchedule(teams, 0);

            const allMatches = fullSchedule.flat().filter((match) => !match.bye);
            const homeCount = {};
            const awayCount = {};

            allMatches.forEach((match) => {
                homeCount[match.home] = (homeCount[match.home] || 0) + 1;
                awayCount[match.away] = (awayCount[match.away] || 0) + 1;
            });

            // Each team should play equal home and away games
            teams.forEach((team) => {
                expect(homeCount[team]).toBe(awayCount[team]);
                expect(homeCount[team]).toBe(3); // n-1 games each way
            });
        });
    });

    describe('generateSchedule', () => {
        beforeEach(() => {
            gameScheduler.setTeams(mockTeams);
        });

        it('should generate schedule with teams set', () => {
            const result = gameScheduler.generateSchedule(0);

            expect(result).toHaveProperty('rounds');
            expect(result).toHaveProperty('anchorIndex');
            expect(result.anchorIndex).toBe(0);
            expect(Array.isArray(result.rounds)).toBe(true);
        });

        it('should generate random anchor index when not provided', () => {
            const result = gameScheduler.generateSchedule();

            expect(typeof result.anchorIndex).toBe('number');
            expect(result.anchorIndex).toBeGreaterThanOrEqual(0);
            expect(result.anchorIndex).toBeLessThan(mockTeams.length);
        });

        it('should throw error when no teams are set', () => {
            const emptyScheduler = createGameScheduler();
            expect(() => emptyScheduler.generateSchedule()).toThrow(GameSchedulerError);
            expect(() => emptyScheduler.generateSchedule()).toThrow(
                'No teams available for schedule generation'
            );
        });

        it('should throw error for insufficient teams', () => {
            gameScheduler.setTeams(['Team A']);
            expect(() => gameScheduler.generateSchedule()).toThrow(GameSchedulerError);
            expect(() => gameScheduler.generateSchedule()).toThrow(
                'At least 2 teams are required for schedule generation'
            );
        });
    });

    describe('addMoreRounds', () => {
        beforeEach(() => {
            gameScheduler.setTeams(mockTeams);
        });

        it('should add more rounds to existing schedule', () => {
            const initialSchedule = gameScheduler.generateSchedule(0);
            const extendedSchedule = gameScheduler.addMoreRounds(initialSchedule.rounds, 0);

            expect(extendedSchedule.rounds.length).toBe(initialSchedule.rounds.length * 2);
            expect(extendedSchedule.anchorIndex).toBe(0);
        });

        it('should throw error for invalid existing rounds', () => {
            expect(() => gameScheduler.addMoreRounds('not an array', 0)).toThrow(
                GameSchedulerError
            );
            expect(() => gameScheduler.addMoreRounds('not an array', 0)).toThrow(
                'Existing rounds must be an array'
            );
        });

        it('should throw error for invalid anchor index', () => {
            expect(() => gameScheduler.addMoreRounds([], -1)).toThrow(GameSchedulerError);
            expect(() => gameScheduler.addMoreRounds([], 'invalid')).toThrow(GameSchedulerError);
        });
    });

    describe('validateSchedule', () => {
        it('should validate correct schedule data', () => {
            const validSchedule = {
                anchorIndex: 1,
                rounds: [[{ home: 'Team A', away: 'Team B', homeScore: null, awayScore: null }]]
            };

            const result = gameScheduler.validateSchedule(validSchedule);
            expect(result).toHaveProperty('rounds');
            expect(result).toHaveProperty('anchorIndex');
        });

        it('should throw error for invalid schedule data', () => {
            const invalidSchedule = {
                anchorIndex: -1,
                rounds: 'not an array'
            };

            expect(() => gameScheduler.validateSchedule(invalidSchedule)).toThrow(
                GameSchedulerError
            );
            expect(() => gameScheduler.validateSchedule(invalidSchedule)).toThrow(
                'Invalid schedule data'
            );
        });
    });

    describe('getScheduleStatus', () => {
        it('should return correct status for empty schedule', () => {
            const status = gameScheduler.getScheduleStatus([]);
            expect(status).toEqual({
                isComplete: false,
                playedGames: 0,
                totalGames: 0
            });
        });

        it('should return correct status for incomplete schedule', () => {
            const rounds = [
                [
                    { home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 },
                    { home: 'Team C', away: 'Team D', homeScore: null, awayScore: null }
                ]
            ];

            const status = gameScheduler.getScheduleStatus(rounds);
            expect(status).toEqual({
                isComplete: false,
                playedGames: 1,
                totalGames: 2
            });
        });

        it('should return correct status for complete schedule', () => {
            const rounds = [
                [
                    { home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 },
                    { home: 'Team C', away: 'Team D', homeScore: 3, awayScore: 0 }
                ]
            ];

            const status = gameScheduler.getScheduleStatus(rounds);
            expect(status).toEqual({
                isComplete: true,
                playedGames: 2,
                totalGames: 2
            });
        });

        it('should ignore bye matches in status calculation', () => {
            const rounds = [
                [{ home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 }, { bye: 'Team C' }]
            ];

            const status = gameScheduler.getScheduleStatus(rounds);
            expect(status).toEqual({
                isComplete: true,
                playedGames: 1,
                totalGames: 1
            });
        });

        it('should throw error for invalid rounds', () => {
            expect(() => gameScheduler.getScheduleStatus('not an array')).toThrow(
                GameSchedulerError
            );
        });
    });

    describe('getMatchResults', () => {
        it('should extract completed match results', () => {
            const rounds = [
                [
                    { home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 },
                    { home: 'Team C', away: 'Team D', homeScore: null, awayScore: null },
                    { bye: 'Team E' }
                ]
            ];

            const results = gameScheduler.getMatchResults(rounds);
            expect(results).toEqual([
                { home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 }
            ]);
        });

        it('should return empty array for no completed matches', () => {
            const rounds = [
                [
                    { home: 'Team A', away: 'Team B', homeScore: null, awayScore: null },
                    { bye: 'Team C' }
                ]
            ];

            const results = gameScheduler.getMatchResults(rounds);
            expect(results).toEqual([]);
        });

        it('should only include matches with valid numeric scores', () => {
            const rounds = [
                [
                    { home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 },
                    { home: 'Team C', away: 'Team D', homeScore: 'invalid', awayScore: 0 },
                    { home: 'Team E', away: 'Team F', homeScore: 1, awayScore: null }
                ]
            ];

            const results = gameScheduler.getMatchResults(rounds);
            expect(results).toEqual([
                { home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 }
            ]);
        });

        it('should throw error for invalid rounds', () => {
            expect(() => gameScheduler.getMatchResults('not an array')).toThrow(GameSchedulerError);
        });
    });

    describe('processScheduleRequest', () => {
        it('should process new schedule request', () => {
            const result = gameScheduler.processScheduleRequest({
                teams: mockTeams,
                anchorIndex: 1
            });

            expect(result).toHaveProperty('rounds');
            expect(result).toHaveProperty('anchorIndex', 1);
            expect(result).toHaveProperty('status');
            expect(result.status).toHaveProperty('isComplete');
            expect(result.status).toHaveProperty('playedGames');
            expect(result.status).toHaveProperty('totalGames');
        });

        it('should process add more rounds request', () => {
            gameScheduler.setTeams(mockTeams);
            const initialSchedule = gameScheduler.generateSchedule(0);

            const result = gameScheduler.processScheduleRequest({
                anchorIndex: 0,
                existingRounds: initialSchedule.rounds,
                addMore: true
            });

            expect(result.rounds.length).toBe(initialSchedule.rounds.length * 2);
        });

        it('should throw error when no teams available', () => {
            expect(() => gameScheduler.processScheduleRequest({})).toThrow(GameSchedulerError);
            expect(() => gameScheduler.processScheduleRequest({})).toThrow(
                'No teams available for schedule generation'
            );
        });

        it('should use pre-set teams if teams not provided in options', () => {
            gameScheduler.setTeams(mockTeams);

            const result = gameScheduler.processScheduleRequest({
                anchorIndex: 2
            });

            expect(result).toHaveProperty('rounds');
            expect(result.anchorIndex).toBe(2);
        });
    });

    describe('GameSchedulerError', () => {
        it('should create error with default status code', () => {
            const error = new GameSchedulerError('Test message');
            expect(error.name).toBe('GameSchedulerError');
            expect(error.message).toBe('Test message');
            expect(error.statusCode).toBe(500);
        });

        it('should create error with custom status code', () => {
            const error = new GameSchedulerError('Validation error', 400);
            expect(error.name).toBe('GameSchedulerError');
            expect(error.message).toBe('Validation error');
            expect(error.statusCode).toBe(400);
        });

        it('should be instance of Error', () => {
            const error = new GameSchedulerError('Test');
            expect(error).toBeInstanceOf(Error);
            expect(error).toBeInstanceOf(GameSchedulerError);
        });
    });

    describe('Integration tests', () => {
        it('should handle complete workflow for 4 teams', () => {
            const teams = ['Red Lions', 'Blue Eagles', 'Green Wolves', 'Yellow Tigers'];

            // Generate initial schedule
            const schedule = gameScheduler.setTeams(teams).generateSchedule(0);

            expect(schedule.rounds).toHaveLength(6); // Double round-robin for 4 teams

            // Check schedule status
            const status = gameScheduler.getScheduleStatus(schedule.rounds);
            expect(status.isComplete).toBe(false);
            expect(status.totalGames).toBe(12); // 4 teams * 3 opponents * 2 legs

            // Simulate adding scores to first match
            schedule.rounds[0][0].homeScore = 2;
            schedule.rounds[0][0].awayScore = 1;

            const updatedStatus = gameScheduler.getScheduleStatus(schedule.rounds);
            expect(updatedStatus.playedGames).toBe(1);
            expect(updatedStatus.isComplete).toBe(false);
        });

        it('should handle odd number of teams with byes', () => {
            const teams = ['Team A', 'Team B', 'Team C'];

            const schedule = gameScheduler.setTeams(teams).generateSchedule(0);

            // Should have 6 rounds (3 teams, double round-robin)
            expect(schedule.rounds).toHaveLength(6);

            // Each round should have exactly one bye
            schedule.rounds.forEach((round) => {
                const byeMatches = round.filter((match) => match.bye);
                expect(byeMatches).toHaveLength(1);
            });

            // Total actual matches should be 6 (3 choose 2, times 2 for double round-robin)
            const allMatches = schedule.rounds.flat().filter((match) => !match.bye);
            expect(allMatches).toHaveLength(6);
        });
    });
});

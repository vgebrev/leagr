import { describe, it, expect } from 'vitest';
import {
    validateGameScore,
    validateMatchScores,
    validateRound,
    validateScheduleData,
    validateGameRequest
} from '$lib/shared/validation.js';

describe('Game Score Validation', () => {
    describe('validateGameScore', () => {
        it('should accept valid integer scores', () => {
            const result = validateGameScore(5);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should accept zero as a valid score', () => {
            const result = validateGameScore(0);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should accept null scores for unplayed games', () => {
            const result = validateGameScore(null);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should accept undefined scores for unplayed games', () => {
            const result = validateGameScore(undefined);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should parse valid string numbers', () => {
            const result = validateGameScore('7');
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should parse string numbers with whitespace', () => {
            const result = validateGameScore('  3  ');
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should reject negative scores', () => {
            const result = validateGameScore(-1);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('score score cannot be less than 0');
        });

        it('should reject scores exceeding maximum', () => {
            const result = validateGameScore(100);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('score score cannot exceed 99');
        });

        it('should reject non-integer numbers', () => {
            const result = validateGameScore(3.5);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('score score must be a whole number');
        });

        it('should reject invalid string values', () => {
            const result = validateGameScore('abc');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('score score must be a valid number');
        });

        it('should reject empty strings', () => {
            const result = validateGameScore('');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('score score must be a valid number');
        });

        it('should reject boolean values', () => {
            const result = validateGameScore(true);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('score score must be a valid number');
        });

        it('should use custom score type in error messages', () => {
            const result = validateGameScore(-1, 'Home');
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Home score cannot be less than 0');
        });
    });

    describe('validateMatchScores', () => {
        it('should accept valid match with both scores', () => {
            const match = { home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 };
            const result = validateMatchScores(match);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
            expect(result.sanitizedMatch).toEqual({
                home: 'Team A',
                away: 'Team B',
                homeScore: 2,
                awayScore: 1
            });
        });

        it('should accept match with null scores', () => {
            const match = { home: 'Team A', away: 'Team B', homeScore: null, awayScore: null };
            const result = validateMatchScores(match);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
        });

        it('should sanitize string scores to integers', () => {
            const match = { home: 'Team A', away: 'Team B', homeScore: '3', awayScore: '2' };
            const result = validateMatchScores(match);
            expect(result.isValid).toBe(true);
            expect(result.sanitizedMatch.homeScore).toBe(3);
            expect(result.sanitizedMatch.awayScore).toBe(2);
        });

        it('should reject null object', () => {
            const result = validateMatchScores(null);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Match must be a valid object');
            expect(result.sanitizedMatch).toBe(null);
        });

        it('should reject mismatched null scores', () => {
            const match = { home: 'Team A', away: 'Team B', homeScore: 2, awayScore: null };
            const result = validateMatchScores(match);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Both home and away scores must be provided, or both must be empty');
        });

        it('should reject invalid home score', () => {
            const match = { home: 'Team A', away: 'Team B', homeScore: -1, awayScore: 2 };
            const result = validateMatchScores(match);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Home score cannot be less than 0');
        });

        it('should reject invalid away score', () => {
            const match = { home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 'invalid' };
            const result = validateMatchScores(match);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Away score must be a valid number');
        });

        it('should accumulate multiple errors', () => {
            const match = { home: 'Team A', away: 'Team B', homeScore: -1, awayScore: 'invalid' };
            const result = validateMatchScores(match);
            expect(result.isValid).toBe(false);
            expect(result.errors).toHaveLength(2);
        });
    });

    describe('validateRound', () => {
        it('should accept valid round with regular matches', () => {
            const round = [
                { home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 },
                { home: 'Team C', away: 'Team D', homeScore: null, awayScore: null }
            ];
            const result = validateRound(round, 0);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
            expect(result.sanitizedRound).toHaveLength(2);
        });

        it('should accept round with bye match', () => {
            const round = [
                { home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 },
                { bye: 'Team C' }
            ];
            const result = validateRound(round, 0);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
            expect(result.sanitizedRound[1]).toEqual({ bye: 'Team C' });
        });

        it('should sanitize bye team names', () => {
            const round = [{ bye: '  Team C  ' }];
            const result = validateRound(round, 0);
            expect(result.isValid).toBe(true);
            expect(result.sanitizedRound[0]).toEqual({ bye: 'Team C' });
        });

        it('should reject non-array input', () => {
            const result = validateRound('not an array', 1);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Round 2 must be an array of matches');
            expect(result.sanitizedRound).toEqual([]);
        });

        it('should reject match missing teams', () => {
            const round = [{ homeScore: 2, awayScore: 1 }];
            const result = validateRound(round, 0);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Round 1, match 1: home and away teams are required');
        });

        it('should reject non-string team names', () => {
            const round = [{ home: 123, away: 'Team B', homeScore: 2, awayScore: 1 }];
            const result = validateRound(round, 0);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Round 1, match 1: team names must be strings');
        });

        it('should reject empty team names', () => {
            const round = [{ home: '', away: 'Team B', homeScore: 2, awayScore: 1 }];
            const result = validateRound(round, 0);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Round 1, match 1: team names cannot be empty');
        });

        it('should reject team playing against itself', () => {
            const round = [{ home: 'Team A', away: 'Team A', homeScore: 2, awayScore: 1 }];
            const result = validateRound(round, 0);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Round 1, match 1: team cannot play against itself');
        });

        it('should reject invalid bye team name', () => {
            const round = [{ bye: '' }];
            const result = validateRound(round, 0);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Round 1, match 1: bye team name is required');
        });

        it('should sanitize team names', () => {
            const round = [{ home: '  Team A  ', away: '  Team B  ', homeScore: 2, awayScore: 1 }];
            const result = validateRound(round, 0);
            expect(result.isValid).toBe(true);
            expect(result.sanitizedRound[0].home).toBe('Team A');
            expect(result.sanitizedRound[0].away).toBe('Team B');
        });

        it('should include round context in score error messages', () => {
            const round = [{ home: 'Team A', away: 'Team B', homeScore: -1, awayScore: 1 }];
            const result = validateRound(round, 2);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Round 3, match 1: Home score cannot be less than 0');
        });
    });

    describe('validateScheduleData', () => {
        it('should accept valid schedule data', () => {
            const scheduleData = {
                anchorIndex: 1,
                rounds: [
                    [{ home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 }],
                    [{ bye: 'Team C' }]
                ]
            };
            const result = validateScheduleData(scheduleData);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
            expect(result.sanitizedData.anchorIndex).toBe(1);
            expect(result.sanitizedData.rounds).toHaveLength(2);
        });

        it('should accept schedule with default anchorIndex', () => {
            const scheduleData = {
                rounds: [
                    [{ home: 'Team A', away: 'Team B', homeScore: null, awayScore: null }]
                ]
            };
            const result = validateScheduleData(scheduleData);
            expect(result.isValid).toBe(true);
            expect(result.sanitizedData.anchorIndex).toBe(0);
        });

        it('should reject null input', () => {
            const result = validateScheduleData(null);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Schedule data must be a valid object');
            expect(result.sanitizedData).toBe(null);
        });

        it('should reject missing rounds', () => {
            const scheduleData = { anchorIndex: 1 };
            const result = validateScheduleData(scheduleData);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Rounds array is required');
        });

        it('should reject non-array rounds', () => {
            const scheduleData = { rounds: 'not an array' };
            const result = validateScheduleData(scheduleData);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Rounds must be an array');
        });

        it('should reject invalid anchorIndex', () => {
            const scheduleData = {
                anchorIndex: -1,
                rounds: []
            };
            const result = validateScheduleData(scheduleData);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Anchor index must be a non-negative integer');
        });

        it('should reject non-integer anchorIndex', () => {
            const scheduleData = {
                anchorIndex: 1.5,
                rounds: []
            };
            const result = validateScheduleData(scheduleData);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Anchor index must be a non-negative integer');
        });

        it('should propagate round validation errors', () => {
            const scheduleData = {
                rounds: [
                    [{ home: 'Team A', away: 'Team A', homeScore: 2, awayScore: 1 }]
                ]
            };
            const result = validateScheduleData(scheduleData);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Round 1, match 1: team cannot play against itself');
        });

        it('should handle empty rounds array', () => {
            const scheduleData = { rounds: [] };
            const result = validateScheduleData(scheduleData);
            expect(result.isValid).toBe(true);
            expect(result.sanitizedData.rounds).toEqual([]);
        });
    });

    describe('validateGameRequest', () => {
        it('should accept valid game request', () => {
            const requestBody = {
                anchorIndex: 1,
                rounds: [
                    [{ home: 'Team A', away: 'Team B', homeScore: 2, awayScore: 1 }]
                ]
            };
            const result = validateGameRequest(requestBody);
            expect(result.isValid).toBe(true);
            expect(result.errors).toEqual([]);
            expect(result.sanitizedData).toBeDefined();
        });

        it('should reject null request body', () => {
            const result = validateGameRequest(null);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Request body must be a valid JSON object');
            expect(result.sanitizedData).toBe(null);
        });

        it('should propagate schedule validation errors', () => {
            const requestBody = {
                rounds: [
                    [{ home: 'Team A', away: 'Team B', homeScore: -1, awayScore: 1 }]
                ]
            };
            const result = validateGameRequest(requestBody);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Round 1, match 1: Home score cannot be less than 0');
        });

        it('should handle missing rounds', () => {
            const requestBody = { anchorIndex: 1 };
            const result = validateGameRequest(requestBody);
            expect(result.isValid).toBe(false);
            expect(result.errors).toContain('Rounds array is required');
        });
    });
});
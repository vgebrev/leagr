import { describe, it, expect } from 'vitest';
import { findLeagueMatch, findKnockoutMatch, updateActionCount } from '$lib/shared/matchUtils.js';

describe('findLeagueMatch', () => {
    const rounds = [
        [
            { home: 'Blue', away: 'White', homeScore: null, awayScore: null },
            { home: 'Orange', away: 'Green', homeScore: 1, awayScore: 0 }
        ],
        [{ home: 'Blue', away: 'Green', homeScore: null, awayScore: null }]
    ];

    it('returns correct match for valid 1-indexed params', () => {
        expect(findLeagueMatch(rounds, '1', '1')).toBe(rounds[0][0]);
        expect(findLeagueMatch(rounds, '1', '2')).toBe(rounds[0][1]);
        expect(findLeagueMatch(rounds, '2', '1')).toBe(rounds[1][0]);
    });

    it('returns null for out-of-range round', () => {
        expect(findLeagueMatch(rounds, '3', '1')).toBeNull();
    });

    it('returns null for out-of-range match', () => {
        expect(findLeagueMatch(rounds, '1', '5')).toBeNull();
    });

    it('returns null when rounds is empty or null', () => {
        expect(findLeagueMatch([], '1', '1')).toBeNull();
        expect(findLeagueMatch(null, '1', '1')).toBeNull();
    });

    it('returns null when params are null or missing', () => {
        expect(findLeagueMatch(rounds, null, '1')).toBeNull();
        expect(findLeagueMatch(rounds, '1', null)).toBeNull();
    });
});

describe('findKnockoutMatch', () => {
    const bracket = {
        teams: ['Blue', 'White', 'Orange', 'Green'],
        bracket: [
            {
                round: 'semi',
                match: 1,
                home: 'Blue',
                away: 'White',
                homeScore: null,
                awayScore: null
            },
            { round: 'semi', match: 2, home: 'Orange', away: 'Green', homeScore: 2, awayScore: 1 },
            { round: 'final', match: 1, home: null, away: null, homeScore: null, awayScore: null }
        ]
    };

    it('returns correct match by round name and match number', () => {
        expect(findKnockoutMatch(bracket, 'semi', '1')).toBe(bracket.bracket[0]);
        expect(findKnockoutMatch(bracket, 'semi', '2')).toBe(bracket.bracket[1]);
        expect(findKnockoutMatch(bracket, 'final', '1')).toBe(bracket.bracket[2]);
    });

    it('returns null when round name does not exist', () => {
        expect(findKnockoutMatch(bracket, 'quarter', '1')).toBeNull();
    });

    it('returns null when match number does not exist', () => {
        expect(findKnockoutMatch(bracket, 'semi', '5')).toBeNull();
    });

    it('returns null for null/missing bracket', () => {
        expect(findKnockoutMatch(null, 'semi', '1')).toBeNull();
        expect(findKnockoutMatch({}, 'semi', '1')).toBeNull();
    });

    it('returns null when params are null', () => {
        expect(findKnockoutMatch(bracket, null, '1')).toBeNull();
        expect(findKnockoutMatch(bracket, 'semi', null)).toBeNull();
    });
});

describe('updateActionCount', () => {
    it('increments a new player from zero', () => {
        expect(updateActionCount(null, 'Alice', 1)).toEqual({ Alice: 1 });
        expect(updateActionCount({}, 'Alice', 1)).toEqual({ Alice: 1 });
    });

    it('increments an existing player', () => {
        expect(updateActionCount({ Alice: 2 }, 'Alice', 1)).toEqual({ Alice: 3 });
    });

    it('decrements an existing player', () => {
        expect(updateActionCount({ Alice: 2 }, 'Alice', -1)).toEqual({ Alice: 1 });
    });

    it('removes the key when count reaches zero', () => {
        expect(updateActionCount({ Alice: 1 }, 'Alice', -1)).toBeNull();
    });

    it('removes the key when count would go below zero', () => {
        expect(updateActionCount({ Alice: 1 }, 'Alice', -5)).toBeNull();
    });

    it('does not mutate the original actions object', () => {
        const original = { Alice: 2 };
        updateActionCount(original, 'Alice', 1);
        expect(original).toEqual({ Alice: 2 });
    });

    it('returns null when the result would be an empty object', () => {
        expect(updateActionCount({ Alice: 1 }, 'Alice', -1)).toBeNull();
    });

    it('preserves other players when updating one', () => {
        expect(updateActionCount({ Alice: 2, Bob: 1 }, 'Alice', -1)).toEqual({ Alice: 1, Bob: 1 });
    });

    it('removes one player key while keeping others', () => {
        expect(updateActionCount({ Alice: 1, Bob: 2 }, 'Alice', -1)).toEqual({ Bob: 2 });
    });
});

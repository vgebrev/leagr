import { describe, it, expect } from 'vitest';
import { appearanceDetail } from '#lib/server/sessionDetails.js';

const ratings = { elo: 1042.4 };
const ranking = { rank: 3, totalPlayers: 20, rankingPoints: 55 };

describe('appearanceDetail', () => {
    it('flattens a played history entry into the appearance card fields', () => {
        const entry = {
            team: 'blue lions',
            points: { appearance: 2, match: 9, bonus: 3, knockout: 4, total: 18 },
            performance: {
                leaguePosition: 1,
                cupProgress: 'semi',
                leagueWinner: true,
                cupWinner: false
            },
            stats: { goals: 4, offActions: 2, defActions: 0, saveActions: 0 },
            ratings,
            ranking
        };

        expect(appearanceDetail(entry, { mvp: 6, goldenBoot: 4, playmaker: 5 })).toEqual({
            team: 'blue lions',
            appearancePoints: 2,
            matchPoints: 9,
            bonusPoints: 3,
            knockoutPoints: 4,
            totalPoints: 18,
            leagueWinner: true,
            cupWinner: false,
            eloRating: 1042.4,
            leaguePosition: 1,
            cupProgress: 'semi',
            awards: ['mvp', 'goldenBoot']
        });
    });

    it('defaults missing performance and awards', () => {
        const entry = {
            team: 'white wolves',
            points: { appearance: 2, match: 0, bonus: 0, knockout: 0, total: 2 },
            ratings: {},
            ranking
        };

        expect(appearanceDetail(entry, undefined)).toMatchObject({
            leagueWinner: false,
            cupWinner: false,
            leaguePosition: null,
            eloRating: 1000,
            awards: []
        });
    });

    it('returns no appearance fields for a missed session', () => {
        expect(appearanceDetail({ ratings, ranking }, { mvp: 6 })).toEqual({});
    });
});

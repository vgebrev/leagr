import { describe, it, expect, beforeEach } from 'vitest';
import { createTeamGenerator } from '$lib/server/teamGenerator.js';

/**
 * Build a rankings object where every player is "established" (70 ELO games, so the
 * provisional rating equals the actual rating) with the supplied ELO.
 * @param {Record<string, number>} elos - player name -> ELO rating
 */
function makeRankings(elos) {
    /** @type {Record<string, any>} */
    const players = {};
    for (const [name, rating] of Object.entries(elos)) {
        players[name] = {
            rankingPoints: rating,
            appearances: 20,
            attackingRating: 0.5,
            controlRating: 0.5,
            elo: { rating, gamesPlayed: 70 }
        };
    }
    return { players };
}

describe('TeamGenerator auto-assign helpers', () => {
    let generator;
    const TEST_LEAGUE_ID = 'test-auto-assign';

    const settings = {
        teamGeneration: {
            minTeams: 2,
            maxTeams: 6,
            minPlayersPerTeam: 3,
            maxPlayersPerTeam: 7
        }
    };

    beforeEach(() => {
        generator = createTeamGenerator().setLeague(TEST_LEAGUE_ID).setSettings(settings);
    });

    describe('findBestTeamForPlayer', () => {
        it('prefers the smaller team even when balance favours a fuller team', () => {
            // Blue has 5 (lower ELO), White has 6 (higher ELO). Pure balance would send a
            // strong player to Blue; but equal-sizing comes first, and Blue is the only 5.
            const teams = {
                Blue: ['b1', 'b2', 'b3', 'b4', 'b5'],
                White: ['w1', 'w2', 'w3', 'w4', 'w5', 'w6']
            };
            const elos = {
                b1: 900,
                b2: 900,
                b3: 900,
                b4: 900,
                b5: 900,
                w1: 1100,
                w2: 1100,
                w3: 1100,
                w4: 1100,
                w5: 1100,
                w6: 1100,
                X: 1000
            };
            generator.setRankings(makeRankings(elos));
            generator.prepareAnchors([...Object.values(teams).flat(), 'X']);

            const team = generator.findBestTeamForPlayer(teams, 'X', { maxPlayersPerTeam: 7 });
            expect(team).toBe('Blue');
        });

        it('among equal-sized teams, picks the one that improves balance', () => {
            // Both teams have 2 players; Strong team is high ELO, Weak team is low ELO.
            // A strong newcomer should join the Weak team to close the gap.
            const teams = {
                Strong: ['s1', 's2'],
                Weak: ['k1', 'k2']
            };
            const elos = {
                s1: 1200,
                s2: 1200,
                k1: 800,
                k2: 800,
                X: 1200
            };
            generator.setRankings(makeRankings(elos));
            generator.prepareAnchors([...Object.values(teams).flat(), 'X']);

            const team = generator.findBestTeamForPlayer(teams, 'X', { maxPlayersPerTeam: 7 });
            expect(team).toBe('Weak');
        });

        it('returns null when every team is at max capacity', () => {
            const teams = {
                Blue: ['b1', 'b2', 'b3'],
                White: ['w1', 'w2', 'w3']
            };
            const elos = Object.fromEntries(
                [...Object.values(teams).flat(), 'X'].map((n) => [n, 1000])
            );
            generator.setRankings(makeRankings(elos));
            generator.prepareAnchors(Object.keys(elos));

            const team = generator.findBestTeamForPlayer(teams, 'X', { maxPlayersPerTeam: 3 });
            expect(team).toBeNull();
        });

        it('counts non-null slots so a team with an empty slot is treated as smaller', () => {
            const teams = {
                Blue: ['b1', null, 'b3'], // 2 players
                White: ['w1', 'w2', 'w3'] // 3 players
            };
            const elos = Object.fromEntries(
                ['b1', 'b3', 'w1', 'w2', 'w3', 'X'].map((n) => [n, 1000])
            );
            generator.setRankings(makeRankings(elos));
            generator.prepareAnchors(Object.keys(elos));

            const team = generator.findBestTeamForPlayer(teams, 'X', { maxPlayersPerTeam: 7 });
            expect(team).toBe('Blue');
        });
    });

    describe('findBestPlayerForTeam', () => {
        it('picks the candidate that best balances the chosen team', () => {
            // Weak team should be filled by the strongest available candidate.
            const teams = {
                Strong: ['s1', 's2'],
                Weak: ['k1', 'k2']
            };
            const elos = {
                s1: 1200,
                s2: 1200,
                k1: 800,
                k2: 800,
                StrongCandidate: 1200,
                WeakCandidate: 800
            };
            generator.setRankings(makeRankings(elos));
            generator.prepareAnchors([
                ...Object.values(teams).flat(),
                'StrongCandidate',
                'WeakCandidate'
            ]);

            const best = generator.findBestPlayerForTeam(teams, 'Weak', [
                'StrongCandidate',
                'WeakCandidate'
            ]);
            expect(best).toBe('StrongCandidate');
        });

        it('returns the only candidate without scoring', () => {
            const teams = { Blue: ['b1'], White: ['w1'] };
            const elos = { b1: 1000, w1: 1000, Solo: 1000 };
            generator.setRankings(makeRankings(elos));
            generator.prepareAnchors(Object.keys(elos));

            expect(generator.findBestPlayerForTeam(teams, 'Blue', ['Solo'])).toBe('Solo');
        });
    });

    describe('planAutoAssignAll', () => {
        it('distributes candidates evenly across equal teams', () => {
            const teams = { Blue: ['b1', 'b2'], White: ['w1', 'w2'] };
            const elos = Object.fromEntries(
                ['b1', 'b2', 'w1', 'w2', 'X1', 'X2'].map((n) => [n, 1000])
            );
            generator.setRankings(makeRankings(elos));
            generator.prepareAnchors(Object.keys(elos));

            const plan = generator.planAutoAssignAll(teams, ['X1', 'X2'], {
                maxPlayersPerTeam: 7,
                playerLimit: 24
            });

            expect(plan).toHaveLength(2);
            // One went to each team -> both end at 3
            const teamsUsed = new Set(plan.map((p) => p.team));
            expect(teamsUsed.size).toBe(2);
        });

        it('respects the player cap and preserves candidate order (waiting first)', () => {
            const teams = { Blue: ['b1', 'b2'], White: ['w1', 'w2'] }; // 4 assigned
            const elos = Object.fromEntries(
                ['b1', 'b2', 'w1', 'w2', 'Waiting', 'Unassigned'].map((n) => [n, 1000])
            );
            generator.setRankings(makeRankings(elos));
            generator.prepareAnchors(Object.keys(elos));

            // Cap of 5 leaves room for exactly one more; the first candidate must win
            const plan = generator.planAutoAssignAll(teams, ['Waiting', 'Unassigned'], {
                maxPlayersPerTeam: 7,
                playerLimit: 5,
                assignedCount: 4
            });

            expect(plan).toHaveLength(1);
            expect(plan[0].player).toBe('Waiting');
        });

        it('stops once every team is at max capacity', () => {
            const teams = { Blue: ['b1', 'b2', 'b3'], White: ['w1', 'w2'] };
            const elos = Object.fromEntries(
                ['b1', 'b2', 'b3', 'w1', 'w2', 'X1', 'X2', 'X3'].map((n) => [n, 1000])
            );
            generator.setRankings(makeRankings(elos));
            generator.prepareAnchors(Object.keys(elos));

            const plan = generator.planAutoAssignAll(teams, ['X1', 'X2', 'X3'], {
                maxPlayersPerTeam: 3,
                playerLimit: 24
            });

            // Only White has room (1 slot) -> exactly one assignment, to White
            expect(plan).toHaveLength(1);
            expect(plan[0].team).toBe('White');
        });
    });
});

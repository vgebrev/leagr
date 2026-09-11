import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRankingsManager } from '$lib/server/rankings.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Shot Stopper is scored on two halves: a rate over sessions attended-with-tracking (the
 * same denominator the other three individual stats use) and the season save total. The
 * session files record no keeper, so "in goal" is proxied by "recorded at least one save",
 * and sessionsInGoal is the eligibility gate rather than the divisor.
 *
 * These run through updateRankings() rather than against the counters directly, because
 * the whole point is what a real session file does to them.
 */
describe('Rankings — saves are scored on rate and volume', () => {
    const TEST_LEAGUE = 'test-shot-stopper';
    const TEST_DATA_PATH = path.join(process.cwd(), 'data', TEST_LEAGUE);

    /** Blue vs White, one league game, optional save maps. */
    const session = (homeSaves, awaySaves) => ({
        players: { available: [], waitingList: [] },
        teams: { Blue: ['Alice', 'Bob'], White: ['Carol', 'Dave'] },
        games: {
            rounds: [
                [
                    {
                        home: 'Blue',
                        away: 'White',
                        homeScore: 1,
                        awayScore: 2,
                        ...(homeSaves ? { homeSaveActions: homeSaves } : {}),
                        ...(awaySaves ? { awaySaveActions: awaySaves } : {})
                    }
                ]
            ]
        },
        settings: { discipline: { enabled: false } }
    });

    const write = (date, data) =>
        fs.writeFile(path.join(TEST_DATA_PATH, `${date}.json`), JSON.stringify(data, null, 2));

    beforeEach(async () => {
        await fs.mkdir(TEST_DATA_PATH, { recursive: true });
    });

    afterEach(async () => {
        await fs.rm(TEST_DATA_PATH, { recursive: true, force: true });
    });

    it('counts only the sessions a player recorded a save in', async () => {
        // Alice keeps in week one, Bob in week two, Carol in both. Dave never does.
        await write('2026-02-07', session({ Alice: 3 }, { Carol: 4 }));
        await write('2026-02-14', session({ Bob: 5 }, { Carol: 2 }));

        const rankings = await createRankingsManager().setLeague(TEST_LEAGUE).updateRankings(2026);
        const p = rankings.players;

        expect(p.Alice.appearances).toBe(2);
        expect(p.Bob.appearances).toBe(2);

        expect(p.Alice.sessionsInGoal).toBe(1);
        expect(p.Bob.sessionsInGoal).toBe(1);
        expect(p.Carol.sessionsInGoal).toBe(2);
        expect(p.Dave.sessionsInGoal).toBe(0);
    });

    it('leaves the save totals alone — only the denominator moves', async () => {
        await write('2026-02-07', session({ Alice: 3 }, { Carol: 4 }));
        await write('2026-02-14', session({ Bob: 5 }, { Carol: 2 }));

        const rankings = await createRankingsManager().setLeague(TEST_LEAGUE).updateRankings(2026);
        const p = rankings.players;

        expect(p.Alice.saveActions).toBe(3);
        expect(p.Bob.saveActions).toBe(5);
        expect(p.Carol.saveActions).toBe(6);
        expect(p.Dave.saveActions).toBe(0);
    });

    it('dilutes the rate half of an outfield week but not the volume half', async () => {
        // Alice keeps twice at 4 saves a session, then attends a third and plays outfield.
        // The rate is over sessions attended, so it drops 8/2 -> 8/3; the season total is
        // untouched. Halving the damage this way is what lets the better denominator back
        // in without an outfield week costing a badge outright.
        await write('2026-02-07', session({ Alice: 4 }, { Carol: 1 }));
        await write('2026-02-14', session({ Alice: 4 }, { Carol: 1 }));
        await write('2026-02-21', session({ Bob: 2 }, { Carol: 1 }));

        const rankings = await createRankingsManager().setLeague(TEST_LEAGUE).updateRankings(2026);
        const alice = rankings.players.Alice;
        const saves = alice.history['2026-02-21'].ratings.saveActions;

        expect(alice.appearances).toBe(3);
        expect(alice.sessionsWithSaveActions).toBe(3);
        expect(alice.sessionsInGoal).toBe(2);
        expect(saves.perSession).toBe(2.667);
        expect(saves.total).toBe(8);

        // The week before, the same 8 saves read as a rate of 4.
        expect(alice.history['2026-02-14'].ratings.saveActions.perSession).toBe(4);
    });

    it('separates the two halves of the norm on the record', async () => {
        // Alice and Bob end on the same rate; Alice has done twice the keeping. Only the
        // volume half can tell them apart, so it must be stored and normalised separately.
        await write('2026-02-07', session({ Alice: 4 }, { Bob: 2 }));
        await write('2026-02-14', session({ Alice: 4 }, { Bob: 2 }));

        const rankings = await createRankingsManager().setLeague(TEST_LEAGUE).updateRankings(2026);
        const a = rankings.players.Alice.history['2026-02-14'].ratings.saveActions;
        const b = rankings.players.Bob.history['2026-02-14'].ratings.saveActions;

        expect(a.perSession).toBe(4);
        expect(b.perSession).toBe(2);
        expect(a.total).toBe(8);
        expect(b.total).toBe(4);
        expect(a).toHaveProperty('rateNorm');
        expect(a).toHaveProperty('volumeNorm');
    });

    it('carries the season total forward through a session the player missed', async () => {
        // A cumulative count does not reset when somebody stays home, and the volume half
        // of the norm reads it on every date, including the ones they were absent for.
        await write('2026-02-07', session({ Alice: 5 }, { Carol: 1 }));
        await write(
            '2026-02-14',
            (() => {
                const s = session({ Bob: 2 }, { Carol: 1 });
                s.teams = { Blue: ['Bob'], White: ['Carol', 'Dave'] };
                return s;
            })()
        );

        const rankings = await createRankingsManager().setLeague(TEST_LEAGUE).updateRankings(2026);
        const alice = rankings.players.Alice;

        // She did not appear, so 02-14 is a carry-forward entry: no points, no team.
        expect(alice.appearances).toBe(1);
        expect(alice.sessionsWithSaveActions).toBe(1);
        expect(alice.history['2026-02-14'].team).toBeUndefined();

        const carried = alice.history['2026-02-14'].ratings.saveActions;
        expect(carried.perSession).toBe(5);
        expect(carried.total).toBe(5);
    });

    it('reports no rate at all for a player who has never kept goal', async () => {
        await write('2026-02-07', session({ Alice: 3 }, { Carol: 4 }));

        const rankings = await createRankingsManager().setLeague(TEST_LEAGUE).updateRankings(2026);
        const dave = rankings.players.Dave;

        // He attended a tracked session, so the denominator is non-zero — but never
        // being measured at a stat is not the same as scoring zero at it, and a phantom
        // zero here would drag the trait bands down for every real keeper.
        expect(dave.sessionsWithSaveActions).toBe(1);
        expect(dave.sessionsInGoal).toBe(0);
        expect(dave.history['2026-02-07'].ratings.saveActions.perSession).toBeNull();
        expect(dave.history['2026-02-07'].ratings.saveActions.total).toBeNull();
        expect(dave.saveActionsNorm).toBeNull();
    });

    it('still records the raw per-session count, zero included', async () => {
        // history[].stats is the momentum boards' substrate and the transparency report's
        // only evidence of who was in goal — an outfield session must stay a tracked zero,
        // distinct from the null that means "saves were not recorded that week".
        await write('2026-02-07', session({ Alice: 3 }, { Carol: 4 }));
        await write('2026-02-14', session(null, null));

        const rankings = await createRankingsManager().setLeague(TEST_LEAGUE).updateRankings(2026);
        const p = rankings.players;

        expect(p.Bob.history['2026-02-07'].stats.saveActions).toBe(0);
        expect(p.Alice.history['2026-02-07'].stats.saveActions).toBe(3);
        expect(p.Alice.history['2026-02-14'].stats.saveActions).toBeNull();
    });

    it('ignores sessions where saves were not recorded league-wide', async () => {
        await write('2026-02-07', session(null, null));
        await write('2026-02-14', session({ Alice: 3 }, null));

        const rankings = await createRankingsManager().setLeague(TEST_LEAGUE).updateRankings(2026);

        expect(rankings.players.Alice.sessionsInGoal).toBe(1);
        expect(rankings.players.Carol.sessionsInGoal).toBe(0);
        // Only the second session was tracked, so only it counts toward the rate.
        expect(rankings.players.Alice.sessionsWithSaveActions).toBe(1);
        expect(rankings.players.Alice.history['2026-02-14'].ratings.saveActions.perSession).toBe(3);
    });
});

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRankingsManager } from '$lib/server/rankings.js';
import fs from 'fs/promises';
import path from 'path';

/**
 * Saves are measured per session in goal, not per session attended. The session files
 * record no keeper, so "in goal" is proxied by "recorded at least one save".
 *
 * These run through updateRankings() rather than against the counter directly, because
 * the whole point is what a real session file does to the denominator.
 */
describe('Rankings — saves are counted per session in goal', () => {
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

    it('does not dilute a keeper who turns out and plays outfield', async () => {
        // Alice keeps twice at 4 saves a session, then attends a third and never touches
        // the ball. Under the old attendance denominator this would read 8/3 = 2.667.
        await write('2026-02-07', session({ Alice: 4 }, { Carol: 1 }));
        await write('2026-02-14', session({ Alice: 4 }, { Carol: 1 }));
        await write('2026-02-21', session({ Bob: 2 }, { Carol: 1 }));

        const rankings = await createRankingsManager().setLeague(TEST_LEAGUE).updateRankings(2026);
        const alice = rankings.players.Alice;

        expect(alice.appearances).toBe(3);
        expect(alice.sessionsInGoal).toBe(2);
        expect(alice.history['2026-02-21'].ratings.saveActions.perSession).toBe(4);
    });

    it('reports no rate at all for a player who has never kept goal', async () => {
        await write('2026-02-07', session({ Alice: 3 }, { Carol: 4 }));

        const rankings = await createRankingsManager().setLeague(TEST_LEAGUE).updateRankings(2026);
        const dave = rankings.players.Dave;

        expect(dave.sessionsInGoal).toBe(0);
        expect(dave.history['2026-02-07'].ratings.saveActions.perSession).toBeNull();
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
    });
});

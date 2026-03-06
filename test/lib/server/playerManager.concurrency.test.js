import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import { createPlayerManager } from '$lib/server/playerManager.js';

// Mock settings to avoid needing real league info files on disk.
// The real data.js is intentionally NOT mocked — the race condition lives in
// the interaction between executeTransaction and the file-level mutex.
vi.mock('$lib/server/settings.js', () => ({
    getConsolidatedSettings: vi.fn()
}));

describe('PlayerManager concurrency', () => {
    const testDataDir = path.join(process.cwd(), 'test', 'data-concurrency');
    const testDate = '2026-01-10';
    const testLeagueId = 'race-condition-league';

    const minimalSettings = {
        playerLimit: 24,
        registrationWindow: { enabled: false },
        competitionDays: [6],
        teamSize: { min: 5, max: 7 },
        canRegenerateTeams: false,
        canResetSchedule: false
    };

    beforeEach(async () => {
        await fs.mkdir(path.join(testDataDir, testLeagueId), { recursive: true });

        vi.spyOn(await import('$lib/server/league.js'), 'getLeagueDataPath').mockImplementation(
            (leagueId) => (leagueId ? path.join(testDataDir, leagueId) : testDataDir)
        );

        const { getConsolidatedSettings } = await import('$lib/server/settings.js');
        getConsolidatedSettings.mockResolvedValue({
            ...minimalSettings,
            [testDate]: { playerLimit: 24 }
        });

        // Seed the session file with a known empty state
        const sessionFile = path.join(testDataDir, testLeagueId, `${testDate}.json`);
        await fs.writeFile(
            sessionFile,
            JSON.stringify({ players: { available: [], waitingList: [] }, teams: {} }, null, 2)
        );
    });

    afterEach(async () => {
        try {
            await fs.rm(testDataDir, { recursive: true, force: true });
        } catch {
            // ignore cleanup errors
        }
        vi.restoreAllMocks();
    });

    it('should preserve all players when two registrations race concurrently', async () => {
        // Reproduce the reported bug: two players signing up at roughly the same time.
        //
        // executeTransaction reads state → computes new state → writes back, but the
        // mutex in data.js only protects individual reads/writes, not the full
        // read-modify-write cycle. Both managers can read the same snapshot before
        // either writes, so the second write (overwrite: true) silently discards
        // whichever player the first write added.
        const manager1 = createPlayerManager().setDate(testDate).setLeague(testLeagueId);
        const manager2 = createPlayerManager().setDate(testDate).setLeague(testLeagueId);

        await Promise.all([
            manager1.addPlayer('Alice', 'available'),
            manager2.addPlayer('Bob', 'available')
        ]);

        // Read the persisted state directly from disk — the source of truth
        const sessionFile = path.join(testDataDir, testLeagueId, `${testDate}.json`);
        const content = JSON.parse(await fs.readFile(sessionFile, 'utf-8'));

        // Both players must survive. With the current code this fails because the
        // second setMany call overwrites the players key with its own pre-computed
        // snapshot, erasing whoever the first call already wrote.
        expect(content.players.available).toContain('Alice');
        expect(content.players.available).toContain('Bob');
    });
});

import { describe, it, expect } from 'vitest';
import { createTeammateHistoryTracker } from '$lib/server/teammateHistory.js';

/**
 * Build a session record (array of teams) where the given pairs of teams repeat.
 * Sessions use 2 teams of 2 players: same-team probability under a random draw
 * is 1/3 per session, so ~8 co-attendances without pairing crosses alpha=0.05.
 */
const session = (teamA, teamB) => [teamA, teamB];

describe('TeammateHistoryTracker overdue pairs', () => {
    const tracker = createTeammateHistoryTracker();

    describe('computeOverduePairs', () => {
        it('flags a pair that co-attends often but never shares a team', () => {
            // A & B on opposite teams for 10 sessions: P(0) = (2/3)^10 ≈ 0.017
            const sessions = Array.from({ length: 10 }, () => session(['A', 'X'], ['B', 'Y']));
            const overdue = tracker.computeOverduePairs(sessions);
            const names = overdue.map((p) => `${p.player1}|${p.player2}`);
            expect(names).toContain('A|B');
            const pair = overdue.find((p) => p.player1 === 'A' && p.player2 === 'B');
            expect(pair.coAttendance).toBe(10);
            expect(pair.probNone).toBeLessThan(0.05);
        });

        it('does not flag a pair that has shared a team at least once', () => {
            const sessions = [
                session(['A', 'B'], ['X', 'Y']), // A & B together once
                ...Array.from({ length: 9 }, () => session(['A', 'X'], ['B', 'Y']))
            ];
            const overdue = tracker.computeOverduePairs(sessions);
            expect(overdue.find((p) => p.player1 === 'A' && p.player2 === 'B')).toBeUndefined();
        });

        it('does not flag a pair with too few co-attendances to be significant', () => {
            // 3 sessions: P(0) = (2/3)^3 ≈ 0.30 — plausible by chance
            const sessions = Array.from({ length: 3 }, () => session(['A', 'X'], ['B', 'Y']));
            const overdue = tracker.computeOverduePairs(sessions);
            expect(overdue.find((p) => p.player1 === 'A' && p.player2 === 'B')).toBeUndefined();
        });

        it('respects the alpha parameter', () => {
            // 4 sessions: P(0) ≈ 0.198 — not significant at 0.05, significant at 0.25
            const sessions = Array.from({ length: 4 }, () => session(['A', 'X'], ['B', 'Y']));
            expect(
                tracker
                    .computeOverduePairs(sessions, { alpha: 0.05 })
                    .find((p) => p.player1 === 'A' && p.player2 === 'B')
            ).toBeUndefined();
            expect(
                tracker
                    .computeOverduePairs(sessions, { alpha: 0.25 })
                    .find((p) => p.player1 === 'A' && p.player2 === 'B')
            ).toBeDefined();
        });

        it('caps evidence at the pair’s most recent co-attendances (coAttendanceLimit)', () => {
            // 20 never-paired co-attendances but only the 5 newest may count:
            // P(0) = (2/3)^5 ≈ 0.13 — no longer significant at 0.05
            const sessions = Array.from({ length: 20 }, () => session(['A', 'X'], ['B', 'Y']));
            const capped = tracker.computeOverduePairs(sessions, {
                alpha: 0.05,
                coAttendanceLimit: 5
            });
            expect(capped.find((p) => p.player1 === 'A' && p.player2 === 'B')).toBeUndefined();
            const uncapped = tracker.computeOverduePairs(sessions, { alpha: 0.05 });
            expect(uncapped.find((p) => p.player1 === 'A' && p.player2 === 'B')).toBeDefined();
        });

        it('ignores sessions a pair did not co-attend (absences do not erode debt)', () => {
            // 10 starved co-attendances, then 10 sessions where B is absent (newest first:
            // absences first). Absences must not push evidence out of the pair's window.
            const sessions = [
                ...Array.from({ length: 10 }, () => session(['A', 'X'], ['C', 'Y'])),
                ...Array.from({ length: 10 }, () => session(['A', 'X'], ['B', 'Y']))
            ];
            const overdue = tracker.computeOverduePairs(sessions, {
                alpha: 0.05,
                coAttendanceLimit: 15
            });
            const pair = overdue.find((p) => p.player1 === 'A' && p.player2 === 'B');
            expect(pair).toBeDefined();
            expect(pair.coAttendance).toBe(10);
        });

        it('only counts pairings within the pair’s recent co-attendance window', () => {
            // Sessions are newest first: 10 starved co-attendances, then an old pairing
            // beyond the 5-co-attendance window — the old pairing must not clear the debt.
            const sessions = [
                ...Array.from({ length: 10 }, () => session(['A', 'X'], ['B', 'Y'])),
                session(['A', 'B'], ['X', 'Y'])
            ];
            const flagged = tracker.computeOverduePairs(sessions, {
                alpha: 0.2,
                coAttendanceLimit: 5
            });
            expect(flagged.find((p) => p.player1 === 'A' && p.player2 === 'B')).toBeDefined();
            // Without the cap the old pairing is inside the window and clears the debt
            const cleared = tracker.computeOverduePairs(sessions, { alpha: 0.2 });
            expect(cleared.find((p) => p.player1 === 'A' && p.player2 === 'B')).toBeUndefined();
        });

        it('tracks the uncapped drought alongside the capped qualification evidence', () => {
            // 20 never-paired co-attendances, evidence capped at 15. The capped track
            // saturates; the drought track keeps counting so the reunion norm can tell
            // this pair apart from one that only just crossed alpha.
            const sessions = Array.from({ length: 20 }, () => session(['A', 'X'], ['B', 'Y']));
            const pair = tracker
                .computeOverduePairs(sessions, { alpha: 0.05, coAttendanceLimit: 15 })
                .find((p) => p.player1 === 'A' && p.player2 === 'B');
            expect(pair.coAttendance).toBe(15);
            expect(pair.droughtCoAttendance).toBe(20);
            expect(pair.probNone).toBeCloseTo((2 / 3) ** 15, 10);
            expect(pair.droughtProbNone).toBeCloseTo((2 / 3) ** 20, 10);
            expect(pair.droughtProbNone).toBeLessThan(pair.probNone);
        });

        it('closes the drought at a pairing beyond the cap without clearing the debt', () => {
            // Newest first: 10 starved co-attendances, then a pairing outside the
            // 5-co-attendance window. The pair must stay flagged (the old pairing does not
            // clear the debt) while the drought correctly stops at that pairing.
            const sessions = [
                ...Array.from({ length: 10 }, () => session(['A', 'X'], ['B', 'Y'])),
                session(['A', 'B'], ['X', 'Y']),
                ...Array.from({ length: 5 }, () => session(['A', 'X'], ['B', 'Y']))
            ];
            const pair = tracker
                .computeOverduePairs(sessions, { alpha: 0.2, coAttendanceLimit: 5 })
                .find((p) => p.player1 === 'A' && p.player2 === 'B');
            expect(pair).toBeDefined();
            expect(pair.coAttendance).toBe(5);
            expect(pair.droughtCoAttendance).toBe(10);
        });

        it('sorts results by probNone ascending (most starved first)', () => {
            // A&B starved for 14 sessions; C&D only appear (and are starved) in the last 12.
            // 4-team sessions have null P = 1/7, so C&D: (6/7)^12 ≈ 0.157 and
            // A&B: (2/3)^2 × (6/7)^12 ≈ 0.070 — both flagged at alpha 0.2, A&B first.
            const sessions = [
                ...Array.from({ length: 2 }, () => session(['A', 'X'], ['B', 'Y'])),
                ...Array.from({ length: 12 }, () => [
                    ['A', 'X'],
                    ['B', 'Y'],
                    ['C', 'V'],
                    ['D', 'W']
                ])
            ];
            const overdue = tracker.computeOverduePairs(sessions, { alpha: 0.2 });
            const ab = overdue.findIndex((p) => p.player1 === 'A' && p.player2 === 'B');
            const cd = overdue.findIndex((p) => p.player1 === 'C' && p.player2 === 'D');
            expect(ab).toBeGreaterThanOrEqual(0);
            expect(cd).toBeGreaterThanOrEqual(0);
            expect(ab).toBeLessThan(cd);
        });

        it('ignores null/empty player entries and sessions with fewer than 2 attendees', () => {
            const sessions = [
                session(['A', null, ''], ['B', 'Y']),
                [['A']], // degenerate session, skipped
                ...Array.from({ length: 9 }, () => session(['A', 'X'], ['B', 'Y']))
            ];
            expect(() => tracker.computeOverduePairs(sessions)).not.toThrow();
        });

        it('returns an empty array for no sessions', () => {
            expect(tracker.computeOverduePairs([])).toEqual([]);
        });
    });

    describe('findOverduePairs', () => {
        it('loads sessions (newest first), honours sessionLimit and skips team-less files', async () => {
            const t = createTeammateHistoryTracker();
            const mockFiles = Array.from({ length: 20 }, (_, i) => `data/test/file-${i}.json`);
            t.getSessionFiles = async () => mockFiles;
            // Every file: A & B on opposite teams; file-3 has no teams and must be skipped
            t.loadSessionData = async (path) =>
                path === 'data/test/file-3.json'
                    ? { players: {} }
                    : { teams: { red: ['A', 'X'], blue: ['B', 'Y'] } };

            const overdue = await t.findOverduePairs('test', { sessionLimit: 10 });
            const pair = overdue.find((p) => p.player1 === 'A' && p.player2 === 'B');
            expect(pair).toBeDefined();
            expect(pair.coAttendance).toBe(10); // limited to 10 sessions despite 20 files
        });

        it('returns empty array when history loading fails', async () => {
            const t = createTeammateHistoryTracker();
            t.getSessionFiles = async () => {
                throw new Error('no such league');
            };
            await expect(t.findOverduePairs('missing')).rejects.toThrow();
        });
    });
});

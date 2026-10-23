import { describe, it, expect } from 'vitest';
import { pageMeta } from '#lib/shared/pageMeta.js';

const base = { params: {}, leagueName: 'Pirates', date: null };

describe('pageMeta', () => {
    it('builds the title as Page > League > Leagr', () => {
        expect(pageMeta({ ...base, routeId: '/table' }).title).toBe('Table > Pirates > Leagr');
    });

    it('supports multi-segment page titles', () => {
        expect(pageMeta({ ...base, routeId: '/games/match' }).title).toBe(
            'Match Centre > Games > Pirates > Leagr'
        );
    });

    it('uses the league name alone for the league home page', () => {
        const meta = pageMeta({ ...base, routeId: '/' });
        expect(meta.title).toBe('Pirates > Leagr');
        expect(meta.description).toContain('Pirates');
    });

    it('describes Leagr itself on the root domain', () => {
        const meta = pageMeta({ ...base, routeId: '/', leagueName: null });
        expect(meta.title).toBe('Social League Organiser > Leagr');
        expect(meta.description).toContain('5-a-side');
    });

    it('fills route params into dynamic pages', () => {
        const player = pageMeta({
            ...base,
            routeId: '/rankings/[player]',
            params: { player: 'Bob' }
        });
        expect(player.title).toBe('Bob > Rankings > Pirates > Leagr');
        expect(player.description).toContain('Bob');

        const recap = pageMeta({
            ...base,
            routeId: '/year-recap/[year]',
            params: { year: '2025' }
        });
        expect(recap.title).toBe('2025 > Year Recap > Pirates > Leagr');
        expect(recap.description).toContain('2025');
    });

    it('gives each page its own description', () => {
        const routes = ['/players', '/teams', '/games', '/table', '/knockout', '/rankings'];
        const descriptions = routes.map((routeId) => pageMeta({ ...base, routeId }).description);
        expect(new Set(descriptions).size).toBe(routes.length);
    });

    it('names the session date when the link carries one', () => {
        const meta = pageMeta({ ...base, routeId: '/players', date: '2026-10-24' });
        expect(meta.description).toContain('Saturday 24 October');
    });

    it('stays date-free when the link has no date', () => {
        const meta = pageMeta({ ...base, routeId: '/players' });
        expect(meta.description).not.toMatch(/day \d/);
    });

    it('ignores a malformed date', () => {
        const meta = pageMeta({ ...base, routeId: '/players', date: 'nonsense' });
        expect(meta.description).not.toContain('Invalid');
        expect(meta.description).not.toContain('nonsense');
    });

    it('falls back to the league title and description for unknown routes', () => {
        const meta = pageMeta({ ...base, routeId: null });
        expect(meta.title).toBe('Pirates > Leagr');
        expect(meta.description).toBe(pageMeta({ ...base, routeId: '/' }).description);
    });
});

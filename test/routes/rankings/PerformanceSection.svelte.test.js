import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import PerformanceSection from '../../../src/routes/rankings/[player]/components/PerformanceSection.svelte';

/**
 * @param {string} date
 * @param {string[]} awards
 */
const session = (date, awards) => ({
    date,
    played: true,
    team: 'blue lions',
    leaguePosition: 2,
    cupProgress: 'semi',
    awards
});

/** @param {object[]} details */
const renderSection = (details) =>
    render(PerformanceSection, {
        props: {
            playerData: { indGoals: 0, offActions: 0, defActions: 0, saveActions: 0, details }
        }
    });

/** @param {HTMLElement} container */
const totals = (container) =>
    Object.fromEntries(
        [...container.querySelectorAll('[data-testid="star-totals"] [data-award]')].map((el) => [
            el.getAttribute('data-award'),
            Number(el.querySelector('.text-2xl')?.textContent?.trim())
        ])
    );

/** @param {HTMLElement} container */
const streaks = (container) =>
    Object.fromEntries(
        [...container.querySelectorAll('[data-streak]')].map((el) => [
            el.getAttribute('data-streak'),
            Number(el.querySelector('.text-2xl')?.textContent?.trim())
        ])
    );

describe('PerformanceSection - Stars of the Day', () => {
    it('totals each award category', () => {
        const { container } = renderSection([
            session('2026-03-07', ['mvp', 'goldenBoot']),
            session('2026-03-14', ['goldenBoot']),
            session('2026-03-21', [])
        ]);

        expect(totals(container)).toEqual({
            mvp: 1,
            goldenBoot: 2,
            playmaker: 0,
            brickWall: 0,
            goldenGlove: 0
        });
    });

    it('hides the totals panel for a player with no awards', () => {
        const { queryByTestId } = renderSection([session('2026-03-07', [])]);

        expect(queryByTestId('star-totals')).toBeNull();
    });

    it('adds award streaks of two or more to the streaks panel', () => {
        const { container } = renderSection([
            session('2026-03-07', ['mvp', 'goldenBoot']),
            session('2026-03-14', ['goldenBoot']),
            session('2026-03-21', ['goldenBoot', 'brickWall'])
        ]);

        expect(streaks(container)).toEqual({ goldenBoot: 3 });
        expect(container.textContent).toContain('Longest Streaks & Doubles');
        expect(container.querySelector('[data-streak]')?.textContent).toContain('Golden Boot');
    });
});

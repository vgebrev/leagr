import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import { pushState } from '$app/navigation';
import AppearanceCard from '#components/AppearanceCard.svelte';

vi.mock('$app/navigation', () => ({ pushState: vi.fn() }));

const detail = {
    date: '2026-03-07',
    rank: 3,
    totalPlayers: 20,
    rankingPoints: 55,
    played: true,
    team: 'blue lions',
    appearancePoints: 2,
    matchPoints: 9,
    bonusPoints: 0,
    knockoutPoints: 4,
    totalPoints: 15,
    leagueWinner: false,
    cupWinner: false,
    eloRating: 1042.4,
    leaguePosition: 2,
    cupProgress: 'semi',
    awards: []
};

/** @param {object} overrides */
const renderCard = (overrides = {}) =>
    render(AppearanceCard, { props: { detail: { ...detail, ...overrides } } });

/** @param {HTMLElement} container */
const awardChips = (container) =>
    [...container.querySelectorAll('[data-award]')].map((el) => el.getAttribute('data-award'));

describe('AppearanceCard', () => {
    beforeEach(() => {
        vi.mocked(pushState).mockClear();
    });

    it('opens the team modal for that session instead of navigating', async () => {
        const { getByRole } = renderCard();

        await fireEvent.click(getByRole('button', { name: /blue lions/i }));

        expect(pushState).toHaveBeenCalledWith('', {
            teamModal: { teamName: 'blue lions', date: '2026-03-07' }
        });
    });

    it('shows the final league position and cup performance', () => {
        const { getByTestId } = renderCard();

        const result = getByTestId('session-result').textContent?.replace(/\s+/g, ' ').trim();
        expect(result).toBe('League 2nd Cup Semi Finals');
    });

    it('reads a cup win as "Cup Winner"', () => {
        const { getByTestId } = renderCard({ cupProgress: 'winner', cupWinner: true });

        expect(getByTestId('session-result').textContent?.replace(/\s+/g, ' ')).toContain(
            'Cup Winner'
        );
    });

    it('omits the result row when the session has no placement data', () => {
        const { queryByTestId } = renderCard({ leaguePosition: null, cupProgress: undefined });

        expect(queryByTestId('session-result')).toBeNull();
    });

    it('shows a chip for each Stars of the Day award', () => {
        const { container } = renderCard({ awards: ['mvp', 'goldenBoot'] });

        expect(awardChips(container)).toEqual(['mvp', 'goldenBoot']);
        expect(container.textContent).toContain('MVP');
        expect(container.textContent).toContain('Golden Boot');
    });

    it('shows award chips alongside the trophy badges', () => {
        const { container, getByTestId } = renderCard({
            leagueWinner: true,
            cupWinner: true,
            awards: ['brickWall']
        });

        const honours = getByTestId('session-honours').textContent?.replace(/\s+/g, ' ').trim();
        expect(honours).toBe('League Cup Brick Wall');
        expect(awardChips(container)).toEqual(['brickWall']);
    });

    it('shows no chips without awards, or without award data at all', () => {
        expect(awardChips(renderCard().container)).toEqual([]);
        expect(awardChips(renderCard({ awards: undefined }).container)).toEqual([]);
    });

    it('shows all four point categories, the total and the ELO rating', () => {
        const { container } = renderCard();

        const points = Object.fromEntries(
            [...container.querySelectorAll('[data-points]')].map((el) => [
                el.getAttribute('data-points'),
                el.querySelector('[data-points-value]')?.textContent?.trim()
            ])
        );
        expect(points).toEqual({ Appearance: '+2', Match: '+9', Bonus: '+0', Knockout: '+4' });

        const text = container.textContent?.replace(/\s+/g, ' ') ?? '';
        expect(text).toContain('Total 15');
        expect(text).toContain('ELO 1042');
    });
});

import { describe, it, expect } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';

const SquadSummary = (await import('../../../src/routes/fantasy/components/SquadSummary.svelte'))
    .default;

const players = [
    { name: 'Ace', avatar: null, elo: 1200 },
    { name: 'Bruno', avatar: null, elo: 1100 }
];
const playerStats = { Ace: { price: 12, points: 24 }, Bruno: { price: 8, points: 9 } };

describe('SquadSummary', () => {
    it('meters the spend against the budget in millions', () => {
        const view = render(SquadSummary, {
            props: { budget: 40, cost: 20, players, playerStats }
        });

        const meter = view.getByText('Squad').closest('div');
        expect(meter?.textContent?.replace(/\s+/g, ' ').trim()).toBe('Squad $20m / $40m');
    });

    it('reports what is left to spend', () => {
        const view = render(SquadSummary, {
            props: { budget: 40, cost: 12, players, playerStats }
        });

        expect(view.getByText('$28m left')).toBeInTheDocument();
    });

    it('calls out an over-budget squad rather than showing a negative', () => {
        const view = render(SquadSummary, {
            props: { budget: 15, cost: 20, players, playerStats }
        });

        expect(view.getByText('$5m over budget')).toBeInTheDocument();
        expect(view.queryByText(/-5/)).toBeNull();
    });

    // The panel is the squad preview now, not a list of chips: a pick shows on the pitch
    // the moment it is made, and is taken back from the market row.
    it('shows the picked squad on the pitch', () => {
        const view = render(SquadSummary, {
            props: { budget: 40, cost: 20, players, playerStats }
        });

        expect(view.getByText('Ace')).toBeInTheDocument();
        expect(view.getByText('Bruno')).toBeInTheDocument();
        expect(view.getByText('$12m')).toBeInTheDocument();
        expect(view.getByText('24pts')).toBeInTheDocument();
    });

    it('says so when nothing has been picked yet and there are no slots to show', () => {
        const view = render(SquadSummary, { props: { budget: 40, cost: 0 } });

        expect(view.getByText('No players picked yet')).toBeInTheDocument();
    });

    // The pitch is the pick screen's one fixed thing: a full squad's worth of places, so
    // the market below it never moves as picks are made.
    it('keeps an empty slot on the pitch for every pick still to make', () => {
        const view = render(SquadSummary, {
            props: { budget: 40, cost: 20, players, playerStats, slots: 5 }
        });

        expect(view.getAllByText('Empty')).toHaveLength(3);
        expect(view.queryByText('No players picked yet')).toBeNull();
    });

    it('has a full pitch of empty slots before anything is picked', () => {
        const view = render(SquadSummary, { props: { budget: 40, cost: 0, slots: 5 } });

        expect(view.getAllByText('Empty')).toHaveLength(5);
    });

    it('opens the market from any slot, filled or empty', async () => {
        /** @type {Array<string | null>} */
        const selected = [];
        const view = render(SquadSummary, {
            props: {
                budget: 40,
                cost: 20,
                players,
                playerStats,
                slots: 5,
                onselect: (/** @type {string | null} */ name) => selected.push(name)
            }
        });

        await fireEvent.click(view.getByLabelText('Change Ace'));
        await fireEvent.click(view.getAllByLabelText('Pick a player')[0]);

        expect(selected).toEqual(['Ace', null]);
    });

    it('takes a pick back from the pitch itself', async () => {
        /** @type {string[]} */
        const removed = [];
        const view = render(SquadSummary, {
            props: {
                budget: 40,
                cost: 20,
                players,
                playerStats,
                slots: 5,
                onremove: (/** @type {string} */ name) => removed.push(name)
            }
        });

        await fireEvent.click(view.getByLabelText('Remove Bruno'));

        expect(removed).toEqual(['Bruno']);
    });

    it('badges the captain on the pitch', () => {
        const view = render(SquadSummary, {
            props: { budget: 40, cost: 20, players, playerStats, captain: 'Ace' }
        });

        expect(view.getByLabelText('Ace is captain')).toBeInTheDocument();
        expect(view.queryByLabelText('Make Bruno captain')).toBeNull();
    });

    it('moves the armband from the pitch', async () => {
        /** @type {string[]} */
        const chosen = [];
        const view = render(SquadSummary, {
            props: {
                budget: 40,
                cost: 20,
                players,
                playerStats,
                captain: 'Ace',
                oncaptain: (/** @type {string} */ name) => chosen.push(name)
            }
        });

        await fireEvent.click(view.getByLabelText('Make Bruno captain'));

        expect(chosen).toEqual(['Bruno']);
    });

    // The captain's points count twice in the total the meter shows, so the tile has to
    // show what the player actually contributed or the pitch stops adding up.
    it("doubles the captain's points on the tile", () => {
        const view = render(SquadSummary, {
            props: { budget: 40, cost: 20, points: 57, players, playerStats, captain: 'Ace' }
        });

        expect(view.getByText('48pts')).toBeInTheDocument();
        expect(view.queryByText('24pts')).toBeNull();
        expect(view.getByText('9pts')).toBeInTheDocument();
    });

    it('doubles no points that have not been scored yet', () => {
        const view = render(SquadSummary, {
            props: {
                budget: 40,
                cost: 20,
                players,
                playerStats: { Ace: { price: 12, points: null }, Bruno: { price: 8, points: 9 } },
                captain: 'Ace'
            }
        });

        expect(view.getAllByText('—').length).toBeGreaterThan(0);
    });

    // On the tile rather than in a line under the pitch: the squad is what a manager is
    // looking at, so a pick who is not playing has to say so where they are standing.
    it('marks a withdrawn pick on the pitch, not in a note beneath it', () => {
        const view = render(SquadSummary, {
            props: { budget: 40, cost: 20, players, playerStats, withdrawnPlayers: ['Bruno'] }
        });

        expect(view.getByText('Withdrawn')).toBeInTheDocument();
        expect(view.queryByText(/Withdrawn, scoring nothing/)).toBeNull();
        // The marker takes the place of the price and points, which no longer apply.
        expect(view.queryByText('9pts')).toBeNull();
        expect(view.queryByText('$8m')).toBeNull();
        // ...and says nothing about anyone else.
        expect(view.getByText('24pts')).toBeInTheDocument();
    });

    // The meter doubles as the squad's totals line, so the preview below it does not
    // repeat the cost — which leaves the meter the only place a settled score can show.
    it('shows the settled score beside what is left', () => {
        const view = render(SquadSummary, {
            props: { budget: 40, cost: 20, points: 88, players, playerStats }
        });

        expect(view.getByText('$20m left').closest('div')?.textContent).toContain('88pts');
    });

    it('shows no squad score before the session is settled', () => {
        const view = render(SquadSummary, {
            props: { budget: 40, cost: 20, points: null, players, playerStats }
        });

        // The meter row only: the per-player lines on the pitch carry points of their own.
        expect(view.getByText('$20m left').closest('div')?.textContent).not.toContain('pts');
    });
});

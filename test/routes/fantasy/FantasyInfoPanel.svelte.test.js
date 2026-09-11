import { describe, it, expect } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';

const FantasyInfoPanel = (
    await import('../../../src/routes/fantasy/components/FantasyInfoPanel.svelte')
).default;

const scoring = {
    appearance: 2,
    goal: 4,
    offAction: 1.5,
    defAction: 1.5,
    save: 0.7,
    matchPoint: 0.5,
    knockout: 0.5,
    leagueWin: 5,
    cupWin: 4
};

const STAT_TYPES = ['goals', 'offActions', 'defActions', 'saveActions'];

/** The panel is collapsed until asked, like the Ranking Info one it mirrors. */
async function open(/** @type {Record<string, any>} */ props = {}) {
    const view = render(FantasyInfoPanel, {
        props: { squadSize: 5, budget: 40, scoring, statTypes: STAT_TYPES, ...props }
    });
    await fireEvent.click(view.getByRole('button', { name: /Fantasy Info/ }));
    await waitFor(() => expect(view.getByText(/just for playing/)).toBeInTheDocument());
    return view;
}

describe('FantasyInfoPanel', () => {
    it('stays out of the way until it is asked for', () => {
        const view = render(FantasyInfoPanel, {
            props: { squadSize: 5, budget: 40, scoring, statTypes: STAT_TYPES }
        });

        expect(view.getByRole('button', { name: /Fantasy Info/ })).toBeInTheDocument();
        expect(view.queryByText(/just for playing/)).toBeNull();
    });

    // The weights are league-tunable, so the panel reads them off the payload. Restating
    // them here would be a copy that goes quietly wrong the day someone tunes one.
    it("pays out at the league's own weights", async () => {
        const view = await open();

        expect(view.getByText('Appearance: 2pts just for playing')).toBeInTheDocument();
        expect(view.getByText('Goal: 4pts each')).toBeInTheDocument();
        expect(view.getByText('Save: 0.7pts each')).toBeInTheDocument();
    });

    it('turns the fractions of a league point into points a manager can count', async () => {
        const view = await open();

        // matchPoint 0.5 on 3-for-a-win, 1-for-a-draw; knockout 0.5 on 4 a win.
        expect(view.getByText(/1\.5pts for a win, 0\.5pts for a draw/)).toBeInTheDocument();
        expect(view.getByText(/2pts for each knockout match won/)).toBeInTheDocument();
    });

    it('lists only the stats the league actually tracks', async () => {
        const view = await open({ statTypes: ['goals'] });

        expect(view.getByText('Goal: 4pts each')).toBeInTheDocument();
        expect(view.queryByText(/^Save:/)).toBeNull();
        expect(view.queryByText(/^Defensive action:/)).toBeNull();
    });

    it("states the week's own squad size and budget", async () => {
        const view = await open({ squadSize: 3, budget: 25 });

        expect(view.getByText(/Pick 3 players for \$25m/)).toBeInTheDocument();
    });

    it('explains the armband and the doubling it is worth', async () => {
        const view = await open();

        expect(view.getByText(/captain scores double/i)).toBeInTheDocument();
    });

    it('says when other squads become visible, and what an over-budget squad costs', async () => {
        const view = await open();

        expect(view.getByText(/hidden until the first match kicks off/i)).toBeInTheDocument();
        expect(view.getByText(/not scored/i)).toBeInTheDocument();
    });
});

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';

vi.mock('$app/paths', () => ({
    resolve: (/** @type {string} */ path) => path
}));

// The page is the only thing under test; the endpoint is replaced by a payload the test sets.
const ctx = vi.hoisted(() => ({
    /** @type {any} */ payload: null,
    /** @type {any} */ saved: null
}));
vi.mock('$lib/client/services/api-client.svelte.js', () => ({
    api: {
        get: async () => ctx.payload,
        post: async (/** @type {string} */ _key, /** @type {string} */ _date, body) => {
            ctx.saved = body;
            return ctx.payload;
        },
        remove: async () => ctx.payload
    }
}));

const TeamPage = (await import('../../../src/routes/fantasy/team/+page.svelte')).default;

const market = [
    { playerName: 'Ace', price: 8, expectedPoints: 40, provisional: false, avatar: null },
    { playerName: 'Bruno', price: 6, expectedPoints: 30, provisional: false, avatar: null },
    { playerName: 'Cass', price: 4, expectedPoints: 20, provisional: false, avatar: null },
    { playerName: 'Dee', price: 2, expectedPoints: 10, provisional: false, avatar: null }
];

/** @param {Record<string, any>} [overrides] */
function payload(overrides = {}) {
    return {
        date: '2026-09-12',
        squadSize: 3,
        budget: 20,
        windowState: 'open',
        marketReady: true,
        marketNotice: null,
        market,
        entries: [],
        myEntry: null,
        ...overrides
    };
}

/** @param {Record<string, any>} [overrides] */
async function renderPage(overrides = {}) {
    ctx.payload = payload(overrides);
    ctx.saved = null;
    const view = render(TeamPage, { props: { data: { date: '2026-09-12' } } });
    await waitFor(() => expect(view.getByLabelText('Squad name')).toBeInTheDocument());
    return view;
}

/** @param {import('@testing-library/svelte').RenderResult<any>} view */
const marketShown = (view) => view.queryByRole('columnheader', { name: 'Player' });

/**
 * The market is a sheet behind the pitch: a slot on the pitch is the only way to it.
 * @param {import('@testing-library/svelte').RenderResult<any>} view
 */
async function openMarket(view) {
    const slot = view
        .getAllByRole('button')
        .find((el) => /^(Pick a player|Change )/.test(el.getAttribute('aria-label') ?? ''));
    if (!slot) throw new Error('No slot on the pitch to open the market from');
    await fireEvent.click(slot);
    await waitFor(() => expect(marketShown(view)).toBeInTheDocument());
}

/**
 * @param {import('@testing-library/svelte').RenderResult<any>} view
 * @param {string} name
 */
async function pick(view, name) {
    if (!marketShown(view)) await openMarket(view);
    // A picked player also shows on the pitch preview, which is not in a table row.
    const row = view
        .getAllByText(name)
        .map((el) => el.closest('tr'))
        .find(Boolean);
    if (!row) throw new Error(`No market row for ${name}`);
    await fireEvent.click(row);
}

describe('fantasy team page', () => {
    it('titles the squad with the same wording as the leaderboard, without the date', async () => {
        const view = await renderPage();

        expect(view.getByText('Pick 3 players for $20m')).toBeInTheDocument();
        expect(view.queryByText(/2026/)).toBeNull();
    });

    // A disabled button that never says why is the actual bug: a squad can be picked and
    // priced and still refuse to save because it has no name.
    it('counts the picks still to make while the squad is short', async () => {
        const view = await renderPage();

        expect(view.getByText('Pick 3 more players.')).toBeInTheDocument();
        expect(view.getByRole('button', { name: 'Enter Squad' })).toBeDisabled();

        await pick(view, 'Ace');
        await waitFor(() => expect(view.getByText('Pick 2 more players.')).toBeInTheDocument());
    });

    it('uses the singular for the last pick', async () => {
        const view = await renderPage();

        await pick(view, 'Ace');
        await pick(view, 'Bruno');
        await waitFor(() => expect(view.getByText('Pick 1 more player.')).toBeInTheDocument());
    });

    it('asks for a name once the squad is full, and saves once it has one', async () => {
        const view = await renderPage();

        await pick(view, 'Ace');
        await pick(view, 'Bruno');
        await pick(view, 'Cass');
        await waitFor(() => expect(view.getByText('Give your squad a name.')).toBeInTheDocument());
        expect(view.getByRole('button', { name: 'Enter Squad' })).toBeDisabled();

        await fireEvent.input(view.getByLabelText('Squad name'), {
            target: { value: 'Smoke Test XI' }
        });

        await waitFor(() =>
            expect(view.getByRole('button', { name: 'Enter Squad' })).toBeEnabled()
        );
        expect(view.queryByText('Give your squad a name.')).toBeNull();
    });

    it('says by how much a drifted squad is over budget', async () => {
        const view = await renderPage({
            budget: 15,
            myEntry: {
                teamName: 'Drifter',
                players: ['Ace', 'Bruno', 'Cass'],
                cost: 18,
                valid: false,
                invalidReason: 'That squad costs 18, over the 15 budget.'
            }
        });

        await waitFor(() =>
            expect(view.getByText('Your squad is 3 over the 15 budget.')).toBeInTheDocument()
        );
        expect(view.getByRole('button', { name: 'Update Squad' })).toBeDisabled();
    });

    it('blames the market when it is too thin to buy a squad', async () => {
        const view = await renderPage({
            marketReady: false,
            marketNotice: 'Not enough players have signed up yet for a legal squad.'
        });

        expect(view.getByText("The market isn't ready yet.")).toBeInTheDocument();
        expect(view.getByRole('button', { name: 'Enter Squad' })).toBeDisabled();
    });

    // Saving is the screen's one action: it belongs with the name, above the squad it
    // applies to, not below a pitch the manager has to scroll past.
    it('puts saving under the squad name and above the squad itself', async () => {
        const view = await renderPage();
        const after = (/** @type {Element} */ a, /** @type {Element} */ b) =>
            Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

        const nameInput = view.getByLabelText('Squad name');
        const save = view.getByRole('button', { name: 'Enter Squad' });
        const squadPanel = view.getByText('Squad');

        expect(after(nameInput, save)).toBe(true);
        expect(after(save, squadPanel)).toBe(true);
    });

    it('shows a pick on the pitch rather than behind a preview button', async () => {
        const view = await renderPage();

        expect(view.queryByRole('button', { name: 'Preview' })).toBeNull();
        expect(view.getAllByText('Empty')).toHaveLength(3);

        await pick(view, 'Ace');

        // Once on the pitch, Ace is rendered outside the market table as well as in it.
        await waitFor(() =>
            expect(view.getAllByText('Ace').some((el) => !el.closest('tr'))).toBe(true)
        );
        expect(view.getAllByText('Empty')).toHaveLength(2);
    });

    // The pitch is a fixed full squad and the market a sheet over it, so neither the
    // budget meter nor the squad moves while picks are being made.
    it('keeps the market behind a slot on the pitch', async () => {
        const view = await renderPage();

        expect(marketShown(view)).toBeNull();

        await openMarket(view);

        expect(view.getByText('Player market')).toBeInTheDocument();
        expect(view.getByText('$20m to spend')).toBeInTheDocument();
    });

    // A bottom Drawer is a height:auto flex container, and WebKit sizes one from its
    // items' flex base size — so `flex-1 min-h-0` on the market scroller made the whole
    // sheet collapse to its padding on iOS while Blink, which sizes from the content,
    // showed it correctly. jsdom has no layout and can never catch that, so pin the shape
    // instead: the scroller owns a height cap and never asks the sheet for room.
    it('caps the market scroller itself rather than growing into the sheet', async () => {
        const view = await renderPage();

        await openMarket(view);

        const scroller = view.getByText('Player market').closest('div')?.nextElementSibling;
        expect(scroller?.className).toMatch(/overflow-y-auto/);
        expect(scroller?.className).toMatch(/max-h-\[calc\(85dvh-6rem\)\]/);
        expect(scroller?.className).not.toMatch(/flex-1|min-h-0/);
    });

    it('hands the pitch back once the last pick completes the squad', async () => {
        const view = await renderPage();

        await pick(view, 'Ace');
        await pick(view, 'Bruno');
        expect(marketShown(view)).toBeInTheDocument();

        await pick(view, 'Cass');

        await waitFor(() => expect(marketShown(view)).toBeNull());
        expect(view.queryByText('Empty')).toBeNull();
    });

    it('takes a pick back from the pitch', async () => {
        const view = await renderPage();

        await pick(view, 'Ace');
        await waitFor(() => expect(view.getByLabelText('Remove Ace')).toBeInTheDocument());

        await fireEvent.click(view.getByLabelText('Remove Ace'));

        await waitFor(() => expect(view.getAllByText('Empty')).toHaveLength(3));
        expect(view.getByText('Pick 3 more players.')).toBeInTheDocument();
    });

    // The armband is free points, so nobody should lose them by not noticing it exists:
    // the priciest pick wears it until the manager says otherwise.
    it('nominates the priciest pick as captain, and lets it be moved', async () => {
        const view = await renderPage();

        await pick(view, 'Bruno');
        await waitFor(() => expect(view.getByLabelText('Bruno is captain')).toBeInTheDocument());

        await pick(view, 'Ace');
        await waitFor(() => expect(view.getByLabelText('Ace is captain')).toBeInTheDocument());

        await fireEvent.click(view.getByLabelText('Make Bruno captain'));

        await waitFor(() => expect(view.getByLabelText('Bruno is captain')).toBeInTheDocument());
        expect(view.getByLabelText('Make Ace captain')).toBeInTheDocument();
    });

    it('passes the armband on when the captain is taken off the pitch', async () => {
        const view = await renderPage();

        await pick(view, 'Ace');
        await pick(view, 'Bruno');
        await waitFor(() => expect(view.getByLabelText('Ace is captain')).toBeInTheDocument());

        await fireEvent.click(view.getByLabelText('Remove Ace'));

        await waitFor(() => expect(view.getByLabelText('Bruno is captain')).toBeInTheDocument());
    });

    it('saves the captain with the squad', async () => {
        const view = await renderPage();

        await pick(view, 'Ace');
        await pick(view, 'Bruno');
        await pick(view, 'Cass');
        await fireEvent.input(view.getByLabelText('Squad name'), {
            target: { value: 'Skippered XI' }
        });

        await waitFor(() =>
            expect(view.getByRole('button', { name: 'Enter Squad' })).toBeEnabled()
        );
        await fireEvent.click(view.getByRole('button', { name: 'Enter Squad' }));

        await waitFor(() => expect(ctx.saved).not.toBeNull());
        expect(ctx.saved).toEqual({
            teamName: 'Skippered XI',
            players: ['Ace', 'Bruno', 'Cass'],
            captain: 'Ace'
        });
    });

    it('keeps the armband a saved squad came back with', async () => {
        const view = await renderPage({
            myEntry: {
                teamName: 'Settled XI',
                players: ['Ace', 'Bruno', 'Cass'],
                captain: 'Cass',
                cost: 18,
                valid: true
            }
        });

        await waitFor(() => expect(view.getByLabelText('Cass is captain')).toBeInTheDocument());
    });

    it('shows whose armband it is but does not move it once the window has closed', async () => {
        const view = await renderPage({
            windowState: 'closed',
            windowReason: 'The first match has been scored.',
            myEntry: {
                teamName: 'Settled XI',
                players: ['Ace', 'Bruno', 'Cass'],
                captain: 'Bruno',
                cost: 18,
                valid: true,
                points: 42
            }
        });

        await waitFor(() => expect(view.getByLabelText('Bruno is captain')).toBeInTheDocument());
        expect(view.queryByLabelText('Make Ace captain')).toBeNull();
    });

    it('offers no way to take a pick back once the window has closed', async () => {
        const view = await renderPage({
            windowState: 'closed',
            windowReason: 'The first match has been scored.',
            myEntry: {
                teamName: 'Settled XI',
                players: ['Ace', 'Bruno', 'Cass'],
                cost: 18,
                valid: true,
                points: 42
            }
        });

        await waitFor(() => expect(view.getAllByText('Ace')).not.toHaveLength(0));
        expect(view.queryByLabelText('Remove Ace')).toBeNull();
        // The market is still readable, just not editable.
        await openMarket(view);
        expect(marketShown(view)).toBeInTheDocument();
    });

    it('says nothing about saving once the window has closed', async () => {
        const view = await renderPage({
            windowState: 'closed',
            windowReason: 'The first match has been scored.'
        });

        expect(view.queryByRole('button', { name: 'Enter Squad' })).toBeNull();
        expect(view.queryByText(/Pick 3 more/)).toBeNull();
    });
});

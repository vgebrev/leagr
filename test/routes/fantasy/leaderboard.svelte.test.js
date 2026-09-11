import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, waitFor } from '@testing-library/svelte';

vi.mock('$app/paths', () => ({
    resolve: (/** @type {string} */ path) => path
}));

const ctx = vi.hoisted(() => ({
    /** @type {any} */ payload: null,
    /** @type {any[]} */ pushed: []
}));

vi.mock('$app/navigation', () => ({
    pushState: (/** @type {string} */ _url, /** @type {any} */ state) => ctx.pushed.push(state)
}));
vi.mock('$app/state', () => ({ page: { state: {} } }));
vi.mock('$lib/client/services/api-client.svelte.js', () => ({
    api: { get: async () => ctx.payload }
}));

const FantasyPage = (await import('../../../src/routes/fantasy/+page.svelte')).default;

const market = [
    { playerName: 'Ace', price: 8, points: null, avatar: null, elo: 1200 },
    { playerName: 'Bruno', price: 6, points: null, avatar: null, elo: 1100 }
];

/**
 * A leaderboard with my squad and someone else's. Hidden squads arrive with their picks
 * already stripped by the server, which is what the page has to render.
 * @param {Record<string, any>} [overrides]
 */
function payload(overrides = {}) {
    const squadsRevealed = overrides.squadsRevealed ?? false;
    return {
        date: '2026-09-12',
        squadSize: 2,
        budget: 20,
        windowState: squadsRevealed ? 'closed' : 'open',
        marketReady: true,
        squadsRevealed,
        scoring: { appearance: 2, goal: 4 },
        statTypes: ['goals'],
        market,
        entries: [
            {
                teamName: 'Mine',
                ownerName: 'Me',
                players: ['Ace', 'Bruno'],
                captain: 'Ace',
                cost: 14,
                points: null,
                valid: true,
                withdrawnPlayers: [],
                isMine: true,
                rank: 1
            },
            {
                teamName: 'Theirs',
                ownerName: 'Them',
                players: squadsRevealed ? ['Ace', 'Bruno'] : [],
                captain: squadsRevealed ? 'Bruno' : null,
                cost: 14,
                points: null,
                valid: true,
                withdrawnPlayers: [],
                isMine: false,
                rank: 2
            }
        ],
        myEntry: null,
        ...overrides
    };
}

/** @param {Record<string, any>} [overrides] */
async function renderPage(overrides = {}) {
    ctx.payload = payload(overrides);
    ctx.pushed = [];
    const view = render(FantasyPage, { props: { data: { date: '2026-09-12' } } });
    await waitFor(() => expect(view.getByText('Theirs')).toBeInTheDocument());
    return view;
}

/**
 * @param {import('@testing-library/svelte').RenderResult<any>} view
 * @param {string} teamName
 */
async function clickRow(view, teamName) {
    const row = view.getByText(teamName).closest('tr');
    if (!row) throw new Error(`No row for ${teamName}`);
    await fireEvent.click(row);
}

describe('fantasy leaderboard', () => {
    it('explains the game without being asked to', async () => {
        const view = await renderPage();

        expect(view.getByRole('button', { name: /Fantasy Info/ })).toBeInTheDocument();
    });

    // Squads are the game: a manager who can read one before the deadline can copy it.
    it("will not open another manager's squad while squads can still be edited", async () => {
        const view = await renderPage();

        await clickRow(view, 'Theirs');
        expect(ctx.pushed).toEqual([]);
    });

    it('still opens your own squad', async () => {
        const view = await renderPage();

        await clickRow(view, 'Mine');
        expect(ctx.pushed).toEqual([{ fantasyEntry: { teamName: 'Mine' } }]);
    });

    // The rule is written down once, in the panel that explains the game — not repeated
    // as a note under the table.
    it('says somewhere why the other squads cannot be opened yet', async () => {
        const view = await renderPage();

        await fireEvent.click(view.getByRole('button', { name: /Fantasy Info/ }));
        await waitFor(() =>
            expect(view.getByText(/hidden until the first match kicks off/i)).toBeInTheDocument()
        );
    });

    it('opens any squad once the first match has kicked off', async () => {
        const view = await renderPage({ squadsRevealed: true });

        await clickRow(view, 'Theirs');
        expect(ctx.pushed).toEqual([{ fantasyEntry: { teamName: 'Theirs' } }]);
    });
});

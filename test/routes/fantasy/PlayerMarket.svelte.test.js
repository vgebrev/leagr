import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

const PlayerMarket = (await import('../../../src/routes/fantasy/components/PlayerMarket.svelte'))
    .default;

const market = [
    { playerName: 'Ace', price: 12, expectedPoints: 40.12, provisional: false, avatar: null },
    { playerName: 'Bruno', price: 8, expectedPoints: 25, provisional: false, avatar: null },
    { playerName: 'Cass', price: 4, expectedPoints: 10, provisional: true, avatar: null },
    {
        playerName: 'Dee',
        price: 5,
        expectedPoints: 12,
        provisional: false,
        avatar: null,
        withdrawn: true
    }
];

/**
 * @param {import('@testing-library/svelte').RenderResult<any>} view
 * @param {string} name
 */
function rowFor(view, name) {
    const cell = view.getByText(new RegExp(`^~?${name}$`));
    const row = cell.closest('tr');
    if (!row) throw new Error(`No row for ${name}`);
    return row;
}

describe('PlayerMarket', () => {
    it('picks a player the manager can afford', async () => {
        const onpick = vi.fn();
        const view = render(PlayerMarket, { props: { market, remaining: 20, onpick } });

        rowFor(view, 'Ace').click();
        expect(onpick).toHaveBeenCalledWith('Ace');
    });

    it('refuses a player the manager cannot afford', async () => {
        const onpick = vi.fn();
        const view = render(PlayerMarket, { props: { market, remaining: 5, onpick } });

        rowFor(view, 'Ace').click();
        expect(onpick).not.toHaveBeenCalled();
        expect(rowFor(view, 'Ace').className).toContain('opacity-40');

        rowFor(view, 'Cass').click();
        expect(onpick).toHaveBeenCalledWith('Cass');
    });

    it('lets a pick be taken back even when the squad is full', async () => {
        const onpick = vi.fn();
        const view = render(PlayerMarket, {
            props: { market, picks: ['Ace'], remaining: 0, squadFull: true, onpick }
        });

        rowFor(view, 'Ace').click();
        expect(onpick).toHaveBeenCalledWith('Ace');

        onpick.mockClear();
        rowFor(view, 'Bruno').click();
        expect(onpick).not.toHaveBeenCalled();
    });

    it('takes no picks at all when read only', async () => {
        const onpick = vi.fn();
        const view = render(PlayerMarket, {
            props: { market, remaining: 50, readOnly: true, onpick }
        });

        rowFor(view, 'Ace').click();
        expect(onpick).not.toHaveBeenCalled();
    });

    it('marks a provisional price and a withdrawn player', () => {
        const view = render(PlayerMarket, { props: { market, remaining: 50 } });

        expect(view.getByText('~Cass')).toBeInTheDocument();
        expect(rowFor(view, 'Dee').textContent).toContain('withdrawn');
    });

    it('rounds expected points to one decimal', () => {
        const view = render(PlayerMarket, { props: { market, remaining: 50 } });

        expect(rowFor(view, 'Ace').textContent).toContain('40.1');
    });

    it('says so when nothing is priced', () => {
        const view = render(PlayerMarket, { props: { market: [] } });

        expect(view.getByText(/No priced players/)).toBeInTheDocument();
    });
});

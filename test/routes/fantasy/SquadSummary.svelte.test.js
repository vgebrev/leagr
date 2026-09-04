import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

const SquadSummary = (await import('../../../src/routes/fantasy/components/SquadSummary.svelte'))
    .default;

const priceOf = { Ace: { price: 12 }, Bruno: { price: 8 } };

describe('SquadSummary', () => {
    it('shows an empty slot for every pick still to make', () => {
        const view = render(SquadSummary, {
            props: { picks: ['Ace', 'Bruno'], squadSize: 5, budget: 40, cost: 20, priceOf }
        });

        expect(view.getAllByText('Empty')).toHaveLength(3);
    });

    it('reports what is left to spend', () => {
        const view = render(SquadSummary, {
            props: { picks: ['Ace'], squadSize: 5, budget: 40, cost: 12, priceOf }
        });

        expect(view.getByText('28 left')).toBeInTheDocument();
    });

    it('calls out an over-budget squad rather than showing a negative', () => {
        const view = render(SquadSummary, {
            props: { picks: ['Ace', 'Bruno'], squadSize: 2, budget: 15, cost: 20, priceOf }
        });

        expect(view.getByText('5 over budget')).toBeInTheDocument();
        expect(view.queryByText(/-5/)).toBeNull();
    });

    it('removes a pick', async () => {
        const onremove = vi.fn();
        const view = render(SquadSummary, {
            props: { picks: ['Ace'], squadSize: 5, budget: 40, cost: 12, priceOf, onremove }
        });

        view.getByLabelText('Remove Ace').click();
        expect(onremove).toHaveBeenCalledWith('Ace');
    });

    it('offers no remove buttons when read only', () => {
        const view = render(SquadSummary, {
            props: { picks: ['Ace'], squadSize: 5, budget: 40, cost: 12, priceOf, readOnly: true }
        });

        expect(view.queryByLabelText('Remove Ace')).toBeNull();
    });

    it('cannot preview an empty squad', () => {
        const view = render(SquadSummary, {
            props: { picks: [], squadSize: 5, budget: 40, cost: 0, priceOf }
        });

        expect(view.getByText('Preview').closest('button')).toBeDisabled();
    });
});

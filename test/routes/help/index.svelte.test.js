import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

vi.mock('$app/paths', () => ({
    resolve: (/** @type {string} */ path) => path
}));

const HelpIndexPage = (await import('../../../src/routes/help/+page.svelte')).default;

describe('help index page', () => {
    it('links to every help topic', () => {
        const { getByRole } = render(HelpIndexPage);

        expect(getByRole('link', { name: /Badges/ })).toHaveAttribute('href', '/help/badges');
    });

    // The index is hand-written, not discovered from the filesystem, so this guards the one
    // thing that can silently go stale: a route added under /help without a card here.
    it('lists one card per sub-route of /help', async () => {
        const { getAllByRole } = render(HelpIndexPage);
        const { readdir } = await import('node:fs/promises');

        const subRoutes = (await readdir('src/routes/help', { withFileTypes: true }))
            .filter((entry) => entry.isDirectory())
            .map((entry) => `/help/${entry.name}`);
        const linked = getAllByRole('link').map((a) => a.getAttribute('href'));

        expect(linked).toEqual(expect.arrayContaining(subRoutes));
        expect(linked).toHaveLength(subRoutes.length);
    });

    it('describes a topic rather than only naming it', () => {
        const { getByRole } = render(HelpIndexPage);

        expect(getByRole('link', { name: /Badges/ }).textContent).toMatch(/trait/i);
    });
});

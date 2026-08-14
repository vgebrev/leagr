import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';

vi.mock('$app/state', () => ({
    page: { url: new URL('http://pirates.localhost/players?date=2026-08-01') }
}));

vi.mock('$app/paths', () => ({
    resolve: (/** @type {string} */ path) => path
}));

vi.mock('$lib/client/services/auth.js', () => ({
    getStoredAccessCode: vi.fn(() => 'ABCD-EFGH-IJKL')
}));

vi.mock('$lib/client/services/clipboard.js', () => ({
    shareContent: vi.fn(async () => ({ success: true, method: 'clipboard' }))
}));

const NavMenu = (await import('../../../src/routes/components/NavMenu.svelte')).default;
const { theme } = await import('$lib/client/stores/theme.js');

const leagueInfo = { id: 'pirates', name: 'Pirates' };
const date = '2026-08-01';

/**
 * Open the menu and wait for Flowbite's debounced popper to render it, then let the
 * popover's own toggle event settle so it cannot race a subsequent close.
 */
async function openMenu() {
    await fireEvent.mouseDown(screen.getByRole('button', { name: 'Menu' }));
    await waitFor(() => expect(screen.getByText('Settings')).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 50));
}

describe('NavMenu', () => {
    beforeEach(() => {
        theme.set('light');
    });

    it('renders a collapsed menu trigger', () => {
        render(NavMenu, { date, leagueInfo });

        const trigger = screen.getByRole('button', { name: 'Menu' });
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
        expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('shows every nav item once opened', async () => {
        render(NavMenu, { date, leagueInfo });
        await openMenu();

        expect(screen.getByText('Share link')).toBeInTheDocument();
        expect(screen.getByText('News')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
        expect(screen.getByText('Dark mode')).toBeInTheDocument();
    });

    it('links News and Settings to the current date', async () => {
        render(NavMenu, { date, leagueInfo });
        await openMenu();

        expect(screen.getByText('News').closest('a')).toHaveAttribute('href', `/news?date=${date}`);
        expect(screen.getByText('Settings').closest('a')).toHaveAttribute(
            'href',
            `/settings?date=${date}`
        );
    });

    it('offers only the theme item without a league (root domain)', async () => {
        render(NavMenu, { date, leagueInfo: null });
        await fireEvent.mouseDown(screen.getByRole('button', { name: 'Menu' }));
        await waitFor(() => expect(screen.getByText('Dark mode')).toBeInTheDocument());

        expect(screen.queryByText('Share link')).not.toBeInTheDocument();
        expect(screen.queryByText('News')).not.toBeInTheDocument();
        expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('toggles the theme and closes the menu', async () => {
        render(NavMenu, { date, leagueInfo });
        await openMenu();

        await fireEvent.click(screen.getByText('Dark mode'));

        expect(get(theme)).toBe('dark');
        expect(document.documentElement.classList.contains('dark')).toBe(true);
        await waitFor(() => expect(screen.queryByText('Settings')).not.toBeInTheDocument());
    });

    it('labels the theme item for the opposite mode', async () => {
        theme.set('dark');
        render(NavMenu, { date, leagueInfo });
        await openMenu();

        expect(screen.getByText('Light mode')).toBeInTheDocument();
        expect(screen.queryByText('Dark mode')).not.toBeInTheDocument();
    });
});

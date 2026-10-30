import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

vi.mock('#components/PlayerActionsDropdown.svelte', async () => ({
    default: (await import('./PlayerActionsDropdownStub.svelte')).default
}));

const auth = vi.hoisted(() => ({ adminCode: /** @type {string | null} */ (null) }));
vi.mock('#lib/client/services/auth.js', () => ({
    getStoredAdminCode: vi.fn(() => auth.adminCode)
}));

vi.mock('#lib/client/services/api-client.svelte.js', () => ({
    getLeagueId: vi.fn(() => 'pirates')
}));

const players = vi.hoisted(() => ({ playersService: { ownedByMe: /** @type {string[]} */ ([]) } }));
vi.mock('#lib/client/services/players.svelte.js', () => players);

const TeamTable = (await import('../../../../src/routes/teams/components/TeamTable.svelte'))
    .default;
const { settings } = await import('#lib/client/stores/settings.js');

const teams = {
    'Blue Sharks': ['Alice', 'Bob'],
    'White Wolves': ['Carol'],
    'Orange Owls': ['Dan', 'Eve', 'Fay']
};

/**
 * Each player's menu as {label: disabled}, plus whether its trigger is enabled.
 * @param {HTMLElement} container
 */
function menus(container) {
    return [...container.querySelectorAll('[data-testid="player-menu"]')].map((menu) => ({
        enabled: menu.getAttribute('data-enabled') === 'true',
        items: Object.fromEntries(
            [...menu.querySelectorAll('li')].map((li) => [
                li.textContent?.trim(),
                li.getAttribute('data-disabled') === 'true'
            ])
        )
    }));
}

/** @param {Record<string, unknown>} props */
const renderTable = (props) =>
    render(TeamTable, {
        canModifyList: true,
        allTeams: teams,
        onremove: vi.fn(),
        onassign: vi.fn(),
        onAutoAssign: vi.fn(),
        ...props
    });

describe('TeamTable player menus', () => {
    beforeEach(() => {
        auth.adminCode = null;
        players.playersService.ownedByMe = [];
        settings.set({
            discipline: { enabled: true },
            teamGeneration: { maxPlayersPerTeam: 3 }
        });
    });

    describe('team rows', () => {
        it('offers non-owners team moves and no-show, but not rename/remove/waiting list', () => {
            const { container } = renderTable({
                team: teams['Blue Sharks'],
                teamName: 'Blue Sharks'
            });

            const [alice] = menus(container);
            expect(alice.enabled).toBe(true);
            expect(alice.items).toEqual({
                // Full teams and the player's own team are not offered
                'Move to White Wolves': false,
                'Move to waiting list': true,
                Rename: true,
                Remove: true,
                'No-show': false
            });
        });

        it('enables every item for the player owner', () => {
            players.playersService.ownedByMe = ['Alice'];
            const { container } = renderTable({
                team: teams['Blue Sharks'],
                teamName: 'Blue Sharks'
            });

            const [alice, bob] = menus(container);
            expect(Object.values(alice.items).every((disabled) => !disabled)).toBe(true);
            expect(bob.items.Rename).toBe(true);
        });

        it('enables every item for an admin', () => {
            auth.adminCode = 'ADMIN';
            const { container } = renderTable({
                team: teams['Blue Sharks'],
                teamName: 'Blue Sharks'
            });

            const [alice] = menus(container);
            expect(Object.values(alice.items).every((disabled) => !disabled)).toBe(true);
        });

        it('moves the player to the chosen team', async () => {
            const onassign = vi.fn();
            const { getAllByText } = renderTable({
                team: teams['Blue Sharks'],
                teamName: 'Blue Sharks',
                onassign
            });

            await fireEvent.click(getAllByText('Move to White Wolves')[1]);

            expect(onassign).toHaveBeenCalledWith('Bob', 'White Wolves');
        });

        it('offers no team moves when leaving would take the team below the minimum', () => {
            settings.set({
                discipline: { enabled: true },
                teamGeneration: { minPlayersPerTeam: 2, maxPlayersPerTeam: 3 }
            });
            const { container } = renderTable({
                team: teams['Blue Sharks'],
                teamName: 'Blue Sharks'
            });

            const [alice] = menus(container);
            expect(Object.keys(alice.items)).not.toContain('Move to White Wolves');
            expect(alice.items['No-show']).toBe(false);
        });

        it('does not offer a team already at the maximum', () => {
            settings.set({
                discipline: { enabled: true },
                teamGeneration: { maxPlayersPerTeam: 1 }
            });
            const { container } = renderTable({ team: ['Gus'], teamName: 'Waiting List' });

            const [gus] = menus(container);
            expect(Object.keys(gus.items).filter((label) => label.startsWith('Move to'))).toEqual(
                []
            );
            expect(gus.items['Auto-assign']).toBeUndefined();
        });

        it('asks for confirmation before marking a no-show', async () => {
            const onremove = vi.fn();
            const { getAllByText, findByRole } = renderTable({
                team: teams['Blue Sharks'],
                teamName: 'Blue Sharks',
                onremove
            });

            await fireEvent.click(getAllByText('No-show')[1]);
            expect(onremove).not.toHaveBeenCalled();

            await fireEvent.click(await findByRole('button', { name: 'Mark no-show' }));
            expect(onremove).toHaveBeenCalledWith('Bob', 'no-show', 'Blue Sharks');
        });

        it('does nothing when the no-show is cancelled', async () => {
            const onremove = vi.fn();
            const { getAllByText, findByRole } = renderTable({
                team: teams['Blue Sharks'],
                teamName: 'Blue Sharks',
                onremove
            });

            await fireEvent.click(getAllByText('No-show')[0]);
            await fireEvent.click(await findByRole('button', { name: 'Cancel' }));

            expect(onremove).not.toHaveBeenCalled();
        });

        it('disables the menu for a non-owner when no item is open to them', () => {
            settings.set({
                discipline: { enabled: false },
                teamGeneration: { maxPlayersPerTeam: 3 }
            });
            const { container } = renderTable({
                team: teams['White Wolves'],
                teamName: 'White Wolves',
                allTeams: {
                    'White Wolves': teams['White Wolves'],
                    'Orange Owls': teams['Orange Owls']
                }
            });

            const [carol] = menus(container);
            expect(carol.enabled).toBe(false);
        });

        it('stays disabled for everyone when the list cannot be modified', () => {
            auth.adminCode = 'ADMIN';
            const { container } = renderTable({
                team: teams['Blue Sharks'],
                teamName: 'Blue Sharks',
                canModifyList: false
            });

            expect(menus(container).every((menu) => !menu.enabled)).toBe(true);
        });
    });

    describe('unassigned and waiting lists', () => {
        it('offers non-owners auto-assign and team moves, but not rename/remove', () => {
            const { container } = renderTable({ team: ['Gus'], teamName: 'Waiting List' });

            const [gus] = menus(container);
            expect(gus.enabled).toBe(true);
            expect(gus.items).toEqual({
                'Auto-assign': false,
                'Move to Blue Sharks': false,
                'Move to White Wolves': false,
                Rename: true,
                Remove: true
            });
        });
    });
});

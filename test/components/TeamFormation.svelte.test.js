import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import TeamFormation from '$components/TeamFormation.svelte';

/**
 * Locate a player's stats panel in the rendered formation.
 * Panel is the second child of the player wrapper (first child is the avatar/name link).
 * @param {HTMLElement} container
 * @param {string} name
 */
function getPanel(container, name) {
    const nameEl = [...container.querySelectorAll('div')].find(
        (el) => el.children.length === 0 && el.textContent?.trim() === name
    );
    if (!nameEl) throw new Error(`No player named "${name}" rendered`);
    const wrapper = nameEl.closest('div.items-start');
    return wrapper?.children[1] ?? null;
}

/**
 * @param {Element} panel
 * @param {string} label
 */
function getRow(panel, label) {
    const row = [...panel.children].find(
        (r) => r.querySelector('span')?.textContent?.trim() === label
    );
    if (!row) throw new Error(`No "${label}" row in stats panel`);
    return row;
}

/** @param {Element} row */
const rowValue = (row) => row.querySelectorAll('span')[1].textContent?.trim();

/** @param {Element} row */
const isGold = (row) =>
    [...row.querySelectorAll('span'), ...row.querySelectorAll('svg')].every((el) =>
        el.getAttribute('class')?.includes('text-yellow-400')
    );

const players = [
    { name: 'Alice', avatar: null, elo: 1200 },
    { name: 'Bob', avatar: null, elo: 1100 }
];

describe('TeamFormation stats panel', () => {
    it('shows a total row summing goals, attack, defence and saves', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats: {
                    Alice: { goals: 2, attack: 1, defence: 0, saves: 0 },
                    Bob: { goals: 0, attack: 3, defence: 1, saves: 0 }
                }
            }
        });

        expect(rowValue(getRow(getPanel(container, 'Alice'), 'total'))).toBe('3');
        expect(rowValue(getRow(getPanel(container, 'Bob'), 'total'))).toBe('4');
    });

    it('separates the total row with a divider', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats: {
                    Alice: { goals: 1, attack: 0, defence: 0, saves: 0 },
                    Bob: { goals: 0, attack: 1, defence: 0, saves: 0 }
                }
            }
        });

        const panel = getPanel(container, 'Alice');
        expect(getRow(panel, 'total').getAttribute('class')).toContain('border-t');
        expect(getRow(panel, 'goals').getAttribute('class')).not.toContain('border-t');
    });

    it('golds the team leader of each stat and leaves the rest plain', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats: {
                    Alice: { goals: 2, attack: 1, defence: 0, saves: 0 },
                    Bob: { goals: 0, attack: 3, defence: 1, saves: 0 }
                }
            }
        });

        const alice = getPanel(container, 'Alice');
        const bob = getPanel(container, 'Bob');

        // Alice leads goals, Bob leads attack, defence and the overall total.
        expect(isGold(getRow(alice, 'goals'))).toBe(true);
        expect(isGold(getRow(bob, 'goals'))).toBe(false);

        expect(isGold(getRow(bob, 'attack'))).toBe(true);
        expect(isGold(getRow(alice, 'attack'))).toBe(false);

        expect(isGold(getRow(bob, 'defence'))).toBe(true);
        expect(isGold(getRow(bob, 'total'))).toBe(true);
        expect(isGold(getRow(alice, 'total'))).toBe(false);
    });

    it('golds every player tied for the lead', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats: {
                    Alice: { goals: 2, attack: 0, defence: 0, saves: 0 },
                    Bob: { goals: 2, attack: 0, defence: 0, saves: 0 }
                }
            }
        });

        expect(isGold(getRow(getPanel(container, 'Alice'), 'goals'))).toBe(true);
        expect(isGold(getRow(getPanel(container, 'Bob'), 'goals'))).toBe(true);
    });

    it('golds nobody for a stat no one recorded', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats: {
                    Alice: { goals: 2, attack: 0, defence: 0, saves: 0 },
                    Bob: { goals: 1, attack: 0, defence: 0, saves: 0 }
                }
            }
        });

        expect(isGold(getRow(getPanel(container, 'Alice'), 'saves'))).toBe(false);
        expect(isGold(getRow(getPanel(container, 'Bob'), 'saves'))).toBe(false);
    });

    it('renders no stats panel for a player with nothing recorded', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats: {
                    Alice: { goals: 1, attack: 0, defence: 0, saves: 0 }
                }
            }
        });

        expect(getPanel(container, 'Alice')).not.toBeNull();
        expect(getPanel(container, 'Bob')).toBeNull();
    });
});

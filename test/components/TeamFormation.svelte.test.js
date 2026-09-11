import { describe, it, expect } from 'vitest';
import { fireEvent, render } from '@testing-library/svelte';
import { StarSolid } from 'flowbite-svelte-icons';
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

/**
 * The inline layout puts one line of stats straight after the avatar/name tile, which is a
 * link or a button depending on whether the caller is picking a squad.
 * @param {HTMLElement} container
 * @param {string} name
 */
function getInlineStats(container, name) {
    const nameEl = [...container.querySelectorAll('div')].find(
        (el) => el.children.length === 0 && el.textContent?.trim() === name
    );
    if (!nameEl) throw new Error(`No player named "${name}" rendered`);
    // The avatar and name sit in a positioning context of their own — that is what the
    // corner badges hang off — so the stats line is that column's next sibling.
    return nameEl.closest('div.relative')?.nextElementSibling ?? null;
}

/** @param {Element | null} el */
const flat = (el) => el?.textContent?.replace(/\s+/g, ' ').trim();

/** @param {Element | null} el */
const statTexts = (el) =>
    [...(el?.querySelectorAll('span') ?? [])].map((s) => s.textContent?.trim());

/** @param {Element} row */
const isGold = (row) =>
    [...row.querySelectorAll('span'), ...row.querySelectorAll('svg')].every((el) =>
        el.getAttribute('class')?.includes('text-yellow-400')
    );

const players = [
    { name: 'Alice', avatar: null, elo: 1200 },
    { name: 'Bob', avatar: null, elo: 1100 }
];

describe('TeamFormation inline stats', () => {
    const statDefs = [
        { key: 'price', label: 'price', prefix: '$', suffix: 'm' },
        { key: 'points', label: 'pts', suffix: 'pts' }
    ];
    const playerStats = { Alice: { price: 12, points: 24.5 }, Bob: { price: 5.5, points: 9 } };

    it('puts the stats on one separated line under the name, in their own units', () => {
        const { container } = render(TeamFormation, {
            props: { players, playerStats, statDefs, statsLayout: 'inline' }
        });

        // Spans, not the flattened text: the gap between them is CSS, not whitespace.
        expect(statTexts(getInlineStats(container, 'Alice'))).toEqual(['$12m', '|', '24.5pts']);
        expect(statTexts(getInlineStats(container, 'Bob'))).toEqual(['$5.5m', '|', '9pts']);
    });

    it('drops the labels and the icons the panel layout carries', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats,
                statDefs: [{ key: 'price', label: 'price', Icon: StarSolid, prefix: '$' }],
                statsLayout: 'inline'
            }
        });

        const line = getInlineStats(container, 'Alice');
        expect(line?.querySelector('svg')).toBeNull();
        expect(flat(line)).toBe('$12');
    });

    it('reports a stat that has no value yet as unscored, not as zero', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats: {
                    Alice: { price: 12, points: null },
                    Bob: { price: 5.5, points: null }
                },
                statDefs,
                statsLayout: 'inline'
            }
        });

        expect(statTexts(getInlineStats(container, 'Alice'))).toEqual(['$12m', '|', '—']);
    });

    it('still renders nothing for a player with no stats', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats: { Alice: { price: 12, points: 24.5 } },
                statDefs,
                statsLayout: 'inline'
            }
        });

        expect(getInlineStats(container, 'Bob')).toBeNull();
    });
});

describe('TeamFormation empty slots', () => {
    // A squad being picked keeps a place on the pitch for every pick still to make, so the
    // page does not resize under the manager's finger as players go in and out.
    const withSlot = [
        { name: 'Alice', avatar: null, elo: 1200 },
        { name: '', avatar: null, elo: null }
    ];

    it('draws a player with no name as an empty slot', () => {
        const { container, getByText } = render(TeamFormation, { props: { players: withSlot } });

        expect(getByText('Empty')).toBeInTheDocument();
        // One link, to Alice: an empty slot is nobody, so it goes nowhere.
        expect(container.querySelectorAll('a')).toHaveLength(1);
    });

    it('hands a clicked slot to the caller instead of opening a player page', async () => {
        /** @type {Array<string | null>} */
        const selected = [];
        const { container, getByLabelText } = render(TeamFormation, {
            props: { players: withSlot, onselect: (name) => selected.push(name) }
        });

        await fireEvent.click(getByLabelText('Pick a player'));
        await fireEvent.click(getByLabelText('Change Alice'));

        expect(selected).toEqual([null, 'Alice']);
        // The whole pitch is the editor now, so nothing on it navigates away.
        expect(container.querySelector('a')).toBeNull();
    });

    it('offers a remove control on a filled slot only', async () => {
        /** @type {string[]} */
        const removed = [];
        const { getAllByRole, getByLabelText } = render(TeamFormation, {
            props: { players: withSlot, onremove: (name) => removed.push(name) }
        });

        expect(getAllByRole('button', { name: /^Remove/ })).toHaveLength(1);

        await fireEvent.click(getByLabelText('Remove Alice'));
        expect(removed).toEqual(['Alice']);
    });

    // The avatar renders a button of its own, and the HTML parser auto-closes a button
    // that contains one — taking the tile's layout with it. The pick target has to be an
    // overlay rather than a wrapper.
    it('never wraps a tile in a button', () => {
        const { container } = render(TeamFormation, {
            props: { players: withSlot, onselect: () => {}, onremove: () => {} }
        });

        expect(container.querySelector('button button')).toBeNull();
        expect(container.querySelectorAll('[aria-label="Change Alice"] *')).toHaveLength(0);
    });

    it('leaves the pitch read-only when the caller passes no handlers', () => {
        const { queryByRole } = render(TeamFormation, { props: { players: withSlot } });

        expect(queryByRole('button', { name: /^Remove/ })).toBeNull();
        expect(queryByRole('button', { name: 'Pick a player' })).toBeNull();
    });
});

describe('TeamFormation captain', () => {
    const withSlot = [
        { name: 'Alice', avatar: null, elo: 1200 },
        { name: '', avatar: null, elo: null }
    ];

    it('badges the captain and nobody else', () => {
        const { getByLabelText, queryByLabelText } = render(TeamFormation, {
            props: { players, captain: 'Alice' }
        });

        expect(getByLabelText('Alice is captain')).toBeInTheDocument();
        expect(queryByLabelText('Bob is captain')).toBeNull();
        // Read-only: a leaderboard squad shows whose armband it is, it does not move it.
        expect(queryByLabelText('Make Bob captain')).toBeNull();
    });

    it('offers the armband on every filled tile when the caller can move it', async () => {
        /** @type {string[]} */
        const chosen = [];
        const { getByLabelText } = render(TeamFormation, {
            props: { players, captain: 'Alice', oncaptain: (name) => chosen.push(name) }
        });

        await fireEvent.click(getByLabelText('Make Bob captain'));

        expect(chosen).toEqual(['Bob']);
        // The current captain's badge is a button too, so a mis-tap is undoable.
        expect(getByLabelText('Alice is captain').tagName).toBe('BUTTON');
    });

    it('never offers the armband on an empty slot', () => {
        const { getAllByRole } = render(TeamFormation, {
            props: { players: withSlot, oncaptain: () => {} }
        });

        expect(getAllByRole('button', { name: /captain/ })).toHaveLength(1);
    });

    // The badges used to hang off the corners of the whole tile, so a long name or a wide
    // stats line pushed them outward and no two tiles agreed on where they were.
    it('pins the badges to the avatar rather than to the widest thing under it', () => {
        const { getByLabelText } = render(TeamFormation, {
            props: {
                players,
                captain: 'Alice',
                oncaptain: () => {},
                onremove: () => {},
                onselect: () => {}
            }
        });

        const layer = getByLabelText('Alice is captain').parentElement;
        // The layer is the avatar's own box, centred on it at both breakpoints.
        expect(layer?.getAttribute('class')).toContain('w-10');
        expect(layer?.getAttribute('class')).toContain('sm:w-20');
        expect(layer?.getAttribute('class')).toContain('-translate-x-1/2');
        expect(getByLabelText('Remove Alice').parentElement).toBe(layer);
    });

    it('shows no armband on a squad that has no captain to show', () => {
        const { queryByText } = render(TeamFormation, { props: { players } });

        expect(queryByText('C')).toBeNull();
    });
});

describe('TeamFormation withdrawn players', () => {
    const statDefs = [
        { key: 'price', label: 'price', prefix: '$', suffix: 'm' },
        { key: 'points', label: 'pts', suffix: 'pts' }
    ];
    const playerStats = { Alice: { price: 12, points: 24.5 }, Bob: { price: 5.5, points: 9 } };

    /**
     * The tile a player's name sits in: the plate is its parent, and the avatar is its
     * sibling, so both are reachable from the name.
     * @param {HTMLElement} container
     * @param {string} name
     */
    function tileFor(container, name) {
        const nameEl = [...container.querySelectorAll('div')].find(
            (el) => el.children.length === 0 && el.textContent?.trim() === name
        );
        if (!nameEl) throw new Error(`No player named "${name}" rendered`);
        const plate = nameEl.parentElement;
        return {
            plate,
            // The avatar is drawn twice, once per breakpoint; the first is the mobile one.
            avatar: plate?.parentElement?.firstElementChild ?? null,
            wrapper: nameEl.closest('div.relative')
        };
    }

    it('replaces the stats with a withdrawn marker', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats,
                statDefs,
                statsLayout: 'inline',
                withdrawnPlayers: ['Alice']
            }
        });

        const marker = getInlineStats(container, 'Alice');
        expect(flat(marker)).toBe('Withdrawn');
        // The price and the points are gone: neither applies to a player who is not there.
        expect(flat(marker)).not.toContain('$12m');
        expect(marker?.querySelector('svg')).not.toBeNull();
    });

    // Faded out rather than coloured in: the accent belongs to the marker, which is the
    // thing that has something to say. A player who is not playing recedes.
    it('mutes the avatar and the name instead of colouring them', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats,
                statDefs,
                statsLayout: 'inline',
                withdrawnPlayers: ['Alice']
            }
        });

        const { plate, avatar, wrapper } = tileFor(container, 'Alice');
        expect(plate?.getAttribute('class')).toContain('opacity-');
        expect(plate?.getAttribute('class')).not.toContain('primary');
        expect(avatar?.getAttribute('class')).toContain('opacity-');
        // The marker keeps its accent — that is the part doing the talking. Either the
        // chip or the icon inside it may carry it.
        const marker = getInlineStats(container, 'Alice');
        const accented =
            marker?.getAttribute('class')?.includes('text-primary') ||
            Boolean(marker?.querySelector('[class*="text-primary"]'));
        expect(accented).toBe(true);
        expect(wrapper?.querySelector('[class*="border-primary"]')).toBeNull();
    });

    it('leaves everybody still playing exactly as they were', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats,
                statDefs,
                statsLayout: 'inline',
                withdrawnPlayers: ['Alice']
            }
        });

        expect(statTexts(getInlineStats(container, 'Bob'))).toEqual(['$5.5m', '|', '9pts']);
        expect(tileFor(container, 'Bob').plate?.getAttribute('class')).not.toContain('opacity-');
    });

    // A player dropped from the market has no price to show, but the squad still has to
    // say what became of them.
    it('marks a withdrawn pick who has no stats at all', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats: { Bob: { price: 5.5, points: 9 } },
                statDefs,
                statsLayout: 'inline',
                withdrawnPlayers: ['Alice']
            }
        });

        expect(flat(getInlineStats(container, 'Alice'))).toBe('Withdrawn');
    });

    it('marks nothing when nobody has withdrawn', () => {
        const { container, queryByText } = render(TeamFormation, {
            props: { players, playerStats, statDefs, statsLayout: 'inline' }
        });

        expect(queryByText('Withdrawn')).toBeNull();
        expect(tileFor(container, 'Alice').plate?.getAttribute('class')).not.toContain('opacity-');
    });
});

describe('TeamFormation custom stat defs', () => {
    it('renders caller-supplied keys instead of the contributions panel', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats: {
                    Alice: { price: 12, points: 24.5 },
                    Bob: { price: 5.5, points: 9 }
                },
                statDefs: [
                    { key: 'price', label: 'price' },
                    { key: 'points', label: 'pts', divider: true }
                ]
            }
        });

        const panel = getPanel(container, 'Alice');
        expect(rowValue(getRow(panel, 'price'))).toBe('12');
        expect(rowValue(getRow(panel, 'pts'))).toBe('24.5');
        expect(() => getRow(panel, 'goals')).toThrow();
    });

    it('renders a stat def with no icon', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats: { Alice: { price: 12 }, Bob: { price: 5.5 } },
                statDefs: [{ key: 'price', label: 'price' }]
            }
        });

        const row = getRow(getPanel(container, 'Alice'), 'price');
        expect(row.querySelector('svg')).toBeNull();
        expect(rowValue(row)).toBe('12');
    });

    it('still highlights the leader on a custom stat', () => {
        const { container } = render(TeamFormation, {
            props: {
                players,
                playerStats: { Alice: { price: 12 }, Bob: { price: 5.5 } },
                statDefs: [{ key: 'price', label: 'price' }]
            }
        });

        expect(isGold(getRow(getPanel(container, 'Alice'), 'price'))).toBe(true);
        expect(isGold(getRow(getPanel(container, 'Bob'), 'price'))).toBe(false);
    });
});

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

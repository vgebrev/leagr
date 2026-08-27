import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import PlayerBadges from '$components/PlayerBadges.svelte';

/** Build a traitTiers map from a 4-tuple: [finisher, attacker, defender, shotStopper]. */
const tiers = ([f, a, d, s]) => ({
    isFinisher: f,
    isAttacker: a,
    isDefender: d,
    isShotStopper: s
});

/** @param {number[]} tuple */
const renderTiers = (tuple) => render(PlayerBadges, { props: { traitTiers: tiers(tuple) } });

/** @param {HTMLElement} container */
const badgeButtons = (container) => [...container.querySelectorAll('span[role="button"]')];

/** @param {HTMLElement} container */
const labels = (container) => badgeButtons(container).map((b) => b.textContent?.trim());

/**
 * @param {HTMLElement} container
 * @param {string} label
 */
function badge(container, label) {
    const el = badgeButtons(container).find((b) => b.textContent?.trim() === label);
    if (!el)
        throw new Error(`No badge labelled "${label}" (rendered: ${labels(container).join(', ')})`);
    return el;
}

/** @param {Element} el */
const cls = (el) => el.getAttribute('class') ?? '';

/** The inner span carries the fill, text weight and label. */
const innerCls = (el) => el.querySelector('span')?.getAttribute('class') ?? '';

const FOUR_BASE = [1, 1, 1, 1];
/** All four traits supersedes All-Rounder, so anything about it needs a three-trait player. */
const THREE_BASE = [1, 1, 1, 0];

/**
 * Open a badge's popover. Flowbite listens for the bubbling `focusin`, not `focus`, and
 * debounces the trigger (DEFAULT_TRIGGER_DELAY = 200ms), so the wait is required.
 * @param {Element} el
 */
async function openPopover(el) {
    await fireEvent.focusIn(el);
    await new Promise((resolve) => setTimeout(resolve, 350));
}

describe('PlayerBadges — rendering', () => {
    it('renders nothing for a player with no traits', () => {
        const { container } = renderTiers([0, 0, 0, 0]);
        expect(badgeButtons(container)).toHaveLength(0);
    });

    it('renders the derived lattice for four base traits', () => {
        const { container } = renderTiers(FOUR_BASE);
        expect(labels(container)).toEqual([
            'Finisher',
            'Attacker',
            'Defender',
            'Shot Stopper',
            'Danger Man',
            'Engine',
            'Sentinel',
            'Utility Hero',
            'True Baller'
        ]);
    });

    // True Baller implies All-Rounder, so only the badge that says more is rendered. The
    // qualification is still persisted; see badges.test.js.
    it('supersedes All-Rounder with True Baller', () => {
        expect(labels(renderTiers(THREE_BASE).container)).toContain('All-Rounder');
        expect(labels(renderTiers(FOUR_BASE).container)).not.toContain('All-Rounder');
    });

    it('renders Elite trait labels and upgraded archetypes', () => {
        const { container } = renderTiers([2, 2, 0, 0]);
        expect(labels(container)).toEqual(['Elite Finisher', 'Elite Attacker', 'Sniper']);
    });

    // Rankings files written before tiering carry booleans only.
    it('falls back to base badges when only traits booleans are present', () => {
        const { container } = render(PlayerBadges, {
            props: { traits: { isFinisher: true, isAttacker: true } }
        });
        expect(labels(container)).toEqual(['Finisher', 'Attacker', 'Danger Man']);
    });

    it('ignores a stale playerProfile and derives from tiers', () => {
        const { container } = render(PlayerBadges, {
            props: {
                traits: {
                    isFinisher: true,
                    isAttacker: true,
                    isDefender: true,
                    isShotStopper: true
                },
                traitTiers: tiers(FOUR_BASE),
                playerProfile: ['G.O.A.T.', 'Complete Player']
            }
        });
        expect(labels(container)).toContain('True Baller');
        expect(labels(container)).not.toContain('G.O.A.T.');
        expect(labels(container)).not.toContain('Complete Player');
    });
});

describe('PlayerBadges — visual grammar', () => {
    // shape = category
    it.each([
        ['Finisher', 'badge-pill', FOUR_BASE],
        ['Danger Man', 'badge-rounded', FOUR_BASE],
        ['All-Rounder', 'badge-notched', THREE_BASE],
        ['True Baller', 'badge-faceted', FOUR_BASE]
    ])('gives %s the %s silhouette', (label, shape, tiers) => {
        const { container } = renderTiers(tiers);
        expect(cls(badge(container, label))).toContain(shape);
    });

    // Shape follows the REQUIREMENT for multi-trait badges, not the category: "3+" is
    // notched and "all four" is faceted, whether the traits are base or Elite. So a
    // Diamond badge can be either silhouette.
    it('shapes mastery badges by requirement, not by tier', () => {
        const threeElite = renderTiers([2, 2, 2, 0]).container;
        expect(cls(badge(threeElite, 'Complete Player'))).toContain('badge-notched');

        const fourElite = renderTiers([2, 2, 2, 2]).container;
        expect(cls(badge(fourElite, 'G.O.A.T.'))).toContain('badge-faceted');
    });

    it('gives a badge and its Elite counterpart the same silhouette', () => {
        const base = renderTiers(FOUR_BASE).container;
        const elite = renderTiers([2, 2, 2, 2]).container;
        expect(cls(badge(renderTiers(THREE_BASE).container, 'All-Rounder'))).toContain(
            'badge-notched'
        );
        expect(cls(badge(elite, 'G.O.A.T.'))).toContain('badge-faceted');
        expect(cls(badge(base, 'True Baller'))).toContain('badge-faceted');
        expect(cls(badge(renderTiers([2, 2, 2, 0]).container, 'Complete Player'))).toContain(
            'badge-notched'
        );
    });

    // material = tier
    it.each([
        ['Finisher', 'orange'],
        ['Danger Man', 'slate'],
        ['True Baller', 'yellow']
    ])('gives %s the %s material', (label, material) => {
        const { container } = renderTiers(FOUR_BASE);
        expect(cls(badge(container, label))).toContain(material);
        expect(innerCls(badge(container, label))).toContain(material);
    });

    // Bronze and gold previously sat on adjacent ramps (amber vs yellow) and read as the
    // same colour at badge size. They must stay on separate hue ramps.
    it('keeps bronze and gold on different colour ramps', () => {
        const { container } = renderTiers(FOUR_BASE);
        const bronze = innerCls(badge(container, 'Finisher'));
        const gold = innerCls(badge(container, 'True Baller'));
        expect(bronze).toContain('orange');
        expect(bronze).not.toContain('yellow');
        expect(gold).toContain('yellow');
        expect(gold).not.toContain('orange');
    });

    it('gives a mastery badge the diamond material', () => {
        const { container } = renderTiers([2, 2, 2, 0]);
        expect(cls(badge(container, 'Complete Player'))).toContain('cyan');
        expect(innerCls(badge(container, 'Complete Player'))).toContain('cyan');
    });

    // clip-path clips borders, rings and shadows, so the 2px edge is a separate layer:
    // the button paints a gradient, the inner span paints an opaque fill over it.
    it('gives every badge a gradient edge over an opaque fill', () => {
        const { container } = renderTiers(FOUR_BASE);
        for (const el of badgeButtons(container)) {
            expect(cls(el)).toContain('bg-gradient-to-br');
            expect(cls(el)).toContain('p-px');
            expect(innerCls(el)).not.toContain('/25');
        }
    });

    it('insets the fill layer with the matching inner silhouette', () => {
        const { container } = renderTiers(FOUR_BASE);
        expect(innerCls(badge(renderTiers(THREE_BASE).container, 'All-Rounder'))).toContain(
            'badge-notched-inner'
        );
        expect(innerCls(badge(container, 'True Baller'))).toContain('badge-faceted-inner');
        expect(innerCls(badge(container, 'Finisher'))).toContain('badge-pill-inner');
        expect(innerCls(badge(container, 'Engine'))).toContain('badge-rounded-inner');
    });

    // The two channels are independent: three Gold badges, three different silhouettes.
    it('keeps shape and material independent across Gold badges', () => {
        // Gold spans all four silhouettes. All-Rounder and True Baller can no longer appear
        // on the same player, so the notched Gold comes from a three-trait player instead.
        const three = renderTiers([1, 2, 2, 0]).container;
        expect(cls(badge(three, 'Elite Attacker'))).toContain('badge-pill');
        expect(cls(badge(three, 'Powerhouse'))).toContain('badge-rounded');
        expect(cls(badge(three, 'All-Rounder'))).toContain('badge-notched');

        const four = renderTiers([1, 2, 2, 1]).container;
        expect(cls(badge(four, 'True Baller'))).toContain('badge-faceted');
    });

    // A shared icon means a shared identity, which follows the LABEL: "Finisher" and "Elite
    // Finisher" are one badge at two levels, so they share a glyph.
    it('shares an icon between a trait and its Elite counterpart', () => {
        const svgOf = (c, label) => badge(c, label).querySelector('svg')?.innerHTML;
        expect(svgOf(renderTiers([1, 0, 0, 0]).container, 'Finisher')).toBe(
            svgOf(renderTiers([2, 0, 0, 0]).container, 'Elite Finisher')
        );
    });

    // Archetype upgrades are named as separate identities and never render together, so they
    // take separate glyphs rather than inheriting the base badge's; see docs/traits.md.
    it.each([
        ['Danger Man', [1, 1, 0, 0], 'Sniper', [2, 2, 0, 0]],
        ['Engine', [0, 1, 1, 0], 'Powerhouse', [0, 2, 2, 0]],
        ['Sentinel', [0, 0, 1, 1], 'Guardian', [0, 0, 2, 2]],
        ['Utility Hero', [1, 0, 0, 1], 'Maverick', [2, 0, 0, 2]]
    ])('gives %s its own icon rather than inheriting %s', (base, baseTiers, elite, eliteTiers) => {
        const svgOf = (c, label) => badge(c, label).querySelector('svg')?.innerHTML;
        expect(svgOf(renderTiers(baseTiers).container, base)).not.toBe(
            svgOf(renderTiers(eliteTiers).container, elite)
        );
    });

    // Distinct from its own base badge is not enough: four archetype glyphs that collide with
    // each other would be no more scannable than four inherited ones.
    it('gives every archetype a glyph no other archetype uses', () => {
        const svgOf = (c, label) => badge(c, label).querySelector('svg')?.innerHTML;
        const glyphs = [
            ['Danger Man', [1, 1, 0, 0]],
            ['Sniper', [2, 2, 0, 0]],
            ['Engine', [0, 1, 1, 0]],
            ['Powerhouse', [0, 2, 2, 0]],
            ['Sentinel', [0, 0, 1, 1]],
            ['Guardian', [0, 0, 2, 2]],
            ['Utility Hero', [1, 0, 0, 1]],
            ['Maverick', [2, 0, 0, 2]]
        ].map(([label, tuple]) => svgOf(renderTiers(tuple).container, label));

        expect(new Set(glyphs).size).toBe(glyphs.length);
    });

    // All-Rounder/Complete Player and True Baller/G.O.A.T. are the same achievement at
    // two levels, so they share both an icon and a silhouette, differing only in material.
    it('shares an icon between a breadth badge and its mastery counterpart', () => {
        const base = renderTiers(FOUR_BASE);
        const elite = renderTiers([2, 2, 2, 2]);
        const svgOf = (c, label) => badge(c, label).querySelector('svg')?.innerHTML;

        expect(svgOf(renderTiers(THREE_BASE).container, 'All-Rounder')).toBe(
            svgOf(renderTiers([2, 2, 2, 0]).container, 'Complete Player')
        );
        expect(svgOf(base.container, 'True Baller')).toBe(svgOf(elite.container, 'G.O.A.T.'));
    });
});

describe('PlayerBadges — requirement popover', () => {
    it('gives every badge a unique id for its popover to target', () => {
        const { container } = renderTiers(FOUR_BASE);
        const ids = badgeButtons(container).map((b) => b.getAttribute('id'));
        expect(ids.every(Boolean)).toBe(true);
        expect(new Set(ids).size).toBe(ids.length);
    });

    // Two PlayerBadges on one page must not collide on popover trigger ids.
    it('keeps ids unique across two instances', () => {
        const a = renderTiers(FOUR_BASE);
        const b = renderTiers(FOUR_BASE);
        const idsA = badgeButtons(a.container).map((el) => el.getAttribute('id'));
        const idsB = badgeButtons(b.container).map((el) => el.getAttribute('id'));
        expect(idsA.some((id) => idsB.includes(id))).toBe(false);
    });

    it('points a popover at each badge', () => {
        const { container, baseElement } = renderTiers(FOUR_BASE);
        const ids = badgeButtons(container).map((el) => el.getAttribute('id'));
        const html = baseElement.innerHTML;
        for (const id of ids) {
            expect(html).toContain(id);
        }
    });

    it('explains a trait badge by its band and stat, not by its own label', async () => {
        const { baseElement, container } = renderTiers([1, 0, 0, 0]);
        await openPopover(badge(container, 'Finisher'));
        const text = baseElement.textContent ?? '';
        expect(text).toContain('Top 55%');
        expect(text).toContain('goals per session');
    });

    it('uses the Elite band for an Elite trait badge', async () => {
        const { baseElement, container } = renderTiers([0, 0, 0, 2]);
        await openPopover(badge(container, 'Elite Shot Stopper'));
        const text = baseElement.textContent ?? '';
        expect(text).toContain('Top 15%');
        expect(text).toContain('saves per session');
    });

    it('states the requirement for a combination badge', async () => {
        const { baseElement, container } = renderTiers([0, 2, 2, 0]);
        await openPopover(badge(container, 'Powerhouse'));
        const text = baseElement.textContent ?? '';
        expect(text).toContain('Requires Elite Attacker + Elite Defender');
        // The requirement already names both traits, so no redundant "From" line.
        expect(text).not.toContain('From ');
    });

    it('lists the traits a count-based badge was earned with', async () => {
        const { baseElement, container } = renderTiers(THREE_BASE);
        await openPopover(badge(container, 'All-Rounder'));
        const text = baseElement.textContent ?? '';
        expect(text).toContain('Requires Any 3+ traits');
        expect(text).toContain('Finisher, Attacker, Defender');
    });

    it('grades a base badge by its trait count alone', async () => {
        const { baseElement, container } = renderTiers([1, 0, 0, 0]);
        await openPopover(badge(container, 'Finisher'));
        const text = baseElement.textContent ?? '';
        expect(text).toContain('Trait');
        expect(text).not.toContain('Bronze');
    });

    it('grades a two-trait badge as an archetype', async () => {
        const { baseElement, container } = renderTiers([0, 1, 1, 0]);
        await openPopover(badge(container, 'Engine'));
        expect(baseElement.textContent ?? '').toContain('Archetype');
    });

    it('marks an Elite badge Elite instead of naming its material', async () => {
        const { baseElement, container } = renderTiers([0, 2, 2, 0]);
        await openPopover(badge(container, 'Powerhouse'));
        const text = baseElement.textContent ?? '';
        expect(text).toContain('Rare Archetype');
        expect(text).not.toContain('Gold');
    });

    // The noun follows the requirement, not the category: Complete Player is catalogued
    // under mastery but takes three traits, so it grades as Versatility.
    it('grades a three-trait badge as versatility whatever its category', async () => {
        const { baseElement, container } = renderTiers([2, 2, 2, 0]);
        await openPopover(badge(container, 'Complete Player'));
        const text = baseElement.textContent ?? '';
        expect(text).toContain('Rare Versatility');
        expect(text).not.toContain('Diamond');
    });

    it('grades a four-trait badge as mastery', async () => {
        const { baseElement, container } = renderTiers(FOUR_BASE);
        await openPopover(badge(container, 'True Baller'));
        const text = baseElement.textContent ?? '';
        expect(text).toContain('Mastery');
        expect(text).not.toContain('Gold');
    });

    it('no longer mutes or selects anything', async () => {
        const { container } = renderTiers(FOUR_BASE);
        await fireEvent.click(badge(container, 'Attacker'));
        for (const el of badgeButtons(container)) {
            expect(cls(el)).not.toContain('opacity-30');
            expect(el.getAttribute('aria-pressed')).toBeNull();
        }
    });

    it('keeps every badge reachable by keyboard', () => {
        const { container } = renderTiers(FOUR_BASE);
        for (const el of badgeButtons(container)) {
            expect(el.getAttribute('tabindex')).toBe('0');
        }
    });
});

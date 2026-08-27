import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/svelte';

vi.mock('$app/paths', () => ({
    resolve: (/** @type {string} */ path) => path
}));

const BadgesHelpPage = (await import('../../../src/routes/help/badges/+page.svelte')).default;
const { BADGE_DEFS, BADGES_BY_ID, TRAIT_DEFS, BASE_PERCENTILE, ELITE_PERCENTILE } =
    await import('$lib/shared/badges.js');

/** Badge chips are the only element carrying a shape class. */
const chips = (/** @type {HTMLElement} */ container) => [
    ...container.querySelectorAll('.badge-pill, .badge-rounded, .badge-notched, .badge-faceted')
];

/** @param {HTMLElement} container */
const chipLabels = (container) => chips(container).map((c) => c.textContent?.trim());

describe('badges help page', () => {
    it('lists every badge in the catalogue, superseded ones included', () => {
        const { container } = render(BadgesHelpPage);
        const labels = chipLabels(container);

        for (const badge of BADGE_DEFS) {
            expect(labels, `missing ${badge.id}`).toContain(badge.label);
        }
    });

    it('renders the real chip, not a stand-in', () => {
        const { container } = render(BadgesHelpPage);

        // The catalogue entry for a diamond badge must carry the diamond edge and the
        // faceted silhouette it wears on a player profile.
        const goat = chips(container).find((c) => c.textContent?.trim() === 'G.O.A.T.');
        expect(goat?.getAttribute('class')).toContain('badge-faceted');
        expect(goat?.getAttribute('class')).toContain('from-cyan-500');
    });

    it('does not make the listed badges focusable controls', () => {
        const { container } = render(BadgesHelpPage);

        expect(container.querySelectorAll('[role="button"]')).toHaveLength(0);
        expect(container.querySelectorAll('[tabindex]')).toHaveLength(0);
    });

    // jsdom has no layout, so this guards the structure that produces the layout rather
    // than the pixels: one grid per list, with the badge and its description as adjacent
    // children of it. A description that is a sibling of its badge in a two-column grid
    // wraps inside its own column; one nested in a per-row flex column drops underneath the
    // badge on a narrow screen, which is what this is here to stop coming back.
    it('keeps every description beside its badge, not under it', () => {
        const { container } = render(BadgesHelpPage);
        const lists = [...container.querySelectorAll('dl')];

        expect(lists.length).toBeGreaterThan(0);
        for (const list of lists) {
            expect(list.getAttribute('class')).toContain('grid-cols-[max-content_1fr]');
        }

        const terms = [...container.querySelectorAll('dt')];
        expect(terms).toHaveLength(TRAIT_DEFS.length + 4 + BADGE_DEFS.length);
        for (const term of terms) {
            expect(term.parentElement?.tagName).toBe('DL');
            expect(term.nextElementSibling?.tagName).toBe('DD');
        }
    });

    it('groups the multi-trait badges by silhouette, base above Elite', () => {
        const { container } = render(BadgesHelpPage);
        const labels = chipLabels(container);
        const at = (/** @type {string} */ label) => labels.lastIndexOf(label);

        // Notched pair first, then faceted — each shape's base badge above its Elite one,
        // rather than both base badges above both Elite ones.
        expect(at('All-Rounder')).toBeLessThan(at('Complete Player'));
        expect(at('Complete Player')).toBeLessThan(at('True Baller'));
        expect(at('True Baller')).toBeLessThan(at('G.O.A.T.'));
    });

    it('explains a trait badge by its stat rather than by its own name', () => {
        const { getByText } = render(BadgesHelpPage);
        const basePct = Math.round((1 - BASE_PERCENTILE) * 100);
        const elitePct = Math.round((1 - ELITE_PERCENTILE) * 100);

        expect(getByText(`Top ${basePct}% for goals per session`)).toBeInTheDocument();
        expect(getByText(`Top ${elitePct}% for goals per session`)).toBeInTheDocument();
    });

    it('states combination requirements by their component traits', () => {
        const { getByText } = render(BadgesHelpPage);

        expect(getByText('Requires Attacker + Finisher')).toBeInTheDocument();
        expect(getByText('Requires Elite Attacker + Elite Defender')).toBeInTheDocument();
        expect(getByText('Requires Any 3+ traits')).toBeInTheDocument();
        expect(getByText('Requires All 4 Elite traits')).toBeInTheDocument();
    });

    it('names what each badge replaces', () => {
        const { container } = render(BadgesHelpPage);
        const text = container.textContent ?? '';

        expect(text).toContain('replaces Danger Man');
        // G.O.A.T. is the only badge that hides two.
        expect(text).toContain('replaces True Baller and Complete Player');
    });

    it('states the eligibility gates the server actually applies', () => {
        const { container } = render(BadgesHelpPage);
        const text = container.textContent ?? '';

        expect(text).toContain('35 games this season');
        expect(text).toContain('5 sessions of the stat itself');
    });

    it('names the source stat for each of the four traits', () => {
        const { getByText } = render(BadgesHelpPage);

        for (const trait of TRAIT_DEFS) {
            expect(getByText(trait.stat)).toBeInTheDocument();
            expect(BADGES_BY_ID[trait.id]).toBeDefined();
        }
    });
});

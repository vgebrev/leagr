import { describe, it, expect } from 'vitest';
import {
    BADGE_DEFS,
    SHAPE_ORDER,
    BADGES_BY_ID,
    TRAIT_DEFS,
    TRAIT_KEYS,
    TIER_NONE,
    TIER_BASE,
    TIER_ELITE,
    BASE_PERCENTILE,
    ELITE_PERCENTILE,
    normaliseTraitTiers,
    qualifiedBadges,
    displayBadges,
    contributingTraits,
    requirementLabel,
    requiredTraitCount,
    requiresEliteTraits,
    gradeLabel,
    BREADTH_NOUNS
} from '$lib/shared/badges.js';

/** Build a tier map from a 4-tuple in TRAIT_DEFS order. */
const tiers = ([f, a, d, s]) => ({
    isFinisher: f,
    isAttacker: a,
    isDefender: d,
    isShotStopper: s
});

/** Every one of the 3^4 = 81 possible trait-tier combinations. */
const ALL_COMBINATIONS = (() => {
    const out = [];
    for (const f of [0, 1, 2])
        for (const a of [0, 1, 2])
            for (const d of [0, 1, 2]) for (const s of [0, 1, 2]) out.push(tiers([f, a, d, s]));
    return out;
})();

const idsOf = (badges) => badges.map((b) => b.id);
const displayIds = (t) => idsOf(displayBadges(t));

describe('badge catalogue', () => {
    it('is exactly the 20 badges in the ADR', () => {
        expect(BADGE_DEFS).toHaveLength(20);
        expect(idsOf(BADGE_DEFS)).toEqual([
            'finisher',
            'elite-finisher',
            'attacker',
            'elite-attacker',
            'defender',
            'elite-defender',
            'shot-stopper',
            'elite-shot-stopper',
            'danger-man',
            'sniper',
            'engine',
            'powerhouse',
            'sentinel',
            'guardian',
            'utility-hero',
            'maverick',
            'all-rounder',
            'true-baller',
            'complete-player',
            'goat'
        ]);
    });

    it('has unique ids and labels', () => {
        expect(new Set(idsOf(BADGE_DEFS)).size).toBe(BADGE_DEFS.length);
        expect(new Set(BADGE_DEFS.map((b) => b.label)).size).toBe(BADGE_DEFS.length);
    });

    // The ADR's core invariant: shape = category, material = tier, independently.
    // Deriving one from the other is exactly what it forbids, so assert the pairs that
    // prove they are independent channels.
    it('pairs category and tier independently', () => {
        const goldCategories = BADGE_DEFS.filter((b) => b.tier === 'gold').map((b) => b.category);
        expect(new Set(goldCategories)).toEqual(new Set(['trait', 'archetype', 'breadth']));

        const archetypeTiers = BADGE_DEFS.filter((b) => b.category === 'archetype').map(
            (b) => b.tier
        );
        expect(new Set(archetypeTiers)).toEqual(new Set(['silver', 'gold']));

        const traitTiersUsed = BADGE_DEFS.filter((b) => b.category === 'trait').map((b) => b.tier);
        expect(new Set(traitTiersUsed)).toEqual(new Set(['bronze', 'gold']));

        expect(
            BADGE_DEFS.filter((b) => b.tier === 'diamond').every((b) => b.category === 'mastery')
        ).toBe(true);
    });

    it('declares a valid shape on every badge', () => {
        for (const badge of BADGE_DEFS) {
            expect(SHAPE_ORDER).toContain(badge.shape);
        }
    });

    // Shape is declared, not derived. Traits and archetypes follow their category, but the
    // multi-trait badges follow their REQUIREMENT: "3+" is notched and "all four" is
    // faceted, at either tier. So Diamond spans two silhouettes and notched spans two tiers.
    it('shapes multi-trait badges by requirement rather than by category or tier', () => {
        expect(BADGES_BY_ID['all-rounder'].shape).toBe('notched');
        expect(BADGES_BY_ID['complete-player'].shape).toBe('notched');
        expect(BADGES_BY_ID['true-baller'].shape).toBe('faceted');
        expect(BADGES_BY_ID.goat.shape).toBe('faceted');

        for (const badge of BADGE_DEFS) {
            if (!badge.requiresCount) continue;
            expect(badge.shape).toBe(
                badge.requiresCount.min >= TRAIT_KEYS.length ? 'faceted' : 'notched'
            );
        }

        const diamondShapes = BADGE_DEFS.filter((b) => b.tier === 'diamond').map((b) => b.shape);
        expect(new Set(diamondShapes)).toEqual(new Set(['notched', 'faceted']));

        const notchedTiers = BADGE_DEFS.filter((b) => b.shape === 'notched').map((b) => b.tier);
        expect(new Set(notchedTiers)).toEqual(new Set(['gold', 'diamond']));
    });

    it('gives traits and archetypes the shape of their category', () => {
        for (const badge of BADGE_DEFS) {
            if (badge.category === 'trait') expect(badge.shape).toBe('pill');
            if (badge.category === 'archetype') expect(badge.shape).toBe('rounded');
        }
    });

    it('names a real badge in every supersedes link', () => {
        for (const badge of BADGE_DEFS) {
            for (const id of badge.supersedes ? [badge.supersedes].flat() : [])
                expect(BADGES_BY_ID[id]).toBeDefined();
        }
    });

    it('gives every badge exactly one kind of requirement', () => {
        for (const badge of BADGE_DEFS) {
            expect(Boolean(badge.requires) !== Boolean(badge.requiresCount)).toBe(true);
        }
    });

    it('only requires real trait keys', () => {
        for (const badge of BADGE_DEFS) {
            for (const key of Object.keys(badge.requires ?? {})) {
                expect(TRAIT_KEYS).toContain(key);
            }
        }
    });
});

describe('trait metadata', () => {
    it('names the stat behind every trait', () => {
        for (const trait of TRAIT_DEFS) {
            expect(trait.stat).toBeTruthy();
        }
        expect(new Set(TRAIT_DEFS.map((t) => t.stat)).size).toBe(TRAIT_DEFS.length);
    });

    // The UI explains trait badges in terms of these bands, so they have to be the same
    // numbers the server awards on.
    it('exposes the band positions the server uses', () => {
        expect(BASE_PERCENTILE).toBe(0.45);
        expect(ELITE_PERCENTILE).toBe(0.85);
    });
});

describe('normaliseTraitTiers', () => {
    it('passes through explicit tiers', () => {
        const result = normaliseTraitTiers({}, tiers([2, 1, 0, 2]));
        expect(result).toEqual(tiers([2, 1, 0, 2]));
    });

    // Rankings files written before tiering carry booleans only.
    it('falls back to base for a held trait with no tier', () => {
        const result = normaliseTraitTiers({ isFinisher: true, isAttacker: false }, undefined);
        expect(result).toEqual(tiers([TIER_BASE, TIER_NONE, TIER_NONE, TIER_NONE]));
    });

    it('returns a complete map from empty input', () => {
        expect(normaliseTraitTiers(undefined, undefined)).toEqual(tiers([0, 0, 0, 0]));
    });

    it('ignores out-of-range tier values and falls back to the boolean', () => {
        const result = normaliseTraitTiers({ isDefender: true }, { isDefender: 7 });
        expect(result.isDefender).toBe(TIER_BASE);
    });
});

describe('qualifiedBadges — requirements actually hold', () => {
    it.each(ALL_COMBINATIONS.map((t) => [JSON.stringify(t), t]))(
        'awards only satisfied badges for %s',
        (_label, t) => {
            for (const badge of qualifiedBadges(t)) {
                if (badge.requires) {
                    for (const [key, level] of Object.entries(badge.requires)) {
                        expect(t[key]).toBeGreaterThanOrEqual(
                            level === 'elite' ? TIER_ELITE : TIER_BASE
                        );
                    }
                }
                if (badge.requiresCount) {
                    const min = badge.requiresCount.level === 'elite' ? TIER_ELITE : TIER_BASE;
                    const held = TRAIT_KEYS.filter((k) => t[k] >= min).length;
                    expect(held).toBeGreaterThanOrEqual(badge.requiresCount.min);
                }
            }
        }
    );

    it.each(ALL_COMBINATIONS.map((t) => [JSON.stringify(t), t]))(
        'omits no satisfied badge for %s',
        (_label, t) => {
            const awarded = new Set(idsOf(qualifiedBadges(t)));
            for (const badge of BADGE_DEFS) {
                const satisfied = badge.requires
                    ? Object.entries(badge.requires).every(
                          ([key, level]) => t[key] >= (level === 'elite' ? TIER_ELITE : TIER_BASE)
                      )
                    : TRAIT_KEYS.filter(
                          (k) =>
                              t[k] >=
                              (badge.requiresCount.level === 'elite' ? TIER_ELITE : TIER_BASE)
                      ).length >= badge.requiresCount.min;
                expect(awarded.has(badge.id)).toBe(satisfied);
            }
        }
    );

    // Elite satisfies base; base never satisfies Elite.
    it('treats trait levels as ordinal', () => {
        expect(idsOf(qualifiedBadges(tiers([2, 0, 0, 0])))).toEqual(['finisher', 'elite-finisher']);
        expect(idsOf(qualifiedBadges(tiers([1, 0, 0, 0])))).toEqual(['finisher']);
    });

    it('awards nothing to a player with no traits', () => {
        expect(qualifiedBadges(tiers([0, 0, 0, 0]))).toEqual([]);
    });

    // Supersession is presentation-only and must not destroy qualification data.
    it('keeps every qualification a G.O.A.T. holds', () => {
        expect(idsOf(qualifiedBadges(tiers([2, 2, 2, 2])))).toEqual(idsOf(BADGE_DEFS));
    });
});

describe('archetypes', () => {
    it.each([
        ['danger-man', [1, 1, 0, 0]],
        ['engine', [0, 1, 1, 0]],
        ['sentinel', [0, 0, 1, 1]],
        ['utility-hero', [1, 0, 0, 1]]
    ])('awards %s at base level', (id, tuple) => {
        expect(displayIds(tiers(tuple))).toContain(id);
    });

    it.each([
        ['sniper', 'danger-man', [2, 2, 0, 0]],
        ['powerhouse', 'engine', [0, 2, 2, 0]],
        ['guardian', 'sentinel', [0, 0, 2, 2]],
        ['maverick', 'utility-hero', [2, 0, 0, 2]]
    ])('upgrades to %s and supersedes %s when both traits are Elite', (elite, base, tuple) => {
        const shown = displayIds(tiers(tuple));
        expect(shown).toContain(elite);
        expect(shown).not.toContain(base);
        // The qualification itself survives.
        expect(idsOf(qualifiedBadges(tiers(tuple)))).toContain(base);
    });

    it('stays at the base archetype when only one constituent trait is Elite', () => {
        expect(displayIds(tiers([2, 1, 0, 0]))).toContain('danger-man');
        expect(displayIds(tiers([2, 1, 0, 0]))).not.toContain('sniper');
        expect(displayIds(tiers([1, 2, 0, 0]))).toContain('danger-man');
        expect(displayIds(tiers([1, 2, 0, 0]))).not.toContain('sniper');
    });

    // The lattice is curated, not exhaustive — these two pairs deliberately have no badge.
    it('awards no archetype for Attacker + Shot Stopper', () => {
        const shown = displayBadges(tiers([0, 2, 0, 2]));
        expect(shown.filter((b) => b.category === 'archetype')).toEqual([]);
    });

    it('awards no archetype for Defender + Finisher', () => {
        const shown = displayBadges(tiers([2, 0, 2, 0]));
        expect(shown.filter((b) => b.category === 'archetype')).toEqual([]);
    });
});

describe('breadth and mastery', () => {
    it('awards All-Rounder for any three base-or-better traits', () => {
        expect(displayIds(tiers([1, 1, 1, 0]))).toContain('all-rounder');
        expect(displayIds(tiers([0, 1, 1, 1]))).toContain('all-rounder');
        expect(displayIds(tiers([1, 1, 0, 1]))).toContain('all-rounder');
    });

    it('does not award All-Rounder for two traits', () => {
        expect(displayIds(tiers([1, 1, 0, 0]))).not.toContain('all-rounder');
    });

    // All four traits guarantees three, so All-Rounder carries no information next to
    // True Baller and is hidden. Qualification survives in qualifiedBadges regardless.
    it('supersedes All-Rounder with True Baller at four traits', () => {
        const shown = displayIds(tiers([1, 1, 1, 1]));
        expect(shown).toContain('true-baller');
        expect(shown).not.toContain('all-rounder');
        expect(idsOf(qualifiedBadges(tiers([1, 1, 1, 1])))).toContain('all-rounder');
    });

    it('reaches breadth Gold without any Elite trait', () => {
        const shown = displayBadges(tiers([1, 1, 1, 1]));
        const trueBaller = shown.find((b) => b.id === 'true-baller');
        expect(trueBaller.tier).toBe('gold');
        expect(shown.some((b) => b.tier === 'diamond')).toBe(false);
    });

    it('awards Complete Player for any three Elite traits', () => {
        expect(displayIds(tiers([2, 2, 2, 0]))).toContain('complete-player');
        expect(displayIds(tiers([0, 2, 2, 2]))).toContain('complete-player');
    });

    // The pairing that must survive: Complete Player (3+ Elite) and True Baller (all four
    // base) imply each other in neither direction — being Elite at three does not give you
    // a fourth base trait, and being base-good at four does not make you Elite at three.
    // This is the case that makes supersession an implication rule rather than a shape rule.
    it('keeps Complete Player and True Baller side by side', () => {
        const shown = displayIds(tiers([2, 2, 2, 1]));
        expect(shown).toContain('complete-player');
        expect(shown).toContain('true-baller');
        expect(shown).not.toContain('all-rounder');
        expect(shown).not.toContain('goat');
    });

    it('supersedes All-Rounder with Complete Player at three Elite traits', () => {
        const shown = displayIds(tiers([2, 2, 2, 0]));
        expect(shown).toContain('complete-player');
        expect(shown).not.toContain('all-rounder');
        expect(idsOf(qualifiedBadges(tiers([2, 2, 2, 0])))).toContain('all-rounder');
    });

    it('supersedes True Baller and Complete Player with G.O.A.T.', () => {
        const shown = displayIds(tiers([2, 2, 2, 2]));
        expect(shown).toContain('goat');
        expect(shown).not.toContain('true-baller');
        expect(shown).not.toContain('complete-player');
        expect(shown).not.toContain('all-rounder');
    });

    it('shows only one badge per shape family', () => {
        for (const t of ALL_COMBINATIONS) {
            const shown = displayBadges(t);
            for (const shape of ['notched', 'faceted']) {
                expect(shown.filter((b) => b.shape === shape).length).toBeLessThanOrEqual(1);
            }
        }
    });

    // --- the invariant behind every supersedes link ---------------------------------
    //
    // "X implies Y" means every tier map that qualifies for X also qualifies for Y, so Y
    // adds no information wherever X is held. Derived by brute force over all 81 maps
    // rather than declared, so it cannot fall out of step with the catalogue.
    const QUALIFIED_SETS = ALL_COMBINATIONS.map((t) => new Set(idsOf(qualifiedBadges(t))));
    const implies = (x, y) => x !== y && QUALIFIED_SETS.every((q) => !q.has(x) || q.has(y));

    it('declares only genuine implications in supersedes links', () => {
        for (const badge of BADGE_DEFS) {
            for (const target of badge.supersedes ? [badge.supersedes].flat() : []) {
                expect(
                    implies(badge.id, target),
                    `${badge.id} supersedes ${target} but does not imply it`
                ).toBe(true);
            }
        }
    });

    // The complement, and the reason this pair of tests exists: an incomplete supersedes
    // relation is invisible until someone reaches the combination that exposes it — which
    // is how All-Rounder rendered next to True Baller, and Complete Player next to
    // G.O.A.T., for as long as it did. Scoped to breadth/mastery because implication ACROSS
    // families is deliberate: Sniper implies Elite Finisher and both are meant to show.
    it('shows no breadth or mastery badge implied by another shown badge', () => {
        for (const t of ALL_COMBINATIONS) {
            const shown = displayBadges(t).filter(
                (b) => b.category === 'breadth' || b.category === 'mastery'
            );
            for (const a of shown) {
                for (const b of shown) {
                    expect(
                        implies(a.id, b.id),
                        `${a.id} and ${b.id} both shown, but the first implies the second`
                    ).toBe(false);
                }
            }
        }
    });

    // The whole point of the change: breadth alone no longer reaches the pinnacle.
    it('does not award G.O.A.T. for four base traits', () => {
        expect(displayIds(tiers([1, 1, 1, 1]))).not.toContain('goat');
        expect(displayIds(tiers([2, 2, 2, 1]))).not.toContain('goat');
    });

    it('shows one breadth-or-mastery badge at four Elite traits', () => {
        const shown = displayBadges(tiers([2, 2, 2, 2]));
        const block = shown.filter((b) => b.category === 'breadth' || b.category === 'mastery');
        expect(idsOf(block)).toEqual(['goat']);
    });
});

describe('displayBadges', () => {
    it('orders by category then tier', () => {
        const shown = displayBadges(tiers([2, 2, 2, 2]));
        expect(idsOf(shown)).toEqual([
            'elite-finisher',
            'elite-attacker',
            'elite-defender',
            'elite-shot-stopper',
            'sniper',
            'powerhouse',
            'guardian',
            'maverick',
            'goat'
        ]);
    });

    it('supersedes the base trait badge with the Elite one', () => {
        const shown = displayIds(tiers([2, 1, 0, 0]));
        expect(shown).toContain('elite-finisher');
        expect(shown).not.toContain('finisher');
        expect(shown).toContain('attacker');
    });

    // Four trait pills + four archetypes + the breadth/mastery block. The block contributes
    // one badge everywhere except at (all four base, three Elite), where True Baller and
    // Complete Player imply each other in neither direction — so ten is still the ceiling,
    // but it is now reached by exactly that one shape of player instead of by every
    // four-trait player.
    it('never shows more than ten badges', () => {
        for (const t of ALL_COMBINATIONS) {
            expect(displayBadges(t).length).toBeLessThanOrEqual(10);
        }
    });

    it('reaches ten badges only at four base traits with three Elite', () => {
        const ten = ALL_COMBINATIONS.filter((t) => displayBadges(t).length === 10);
        expect(ten.length).toBeGreaterThan(0);
        for (const t of ten) {
            expect(TRAIT_KEYS.filter((k) => t[k] >= TIER_BASE)).toHaveLength(4);
            expect(TRAIT_KEYS.filter((k) => t[k] === TIER_ELITE)).toHaveLength(3);
        }
    });

    it('shows nine badges for four base traits', () => {
        expect(displayBadges(tiers([1, 1, 1, 1]))).toHaveLength(9);
    });

    it('shows nine badges for four Elite traits', () => {
        expect(displayBadges(tiers([2, 2, 2, 2]))).toHaveLength(9);
    });

    it('shows nothing for a player with no traits', () => {
        expect(displayBadges(tiers([0, 0, 0, 0]))).toEqual([]);
    });
});

describe('contributingTraits', () => {
    it('names the required traits for an explicit badge', () => {
        expect(contributingTraits(BADGES_BY_ID.powerhouse, tiers([2, 2, 2, 2]))).toEqual([
            'isAttacker',
            'isDefender'
        ]);
    });

    it('names the traits actually held for a count-based badge', () => {
        expect(contributingTraits(BADGES_BY_ID['all-rounder'], tiers([1, 0, 1, 1]))).toEqual([
            'isFinisher',
            'isDefender',
            'isShotStopper'
        ]);
    });

    it('counts only Elite traits for a mastery badge', () => {
        expect(contributingTraits(BADGES_BY_ID['complete-player'], tiers([2, 2, 2, 1]))).toEqual([
            'isFinisher',
            'isAttacker',
            'isDefender'
        ]);
    });

    it('returns traits in canonical order', () => {
        const result = contributingTraits(BADGES_BY_ID['true-baller'], tiers([1, 1, 1, 1]));
        expect(result).toEqual(TRAIT_DEFS.map((t) => t.key));
    });
});

describe('requirementLabel', () => {
    it('describes an Elite archetype', () => {
        expect(requirementLabel(BADGES_BY_ID.powerhouse)).toBe('Elite Attacker + Elite Defender');
    });

    it('describes a base archetype', () => {
        expect(requirementLabel(BADGES_BY_ID.engine)).toBe('Attacker + Defender');
    });

    it('describes a partial count requirement', () => {
        expect(requirementLabel(BADGES_BY_ID['all-rounder'])).toBe('Any 3+ traits');
        expect(requirementLabel(BADGES_BY_ID['complete-player'])).toBe('Any 3+ Elite traits');
    });

    it('describes a full count requirement', () => {
        expect(requirementLabel(BADGES_BY_ID['true-baller'])).toBe('All 4 traits');
        expect(requirementLabel(BADGES_BY_ID.goat)).toBe('All 4 Elite traits');
    });

    it('describes a single trait', () => {
        expect(requirementLabel(BADGES_BY_ID['elite-shot-stopper'])).toBe('Elite Shot Stopper');
    });
});

describe('requiredTraitCount', () => {
    it('counts the named requirements of an explicit badge', () => {
        expect(requiredTraitCount(BADGES_BY_ID.finisher)).toBe(1);
        expect(requiredTraitCount(BADGES_BY_ID.powerhouse)).toBe(2);
    });

    it('takes the minimum of a count-based badge', () => {
        expect(requiredTraitCount(BADGES_BY_ID['all-rounder'])).toBe(3);
        expect(requiredTraitCount(BADGES_BY_ID['complete-player'])).toBe(3);
        expect(requiredTraitCount(BADGES_BY_ID['true-baller'])).toBe(4);
        expect(requiredTraitCount(BADGES_BY_ID.goat)).toBe(4);
    });

    it('agrees with the shape every badge declares', () => {
        // Shape and grade noun are two readings of the same fact, so they must not drift.
        for (const badge of BADGE_DEFS) {
            expect(SHAPE_ORDER.indexOf(badge.shape)).toBe(requiredTraitCount(badge) - 1);
        }
    });
});

describe('requiresEliteTraits', () => {
    it('is true only where the requirement names the Elite level', () => {
        const elite = BADGE_DEFS.filter(requiresEliteTraits).map((b) => b.id);
        expect(elite).toEqual([
            'elite-finisher',
            'elite-attacker',
            'elite-defender',
            'elite-shot-stopper',
            'sniper',
            'powerhouse',
            'guardian',
            'maverick',
            'complete-player',
            'goat'
        ]);
    });

    it('splits the catalogue in half, base and Elite', () => {
        expect(BADGE_DEFS.filter(requiresEliteTraits)).toHaveLength(BADGE_DEFS.length / 2);
    });
});

describe('gradeLabel', () => {
    it('names the trait count alone for a base badge', () => {
        expect(gradeLabel(BADGES_BY_ID.finisher)).toBe('Trait');
        expect(gradeLabel(BADGES_BY_ID.sentinel)).toBe('Archetype');
        expect(gradeLabel(BADGES_BY_ID['all-rounder'])).toBe('Versatility');
        expect(gradeLabel(BADGES_BY_ID['true-baller'])).toBe('Mastery');
    });

    it('marks a badge Rare when its requirement is Elite', () => {
        expect(gradeLabel(BADGES_BY_ID['elite-finisher'])).toBe('Rare Trait');
        expect(gradeLabel(BADGES_BY_ID.guardian)).toBe('Rare Archetype');
        expect(gradeLabel(BADGES_BY_ID['complete-player'])).toBe('Rare Versatility');
        expect(gradeLabel(BADGES_BY_ID.goat)).toBe('Rare Mastery');
    });

    it('never names the material', () => {
        // The colour is redundant with noun + Elite and collides across families, so it was
        // dropped from the wording; the material still carries the same facts visually.
        for (const badge of BADGE_DEFS) {
            expect(gradeLabel(badge).toLowerCase()).not.toContain(badge.tier);
        }
    });

    it('follows the requirement rather than the category', () => {
        // Complete Player is catalogued under mastery but takes three traits.
        expect(gradeLabel(BADGES_BY_ID['complete-player'])).toContain('Versatility');
    });

    it('grades every badge as a known noun, Elite-marked or not', () => {
        for (const badge of BADGE_DEFS) {
            const words = gradeLabel(badge).split(' ');
            expect(BREADTH_NOUNS).toContain(words.at(-1));
            expect(words.slice(0, -1)).toEqual(requiresEliteTraits(badge) ? ['Rare'] : []);
        }
    });
});

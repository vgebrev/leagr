/**
 * Badge lattice — the single source of truth for what a player's trait tiers earn them.
 *
 * Implements `tasks/202608241055-adr-badge-lattice-and-elite-badge-tiers.md`. The core
 * invariant of that ADR is that badge category and badge tier are independent facts:
 *
 *     shape    = badge.category
 *     material = badge.tier
 *
 * so nothing here derives one from the other, and presentation derives both from the
 * catalogue rather than from the awarding logic.
 *
 * The module is deliberately pure and dependency-free: `rankings.js` uses it to award,
 * `PlayerBadges.svelte` uses it to render, and `scripts/traits-report.mjs` uses it to
 * verify, so the lattice cannot drift between them.
 */

/** Trait levels are ordinal: none < base < elite. */
export const TIER_NONE = 0;
export const TIER_BASE = 1;
export const TIER_ELITE = 2;

/** The four base traits, in canonical display order, with the stat each is measured on. */
export const TRAIT_DEFS = [
    { key: 'isFinisher', id: 'finisher', label: 'Finisher', stat: 'goals per session' },
    { key: 'isAttacker', id: 'attacker', label: 'Attacker', stat: 'attacking actions per session' },
    { key: 'isDefender', id: 'defender', label: 'Defender', stat: 'defensive actions per session' },
    { key: 'isShotStopper', id: 'shot-stopper', label: 'Shot Stopper', stat: 'saves per session' }
];

/**
 * Band positions within the eligible pool, per stat. These live here rather than in
 * rankings.js so the awarding rule and anything that explains it to a user cannot drift
 * apart — the badge popover derives its wording from these exact numbers.
 *
 * The base bar sits just below the median rather than on it. Once Elite tiers existed the
 * base badge stopped having to carry any claim of excellence — it marks "this is a real
 * part of your game", and Elite marks being good at it. Measured on pirates 2026, the
 * median bar left two established players with nothing at all; 0.45 admits exactly those
 * two, and going further (0.4 and below) adds no new badged players at all, only more
 * badges for players who already had some. See docs/traits.md.
 */
export const BASE_PERCENTILE = 0.45;
export const ELITE_PERCENTILE = 0.85;

export const TRAIT_KEYS = TRAIT_DEFS.map((t) => t.key);

/** Render order: simple silhouettes first, most distinctive last. */
export const CATEGORY_ORDER = ['trait', 'archetype', 'breadth', 'mastery'];

/** The four silhouettes, in increasing distinctiveness. */
export const SHAPE_ORDER = ['pill', 'rounded', 'notched', 'faceted'];

/** Render order for the material channel within a category. */
export const TIER_ORDER = ['bronze', 'silver', 'gold', 'diamond'];

/**
 * What a badge is called by how many traits it takes, one noun per requirement count.
 *
 * This follows the requirement rather than `category` for the same reason `shape` does: a
 * player reads "how many traits is this?" off the badge, and the two multi-trait families
 * each span two categories (All-Rounder is breadth, Complete Player is mastery, and both
 * are "any 3+"). Paired with the Elite marker in `gradeLabel()` it names both badge axes:
 * noun = breadth, "Elite" = excellence.
 */
export const BREADTH_NOUNS = ['Trait', 'Archetype', 'Versatility', 'Mastery'];

/**
 * @typedef {Object} BadgeDef
 * @property {string} id
 * @property {string} label
 * @property {'trait'|'archetype'|'breadth'|'mastery'} category  Grouping and render order.
 * @property {'pill'|'rounded'|'notched'|'faceted'} shape        Drives silhouette.
 * @property {'bronze'|'silver'|'gold'|'diamond'} tier           Drives material.
 * @property {Record<string, 'base'|'elite'>} [requires]         Named trait requirements.
 * @property {{ level: 'base'|'elite', min: number }} [requiresCount] Count-based requirement.
 * @property {string|string[]} [supersedes] Badge(s) this one replaces for presentation only.
 *   Every link is a strict implication: holding this badge guarantees the ones it names.
 */

/**
 * The complete catalogue — 20 badges, exactly the ADR's "Complete Badge Catalogue" table.
 *
 * Base and Elite traits are two entries linked by `supersedes` rather than one entry with a
 * tier field, so trait badges flow through the same qualify/supersede pipeline as everything
 * else. Becoming Elite changes the material, never the shape.
 *
 * Two of the six two-trait pairs deliberately have no archetype — Attacker + Shot Stopper and
 * Defender + Finisher. The lattice is curated, not exhaustive: badge scarcity and recognisable
 * player identities take precedence over mathematical completeness.
 *
 * @type {BadgeDef[]}
 */
export const BADGE_DEFS = [
    // --- Traits: pill ---------------------------------------------------------------
    {
        id: 'finisher',
        label: 'Finisher',
        category: 'trait',
        shape: 'pill',
        tier: 'bronze',
        requires: { isFinisher: 'base' }
    },
    {
        id: 'elite-finisher',
        label: 'Elite Finisher',
        category: 'trait',
        shape: 'pill',
        tier: 'gold',
        requires: { isFinisher: 'elite' },
        supersedes: 'finisher'
    },
    {
        id: 'attacker',
        label: 'Attacker',
        category: 'trait',
        shape: 'pill',
        tier: 'bronze',
        requires: { isAttacker: 'base' }
    },
    {
        id: 'elite-attacker',
        label: 'Elite Attacker',
        category: 'trait',
        shape: 'pill',
        tier: 'gold',
        requires: { isAttacker: 'elite' },
        supersedes: 'attacker'
    },
    {
        id: 'defender',
        label: 'Defender',
        category: 'trait',
        shape: 'pill',
        tier: 'bronze',
        requires: { isDefender: 'base' }
    },
    {
        id: 'elite-defender',
        label: 'Elite Defender',
        category: 'trait',
        shape: 'pill',
        tier: 'gold',
        requires: { isDefender: 'elite' },
        supersedes: 'defender'
    },
    {
        id: 'shot-stopper',
        label: 'Shot Stopper',
        category: 'trait',
        shape: 'pill',
        tier: 'bronze',
        requires: { isShotStopper: 'base' }
    },
    {
        id: 'elite-shot-stopper',
        label: 'Elite Shot Stopper',
        category: 'trait',
        shape: 'pill',
        tier: 'gold',
        requires: { isShotStopper: 'elite' },
        supersedes: 'shot-stopper'
    },

    // --- Archetypes: rounded rectangle ----------------------------------------------
    {
        id: 'danger-man',
        label: 'Danger Man',
        category: 'archetype',
        shape: 'rounded',
        tier: 'silver',
        requires: { isAttacker: 'base', isFinisher: 'base' }
    },
    {
        id: 'sniper',
        label: 'Sniper',
        category: 'archetype',
        shape: 'rounded',
        tier: 'gold',
        requires: { isAttacker: 'elite', isFinisher: 'elite' },
        supersedes: 'danger-man'
    },
    {
        id: 'engine',
        label: 'Engine',
        category: 'archetype',
        shape: 'rounded',
        tier: 'silver',
        requires: { isAttacker: 'base', isDefender: 'base' }
    },
    {
        id: 'powerhouse',
        label: 'Powerhouse',
        category: 'archetype',
        shape: 'rounded',
        tier: 'gold',
        requires: { isAttacker: 'elite', isDefender: 'elite' },
        supersedes: 'engine'
    },
    {
        id: 'sentinel',
        label: 'Sentinel',
        category: 'archetype',
        shape: 'rounded',
        tier: 'silver',
        requires: { isDefender: 'base', isShotStopper: 'base' }
    },
    {
        id: 'guardian',
        label: 'Guardian',
        category: 'archetype',
        shape: 'rounded',
        tier: 'gold',
        requires: { isDefender: 'elite', isShotStopper: 'elite' },
        supersedes: 'sentinel'
    },
    {
        id: 'utility-hero',
        label: 'Utility Hero',
        category: 'archetype',
        shape: 'rounded',
        tier: 'silver',
        requires: { isFinisher: 'base', isShotStopper: 'base' }
    },
    {
        id: 'maverick',
        label: 'Maverick',
        category: 'archetype',
        shape: 'rounded',
        tier: 'gold',
        requires: { isFinisher: 'elite', isShotStopper: 'elite' },
        supersedes: 'utility-hero'
    },

    // --- Breadth: notched -----------------------------------------------------------
    {
        id: 'all-rounder',
        label: 'All-Rounder',
        category: 'breadth',
        shape: 'notched',
        tier: 'gold',
        requiresCount: { level: 'base', min: 3 }
    },
    // Supersession here is strict implication, not shape family: having all four traits
    // guarantees having three, so All-Rounder adds no information next to True Baller and
    // is hidden. What is NOT hidden is the pairing across excellence levels — Complete
    // Player (3+ Elite) and True Baller (all four base) imply each other in neither
    // direction, so a player holding both keeps both. See "Supersession" in docs/traits.md.
    {
        id: 'true-baller',
        label: 'True Baller',
        category: 'breadth',
        shape: 'faceted',
        tier: 'gold',
        requiresCount: { level: 'base', min: 4 },
        supersedes: 'all-rounder'
    },

    // --- Mastery: faceted -----------------------------------------------------------
    {
        id: 'complete-player',
        label: 'Complete Player',
        category: 'mastery',
        shape: 'notched',
        tier: 'diamond',
        requiresCount: { level: 'elite', min: 3 },
        supersedes: 'all-rounder'
    },
    {
        id: 'goat',
        label: 'G.O.A.T.',
        category: 'mastery',
        shape: 'faceted',
        tier: 'diamond',
        requiresCount: { level: 'elite', min: 4 },
        // Four Elite traits imply three, so Complete Player goes the same way All-Rounder
        // does under True Baller. G.O.A.T. is the only badge that hides two.
        supersedes: ['true-baller', 'complete-player']
    }
];

/** @type {Record<string, BadgeDef>} */
export const BADGES_BY_ID = Object.fromEntries(BADGE_DEFS.map((b) => [b.id, b]));

/**
 * Minimum tier a requirement level demands. Elite satisfies base, never the reverse.
 * @param {'base'|'elite'} level
 */
const minTierFor = (level) => (level === 'elite' ? TIER_ELITE : TIER_BASE);

/**
 * Normalise a player's persisted trait data into a complete tier map.
 *
 * Rankings files written before tiering carry `traits` booleans but no `traitTiers`, so a held
 * trait with no tier falls back to base and awards exactly what it always did.
 *
 * @param {Record<string, boolean>} [traits]
 * @param {Record<string, number>} [traitTiers]
 * @returns {Record<string, 0|1|2>}
 */
export function normaliseTraitTiers(traits, traitTiers) {
    /** @type {Record<string, 0|1|2>} */
    const tiers = {};
    for (const { key } of TRAIT_DEFS) {
        const tier = traitTiers?.[key];
        tiers[key] =
            tier === TIER_ELITE || tier === TIER_BASE
                ? tier
                : traits?.[key]
                  ? TIER_BASE
                  : TIER_NONE;
    }
    return tiers;
}

/**
 * The trait keys a badge is built from, for this particular player.
 *
 * For `requires` badges that is simply the named traits. For `requiresCount` badges it is the
 * traits actually held at the required level — a badge earned three different ways should point
 * at whichever three the player has.
 *
 * @param {BadgeDef} badge
 * @param {Record<string, 0|1|2>} tiers
 * @returns {string[]}
 */
export function contributingTraits(badge, tiers) {
    const requires = badge.requires;
    if (requires) {
        return TRAIT_KEYS.filter((key) => key in requires);
    }
    if (badge.requiresCount) {
        const min = minTierFor(badge.requiresCount.level);
        return TRAIT_KEYS.filter((key) => (tiers[key] ?? TIER_NONE) >= min);
    }
    return [];
}

/**
 * Every badge the given tiers qualify for, in catalogue order, with supersession NOT applied.
 *
 * Supersession is a presentation concern and must not destroy qualification data — a G.O.A.T.
 * genuinely still qualifies for four Elite traits, four Gold archetypes, All-Rounder, True
 * Baller and Complete Player, and those facts stay useful for stats and future badge families.
 *
 * @param {Record<string, 0|1|2>} tiers
 * @returns {BadgeDef[]}
 */
export function qualifiedBadges(tiers) {
    return BADGE_DEFS.filter((badge) => {
        if (badge.requires) {
            return Object.entries(badge.requires).every(
                ([key, level]) => (tiers[key] ?? TIER_NONE) >= minTierFor(level)
            );
        }
        if (badge.requiresCount) {
            const min = minTierFor(badge.requiresCount.level);
            const held = TRAIT_KEYS.filter((key) => (tiers[key] ?? TIER_NONE) >= min).length;
            return held >= badge.requiresCount.min;
        }
        return false;
    });
}

/** Catalogue order is authored by family; display order groups by shape, then material. */
const catalogueIndex = new Map(BADGE_DEFS.map((b, i) => [b.id, i]));

/** @param {BadgeDef} badge */
const displayRank = (badge) =>
    CATEGORY_ORDER.indexOf(badge.category) * 10 + TIER_ORDER.indexOf(badge.tier);

/**
 * The badges to render: qualified, minus anything a held badge supersedes, ordered so the
 * silhouettes group together.
 *
 * @param {Record<string, 0|1|2>} tiers
 * @returns {Array<BadgeDef & { contributingTraits: string[] }>}
 */
export function displayBadges(tiers) {
    const qualified = qualifiedBadges(tiers);
    const superseded = new Set(
        qualified.flatMap((b) => (b.supersedes ? [b.supersedes].flat() : []))
    );
    return qualified
        .filter((badge) => !superseded.has(badge.id))
        .map((badge) => ({ ...badge, contributingTraits: contributingTraits(badge, tiers) }))
        .sort(
            (a, b) =>
                displayRank(a) - displayRank(b) ||
                (catalogueIndex.get(a.id) ?? 0) - (catalogueIndex.get(b.id) ?? 0)
        );
}

/**
 * Human-readable requirement, e.g. "Elite Attacker + Elite Defender" or "3+ Elite traits".
 *
 * @param {BadgeDef} badge
 * @returns {string}
 */
export function requirementLabel(badge) {
    if (badge.requires) {
        return Object.entries(badge.requires)
            .map(([key, level]) => {
                const label = TRAIT_DEFS.find((t) => t.key === key)?.label ?? key;
                return level === 'elite' ? `Elite ${label}` : label;
            })
            .join(' + ');
    }
    if (badge.requiresCount) {
        const { level, min } = badge.requiresCount;
        const noun = level === 'elite' ? 'Elite traits' : 'traits';
        return min >= TRAIT_KEYS.length ? `All ${min} ${noun}` : `Any ${min}+ ${noun}`;
    }
    return '';
}

/**
 * How many traits a badge takes: the named requirements, or the count-based minimum.
 *
 * @param {BadgeDef} badge
 * @returns {number}
 */
export function requiredTraitCount(badge) {
    if (badge.requires) return Object.keys(badge.requires).length;
    if (badge.requiresCount) return badge.requiresCount.min;
    return 0;
}

/**
 * Whether a badge demands Elite traits rather than merely held ones. Every badge's
 * requirements sit at a single level, so one entry settles it.
 *
 * @param {BadgeDef} badge
 * @returns {boolean}
 */
export function requiresEliteTraits(badge) {
    if (badge.requires) return Object.values(badge.requires).includes('elite');
    if (badge.requiresCount) return badge.requiresCount.level === 'elite';
    return false;
}

/**
 * The badge's grade, e.g. "Versatility" or "Rare Archetype" — the noun for how many traits it
 * takes, marked "Rare" when those traits must themselves be Elite.
 *
 * It deliberately does not name the material. `tier` is a function of these same two facts
 * (Trait+base is bronze, Trait+Elite is gold, Versatility+Elite is diamond, and so on), so the
 * colour was redundant with the wording while colliding across families — gold is worn by Rare
 * traits, Rare archetypes and base Versatility alike. Naming the two axes says the same thing
 * without the collision, and the material still carries them visually on the badge itself.
 *
 * @param {BadgeDef} badge
 * @returns {string}
 */
export function gradeLabel(badge) {
    const noun = BREADTH_NOUNS[requiredTraitCount(badge) - 1];
    if (!noun) return '';
    return requiresEliteTraits(badge) ? `Rare ${noun}` : noun;
}

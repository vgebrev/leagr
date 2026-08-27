# ADR: Badge Lattice, Elite Tiers and Visual Grammar

**Status:** Accepted
**Context:** Leagr player badge system
**Decision:** Expand the existing badge lattice to incorporate Elite traits and establish an independent visual grammar where badge shape represents category and material represents rarity/prestige.

## Context

Leagr awards four base player traits from normalized player statistics:

- **Finisher**
- **Attacker**
- **Defender**
- **Shot Stopper**

The original badge hierarchy approximately represented increasing breadth:

- Bronze — individual traits
- Silver — two-trait combinations
- Gold — three or more traits

Elite traits have since been introduced. An **Elite trait represents a player in approximately the top 15% for that trait**.

Elite introduces two independent dimensions into the badge system:

1. **Breadth** — how many areas a player is strong in.
2. **Excellence** — whether the player meets the normal trait threshold or performs at Elite level.

The visual system should communicate these concepts without relying exclusively on colour or redundantly encoding the same information through both colour and shape.

## Decision

The badge system will independently encode:

> **Shape = what kind of badge is this?**
> **Material/colour = how prestigious is it?**

This creates a consistent visual grammar across the entire badge lattice.

### Material / Rarity

| Tier        | Meaning                                           |
| ----------- | ------------------------------------------------- |
| **Bronze**  | Individual base strength                          |
| **Silver**  | Base two-trait archetype                          |
| **Gold**    | Exceptional specialization or exceptional breadth |
| **Diamond** | Elite performance across 3+ dimensions            |

Gold has two distinct routes:

- **Excellence:** Elite individual traits and Elite two-trait archetypes
- **Breadth:** possession of three or four base-or-better traits

Diamond represents the convergence of these concepts: **exceptional breadth at Elite level**.

### Shape / Category

| Category      | Shape             | Meaning                                   |
| ------------- | ----------------- | ----------------------------------------- |
| **Trait**     | Pill              | Atomic individual strength                |
| **Archetype** | Rounded rectangle | Recognizable combination of two strengths |
| **Breadth**   | Notched           | Broad capability across 3–4 dimensions    |
| **Mastery**   | Faceted           | Elite capability across 3–4 dimensions    |

Shape and material are intentionally independent properties.

---

# Base Traits

The four individual traits remain unchanged.

| Requirement        | Badge                  | Category | Tier   | Shape |
| ------------------ | ---------------------- | -------- | ------ | ----- |
| Finisher           | **Finisher**           | Trait    | Bronze | Pill  |
| Attacker           | **Attacker**           | Trait    | Bronze | Pill  |
| Defender           | **Defender**           | Trait    | Bronze | Pill  |
| Shot Stopper       | **Shot Stopper**       | Trait    | Bronze | Pill  |
| Elite Finisher     | **Elite Finisher**     | Trait    | Gold   | Pill  |
| Elite Attacker     | **Elite Attacker**     | Trait    | Gold   | Pill  |
| Elite Defender     | **Elite Defender**     | Trait    | Gold   | Pill  |
| Elite Shot Stopper | **Elite Shot Stopper** | Trait    | Gold   | Pill  |

Elite traits represent approximately the top 15% of qualifying players for the corresponding normalized statistic.

Trait levels are ordinal:

```text
none < base < elite
```

An Elite trait therefore automatically satisfies its corresponding base trait requirement.

Importantly, becoming Elite changes the **material**, not the **shape**:

```text
Attacker       → Bronze Pill
Elite Attacker → Gold Pill
```

Both remain visually identifiable as Trait badges.

---

# Two-Trait Archetypes

The deliberately limited combination system will be retained.

We will **not create badges for every mathematically possible trait combination**. Badges should describe meaningful and recognizable player archetypes rather than exhaustively represent the trait lattice.

This prevents badge/UI clutter, particularly from unusual Shot Stopper + outfield combinations.

## Base Archetypes

| Traits                  | Badge            | Category  | Tier   | Shape             |
| ----------------------- | ---------------- | --------- | ------ | ----------------- |
| Attacker + Finisher     | **Danger Man**   | Archetype | Silver | Rounded rectangle |
| Attacker + Defender     | **Engine**       | Archetype | Silver | Rounded rectangle |
| Defender + Shot Stopper | **Sentinel**     | Archetype | Silver | Rounded rectangle |
| Finisher + Shot Stopper | **Utility Hero** | Archetype | Silver | Rounded rectangle |

A base combination requirement means **Base or Elite** qualification for each constituent trait.

For example:

```text
Attacker + Defender       → Engine
Elite Attacker + Defender → Engine
Attacker + Elite Defender → Engine
```

## Elite Archetypes

When **both constituent traits are Elite**, the Silver archetype upgrades to a corresponding Gold archetype.

| Elite Traits                        | Base Archetype | Elite Archetype | Tier | Shape             |
| ----------------------------------- | -------------- | --------------- | ---- | ----------------- |
| Elite Attacker + Elite Finisher     | Danger Man     | **Sniper**      | Gold | Rounded rectangle |
| Elite Attacker + Elite Defender     | Engine         | **Powerhouse**  | Gold | Rounded rectangle |
| Elite Defender + Elite Shot Stopper | Sentinel       | **Guardian**    | Gold | Rounded rectangle |
| Elite Finisher + Elite Shot Stopper | Utility Hero   | **Maverick**    | Gold | Rounded rectangle |

The Gold archetype supersedes its Silver equivalent for presentation purposes.

For example:

```text
Engine      → Silver Rounded Rectangle
Powerhouse  → Gold Rounded Rectangle
```

The unchanged silhouette communicates that these belong to the same badge family, while the material communicates the upgrade in prestige.

---

# Deliberately Unsupported Two-Trait Combinations

No dedicated archetype currently exists for:

- Attacker + Shot Stopper
- Defender + Finisher

This is intentional.

The badge lattice does not need to represent every possible mathematical combination. New archetypes should only be introduced when there is a meaningful product reason and a recognizable player identity worth representing.

Badge scarcity, recognizable archetypes and low UI clutter take precedence over mathematical completeness.

---

# Multi-Trait Breadth Badges

Possessing three or four traits represents significant all-round capability and remains a **Gold-level achievement**, even when those traits are not Elite.

These are structurally different from Trait and Archetype badges and therefore use the **Notched** shape.

| Requirement                  | Badge           | Category | Tier | Shape   |
| ---------------------------- | --------------- | -------- | ---- | ------- |
| Any 3+ base-or-better traits | **All-Rounder** | Breadth  | Gold | Notched |
| All 4 base-or-better traits  | **True Baller** | Breadth  | Gold | Notched |

**True Baller supersedes All-Rounder** when all four traits qualify.

This provides an alternative route to Gold from Elite specialization.

A player can reach Gold either by being:

- exceptionally strong within a particular area, or
- highly capable across many areas of the game.

Visually, those remain distinguishable:

```text
Elite Attacker → Gold Pill
Powerhouse     → Gold Rounded Rectangle
All-Rounder    → Gold Notched
True Baller    → Gold Notched
```

All are Gold-level achievements, but their silhouettes communicate why they are Gold.

---

# Elite Breadth / Mastery Badges

Diamond is reserved for players demonstrating exceptional breadth **at Elite level**.

These badges use the distinctive **Faceted** shape.

| Requirement         | Badge               | Category | Tier    | Shape   |
| ------------------- | ------------------- | -------- | ------- | ------- |
| Any 3+ Elite traits | **Complete Player** | Mastery  | Diamond | Faceted |
| All 4 Elite traits  | **G.O.A.T.**        | Mastery  | Diamond | Faceted |

**G.O.A.T. supersedes Complete Player** when all four traits are Elite.

G.O.A.T. becomes the pinnacle of the badge lattice rather than simply representing possession of all four base traits.

---

# Visual Grammar

The UI must treat badge shape and material as independent semantic channels.

## Shape Answers: "What Kind of Badge Is This?"

```text
Pill               → Trait
Rounded Rectangle  → Archetype
Notched            → Breadth
Faceted            → Mastery
```

The progression intentionally moves from visually simple to increasingly distinctive shapes as the conceptual breadth of the badge increases.

## Material Answers: "How Prestigious Is This?"

```text
Bronze   → Base individual strength
Silver   → Base archetype
Gold     → Excellence
Diamond  → Mastery
```

Colour/material should therefore **not determine badge shape**.

For example, these three Gold badges deliberately have different silhouettes:

```text
Elite Attacker → Gold Pill
Powerhouse     → Gold Rounded Rectangle
True Baller    → Gold Notched
```

Conversely, badges within the same category retain their silhouette as they increase in prestige:

```text
Attacker    → Bronze Pill
Elite Attacker → Gold Pill

Engine      → Silver Rounded Rectangle
Powerhouse  → Gold Rounded Rectangle
```

This provides visual inheritance between related badges.

---

# Accessibility and Information Density

The two-dimensional visual system reduces dependence on colour alone.

Users can distinguish badge categories from silhouette even where:

- colour perception differs,
- badges are viewed at small sizes,
- several badges share the same Gold material,
- styling is rendered in reduced-colour contexts.

It also increases information density when multiple badges appear together.

For example:

```text
[Gold Pill]               Elite Attacker
[Gold Rounded Rectangle]  Powerhouse
[Gold Notched]            True Baller
```

Without reading the labels, the silhouettes communicate:

```text
Elite Trait
Elite Archetype
Breadth Achievement
```

A Diamond Faceted badge then visually separates Mastery achievements from the rest of the lattice.

---

# Complete Badge Catalogue

| Badge              | Category  | Tier    | Shape             |
| ------------------ | --------- | ------- | ----------------- |
| Finisher           | Trait     | Bronze  | Pill              |
| Attacker           | Trait     | Bronze  | Pill              |
| Defender           | Trait     | Bronze  | Pill              |
| Shot Stopper       | Trait     | Bronze  | Pill              |
| Danger Man         | Archetype | Silver  | Rounded Rectangle |
| Engine             | Archetype | Silver  | Rounded Rectangle |
| Sentinel           | Archetype | Silver  | Rounded Rectangle |
| Utility Hero       | Archetype | Silver  | Rounded Rectangle |
| Elite Finisher     | Trait     | Gold    | Pill              |
| Elite Attacker     | Trait     | Gold    | Pill              |
| Elite Defender     | Trait     | Gold    | Pill              |
| Elite Shot Stopper | Trait     | Gold    | Pill              |
| Sniper             | Archetype | Gold    | Rounded Rectangle |
| Powerhouse         | Archetype | Gold    | Rounded Rectangle |
| Guardian           | Archetype | Gold    | Rounded Rectangle |
| Maverick           | Archetype | Gold    | Rounded Rectangle |
| All-Rounder        | Breadth   | Gold    | Notched           |
| True Baller        | Breadth   | Gold    | Notched           |
| Complete Player    | Mastery   | Diamond | Faceted           |
| G.O.A.T.           | Mastery   | Diamond | Faceted           |

---

# Eligibility Model

Trait level, badge category and badge tier must be modeled separately.

Avoid deriving these properties from each other.

For example, do **not** implement:

```js
if (badge.tier === 'gold') {
    badge.shape = 'notched';
}
```

Instead, badge definitions should independently describe their semantics:

```js
{
    id: 'powerhouse',
    category: 'archetype',
    tier: 'gold',
    requires: {
        attacker: 'elite',
        defender: 'elite'
    },
    supersedes: 'engine'
}
```

Presentation can then independently map category and tier:

```js
const shapes = {
    trait: 'pill',
    archetype: 'rounded',
    breadth: 'notched',
    mastery: 'faceted'
};

const materials = {
    bronze: 'bronze',
    silver: 'silver',
    gold: 'gold',
    diamond: 'diamond'
};
```

This establishes the core invariant:

```text
shape    = badge.category
material = badge.tier
```

---

# Supersession Rules

At minimum:

```text
Sniper          > Danger Man
Powerhouse      > Engine
Guardian        > Sentinel
Maverick        > Utility Hero

True Baller     > All-Rounder

G.O.A.T.        > Complete Player
```

Supersession applies to badge presentation and should **not** destroy or remove underlying qualification data.

A G.O.A.T., for example, still qualifies for:

- four Elite traits,
- four base traits,
- potentially several Gold Elite archetypes,
- All-Rounder,
- True Baller,
- Complete Player.

Those qualifications remain useful for profiles, statistics, tooltips, achievements, analytics and future features even when the UI chooses to emphasize higher-order badges.

---

# Architectural Constraints

The badge engine should keep the following concerns separate:

1. **Trait qualification**
2. **Trait level**
3. **Badge eligibility**
4. **Badge category**
5. **Badge tier/rarity**
6. **Badge presentation**
7. **Badge supersession**

In particular:

```text
qualification ≠ category ≠ rarity ≠ presentation
```

Do not encode Bronze/Silver/Gold/Diamond directly into trait-calculation logic, and do not derive badge shape from badge tier.

This allows future badge families—such as cumulative achievements, streaks, seasonal awards, team achievements or special badges—to coexist without having to conform to the player-trait lattice.

---

# Final Decision Summary

The revised Leagr badge lattice rewards two different forms of exceptional player:

**Breadth**

> Strong across many dimensions → All-Rounder / True Baller

**Excellence**

> Elite within a specialization → Elite Trait / Elite Archetype

These paths converge at Diamond:

> **3 Elite traits → Complete Player**
> **4 Elite traits → G.O.A.T.**

The visual language independently communicates badge category and prestige:

> **Pill = Trait**
> **Rounded Rectangle = Archetype**
> **Notched = Breadth**
> **Faceted = Mastery**

while:

> **Bronze = Strength**
> **Silver = Archetype-level breadth**
> **Gold = Excellence**
> **Diamond = Mastery**

Or, as the core implementation rule:

```text
shape = badge.category
material = badge.tier
```

The lattice remains intentionally curated rather than exhaustive. Badge scarcity, recognizable player identities, visual clarity and low UI clutter take precedence over mathematically representing every possible trait combination.

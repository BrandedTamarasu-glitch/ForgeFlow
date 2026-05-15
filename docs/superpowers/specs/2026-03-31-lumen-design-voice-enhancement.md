# Lumen — Design Voice Enhancement

**Date:** 2026-03-31
**Scope:** All three lumen agents (consult, implement, review)

## Problem

Lumen's current Hat 1 (Frontend) describes *what* to check — spacing, typography, color, accessibility — but provides no guidance on *how to think about design*. The result is correct but generic output: well-structured UI that lacks aesthetic intentionality, trend awareness, or craft depth.

## Goal

Lumen becomes capable of:
1. **Generating distinctive designs** — bold and opinionated on greenfield, adaptive on existing codebases
2. **Articulating design rationale** — using shared vocabulary (hierarchy, tension, rhythm, gestalt)
3. **Applying current design knowledge** — knowing movements, knowing anti-patterns, making deliberate choices

## Approach

**B structure, C implementation**: Write design philosophy content once as a canonical reference file, paste it into all three agents as a `## Design Voice` section. Single source of truth for future updates.

### Files to create

- `~/.claude/agents/lumen-design-principles.md` — canonical reference, not an agent

### Files to modify

- `~/.claude/agents/lumen-consult.md`
- `~/.claude/agents/lumen-implement.md`
- `~/.claude/agents/lumen-review.md`

## Design Voice Section Content

Identical content in all three agents, inserted after the Hat 1 section:

### Greenfield vs. Adaptive Mode

- **Greenfield** (no established visual identity): Pick a bold aesthetic direction and commit fully. Choose from the full spectrum — brutalist/raw, editorial/magazine, luxury/refined, retro-futuristic, organic/natural, maximalist, industrial, art deco, toy-like playful. Generic is the failure mode.
- **Adaptive** (existing visual identity): Read the project's visual language first. Extract palette, type scale, spacing rhythm, and component patterns. Extend them — don't override them.

### Aesthetic Frameworks

- **Hierarchy** — Every screen has one primary thing. Establish dominance through size, weight, contrast, position — then step everything else down intentionally.
- **Tension** — Productive tension: large vs. small, dense vs. airy, serif vs. geometric sans, muted field vs. sharp accent. Tension creates energy. Everything harmonious at the same weight is flat.
- **Rhythm** — Spacing is a system. Consistent scale (4/8/16/32/64px). Breaking the rhythm intentionally for a focal element creates emphasis; accidentally creates noise.
- **Gestalt** — Proximity groups. Similarity classifies. Continuity guides the eye. Use whitespace as a grouping tool, alignment as a relationship signal.

### Current Design Vocabulary

Know these movements, apply deliberately:

- **Bento grids** — modular varied-size card layouts; dashboards and feature showcases
- **Editorial layouts** — magazine-style asymmetry, oversized type, text-as-graphic-element
- **Glassmorphism** — frosted blur + transparency; only works with depth behind it AND sufficient text contrast against the blurred composite (not just the background color). Peaked 2021–2022 — use sparingly, requires strong contextual justification.
- **Claymorphism** — soft 3D, inflated shapes, pastel + shadow; playful/consumer products. Was ubiquitous 2022–2023 — now reads as dated unless the product context demands it.
- **Brutalist web** — raw structure, monospace, harsh borders; powerful when intentional
- **Neubrutalism** — brutalist bones + color + personality; bold fills, thick borders, visible shadows
- **Typographic-first** — type carries the graphic weight instead of illustration or photography; layout and spatial composition still matter, but type is the primary visual element
- **Dark editorial** — high-contrast dark + refined type; developer tools, creative tools, dashboards
- **Grain + noise textures** — subtle noise overlay adds tactility to large flat color fields; looks like compression artifacts on small elements or over images — use on large surfaces only
- **Motion-first** — interaction IS the brand; transitions communicate personality and state

### Craft Depth

**Typography:**
- Pair a distinctive display font with a refined body font — contrast, not match
- Size, weight, spacing are primary hierarchy tools — color is secondary
- Line-height: 1.1–1.2 display, 1.5–1.7 body
- Tracking: -0.02em to -0.04em on large headings; slightly open on small caps/labels

**Color:**
- One dominant tone, one sharp accent, one neutral field — 60/30/10 ratio discipline
- Temperature contrast makes a palette feel alive: warm accent on cool field (or vice versa)
- Tint stacking for interactive states: use 5–10% tints of the accent for hover/focus instead of opacity or grey
- Dark mode: near-blacks (#0a0a0a, #111, #1a1a1a), not pure black
- Light mode: near-whites (#f9f9f9, #fafafa), not pure white — same reasoning applies
- Semantic color used consistently across the full surface

**Motion:**
- One well-orchestrated entrance beats scattered micro-interactions
- Easing: ease-out entrances, ease-in exits, ease-in-out state transitions
- Duration: 150–200ms feedback, 300–500ms layout, 600–800ms page entrances
- Prefer transform and opacity — they run on the compositor thread without reflow. Avoid animating width/height/top/left on frequently triggered interactions. `clip-path` and intentional accordion reveals are valid exceptions when the animation is deliberate and infrequent.

**Spatial composition:**
- Generous negative space OR controlled density — pick one
- Intentional asymmetry creates dynamism; accidental asymmetry creates noise
- Overlap and layering add depth
- Diagonal/angled elements used sparingly for maximum impact

### Anti-patterns

Stop and reconsider if about to do any of these:
- System fonts as primary typeface without a deliberate reason (acceptable in dev tools and utilities where "fast and native" is intentional — not acceptable by default)
- Purple gradient on white/light grey
- Centered hero → three equal columns → footer
- Cards all same size with same internal layout
- Hover = slightly darker background
- Loading spinner with no personality
- Empty state = just "No results"
- MUI component defaults without customization — default palette + default spacing + default component variants = every 2018 Material Design app. Always customize the theme.

## Per-Mode Activation

### consult
- Insert `## Design Voice` after Hat 1 section
- Output format: add **Design Direction** sub-section (aesthetic mode chosen, direction rationale)

### implement
- Insert `## Design Voice` after Hat 1 section
- Output format: add **Aesthetic Decisions** sub-section (one line per significant design call, so reviewers know it was intentional)

### review
- Insert `## Design Voice` after Hat 1 section
- Visual Design checklist gains two items:
  - **Aesthetic intentionality** — clear design direction, or generic/template? If flagging as generic, name the specific anti-pattern being triggered — a finding without a named anti-pattern is not actionable.
  - **Trend awareness** — choices feel current or dated? If dated, name the movement and its shelf-life status.

## Success Criteria

- Lumen's greenfield UI output has a named, committed aesthetic direction
- Lumen can articulate *why* a design choice works using the framework vocabulary
- Lumen flags generic/template aesthetics in review with specific anti-pattern callout
- Adaptive mode correctly reads and extends existing visual language without imposing

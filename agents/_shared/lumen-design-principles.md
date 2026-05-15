---
name: lumen-design-principles
description: Canonical Design Voice reference for lumen agents. Not an agent — a shared reference file. Update here, then paste into all three lumen agents.
---

## Design Voice

### Greenfield vs. Adaptive Mode

**Greenfield** (no established visual identity): Pick a bold aesthetic direction and commit fully. Choose from the full spectrum — brutalist/raw, editorial/magazine, luxury/refined, retro-futuristic, organic/natural, maximalist, industrial, art deco, toy-like playful. Generic is the failure mode.

**Adaptive** (existing visual identity): Read the project's visual language first. Extract palette, type scale, spacing rhythm, and component patterns already in use. Extend them — don't override them. Make the new thing feel like it belonged all along.

### Aesthetic Frameworks

- **Hierarchy** — Every screen has one primary thing. If two things compete equally for attention, neither wins. Establish dominance through size, weight, contrast, and position — then step everything else down intentionally.
- **Tension** — Great design has productive tension: large vs. small, dense vs. airy, serif vs. geometric sans, muted field vs. sharp accent. Tension creates energy. Everything harmonious at the same weight is flat.
- **Rhythm** — Spacing is a system, not a series of one-off decisions. Consistent spacing scale (4/8/16/32/64px). Breaking the rhythm intentionally for a focal element creates emphasis — breaking it accidentally creates noise.
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
- Pair a distinctive display font with a refined body font — they should create contrast, not match
- Size, weight, and spacing are the primary hierarchy tools — color is secondary
- Line-height: 1.1–1.2 for display, 1.5–1.7 for body
- Tracking: -0.02em to -0.04em on large headings; slightly open on small caps/labels

**Color:**
- One dominant tone, one sharp accent, one neutral field — 60/30/10 ratio discipline
- Temperature contrast makes a palette feel alive: warm accent on cool field (or vice versa)
- Tint stacking for interactive states: use 5–10% tints of the accent for hover/focus instead of opacity or grey
- Dark mode: near-blacks (#0a0a0a, #111, #1a1a1a), not pure black
- Light mode: near-whites (#f9f9f9, #fafafa), not pure white
- Semantic color used consistently across the full surface

**Motion:**
- One well-orchestrated entrance (staggered reveals, animation-delay) beats scattered micro-interactions
- Easing: ease-out for entrances, ease-in for exits, ease-in-out for state transitions
- Duration: 150–200ms for UI feedback (hover, click), 300–500ms for layout transitions, 600–800ms for page entrances
- Prefer transform and opacity — they run on the compositor thread without reflow. Avoid animating width/height/top/left on frequently triggered interactions. `clip-path` and intentional accordion reveals are valid exceptions when deliberate and infrequent.
- All animation must respect `prefers-reduced-motion: reduce` — transform entrances collapse to instant, opacity fades acceptable at 100ms max. Always wrap non-trivial animation in `@media (prefers-reduced-motion: no-preference)` or check `window.matchMedia('(prefers-reduced-motion: reduce)')` in JS.

**Spatial composition:**
- Generous negative space OR controlled density — pick one, execute it fully (Apple product pages = generous; Bloomberg Terminal-style dashboards = controlled density)
- Intentional asymmetry creates dynamism; accidental asymmetry creates noise
- Overlap and layering (z-axis) add depth without 3D effects
- Diagonal/angled elements used sparingly for maximum impact

### Anti-patterns

Stop and reconsider if about to do any of these:
- System fonts as primary typeface without a deliberate reason (acceptable in dev tools and utilities where "fast and native" is intentional)
- Purple gradient on white/light grey
- Centered hero → three equal columns → footer
- Cards all same size with same internal layout
- Hover = slightly darker background
- Loading spinner with no personality
- Empty state = just "No results"
- MUI component defaults without customization — default palette + default spacing + default component variants = every 2018 Material Design app. Always customize the theme.
- Hover-only affordances — actions or states visible only on cursor hover with no focus/touch equivalent. Touch devices and keyboard users cannot trigger hover. Fix: mirror `:hover` styles to `:focus-visible`; ensure touch tap reveals the same affordance.

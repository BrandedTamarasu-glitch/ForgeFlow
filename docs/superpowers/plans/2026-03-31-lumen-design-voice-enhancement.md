# Lumen Design Voice Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `## Design Voice` section to all three lumen agents giving Lumen trend awareness, aesthetic frameworks, and craft depth for generating beautiful and distinctive UI.

**Architecture:** Create one canonical reference file (`lumen-design-principles.md`) containing the full Design Voice content, then paste it into all three agent files after the Hat 1 section. Each agent gets a mode-specific output format addition to activate the new capabilities.

**Tech Stack:** Markdown file editing only — no code, no tests, no build step.

---

## File Map

| Action | File |
|--------|------|
| Create | `~/.claude/agents/lumen-design-principles.md` |
| Modify | `~/.claude/agents/lumen-consult.md` |
| Modify | `~/.claude/agents/lumen-implement.md` |
| Modify | `~/.claude/agents/lumen-review.md` |

---

### Task 1: Create canonical reference file

**Files:**
- Create: `~/.claude/agents/lumen-design-principles.md`

- [ ] **Step 1: Create the file**

Create `~/.claude/agents/lumen-design-principles.md` with this exact content:

```markdown
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
```

- [ ] **Step 2: Verify file exists**

```bash
ls -la ~/.claude/agents/lumen-design-principles.md
```

Expected: file listed with non-zero size.

- [ ] **Step 3: Commit**

```bash
git -C ~/.claude add agents/lumen-design-principles.md
git -C ~/.claude commit -m "feat: add lumen-design-principles canonical reference"
```

---

### Task 2: Update lumen-consult.md

**Files:**
- Modify: `~/.claude/agents/lumen-consult.md`

- [ ] **Step 1: Read the current file**

Read `~/.claude/agents/lumen-consult.md` to confirm current structure before editing.

- [ ] **Step 2: Insert Design Voice section**

Insert the full `## Design Voice` block (identical to Task 1 content, minus the frontmatter) immediately after the closing line of the Hat 1 / Hat 2 role description and before `## Mode: Consult`. The insertion point is after line 27 (ending `...Warden owns security boundaries — you verify traffic flows through them correctly.`).

The block to insert:

```markdown

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
```

- [ ] **Step 3: Add Design Direction to output format**

Find the line:

```
Output: `# Lumen — Design & Connectivity Brief` with Frontend and Data Connectivity sections.
```

Replace with:

```
Output: `# Lumen — Design & Connectivity Brief` with Frontend, Design Direction, and Data Connectivity sections.

**Design Direction sub-section format:**
```
**Design Direction:** [Greenfield/Adaptive] — [named aesthetic or extension rationale] — [one sentence on why this direction serves the context]
```
```

- [ ] **Step 4: Verify the edit looks correct**

Read the file and confirm:
1. `## Design Voice` section appears before `## Mode: Consult`
2. `Design Direction` sub-section format is present in the output description

- [ ] **Step 5: Commit**

```bash
git -C ~/.claude add agents/lumen-consult.md
git -C ~/.claude commit -m "feat: add Design Voice to lumen consult agent"
```

---

### Task 3: Update lumen-implement.md

**Files:**
- Modify: `~/.claude/agents/lumen-implement.md`

- [ ] **Step 1: Read the current file**

Read `~/.claude/agents/lumen-implement.md` to confirm current structure before editing.

- [ ] **Step 2: Insert Design Voice section**

Insert the identical `## Design Voice` block (same content as Task 2 Step 2) immediately after the closing line of the Hat 1 / Hat 2 role description and before `## Mode: Implement`.

- [ ] **Step 3: Add Aesthetic Decisions to output format**

Find the line:

```
Output: `# Lumen — Implementation Report` with sections: Files Created/Modified, Frontend (Components Built, Accessibility Implemented, Responsive Behavior), Data Connectivity (Service Connections Built/Modified, Redundancies Eliminated, Resilience Added), Integration Points.
```

Replace with:

```
Output: `# Lumen — Implementation Report` with sections: Files Created/Modified, Frontend (Components Built, Aesthetic Decisions, Accessibility Implemented, Responsive Behavior), Data Connectivity (Service Connections Built/Modified, Redundancies Eliminated, Resilience Added), Integration Points.

**Aesthetic Decisions format** — one line per significant design call:
```
- [component/element]: [design call made] — [why: greenfield direction chosen / adaptive extension of existing pattern]
```
```

- [ ] **Step 4: Verify the edit looks correct**

Read the file and confirm:
1. `## Design Voice` section appears before `## Mode: Implement`
2. `Aesthetic Decisions` format is present in the output description

- [ ] **Step 5: Commit**

```bash
git -C ~/.claude add agents/lumen-implement.md
git -C ~/.claude commit -m "feat: add Design Voice to lumen implement agent"
```

---

### Task 4: Update lumen-review.md

**Files:**
- Modify: `~/.claude/agents/lumen-review.md`

- [ ] **Step 1: Read the current file**

Read `~/.claude/agents/lumen-review.md` to confirm current structure before editing.

- [ ] **Step 2: Insert Design Voice section**

Insert the identical `## Design Voice` block (same content as Task 2 Step 2) immediately after the closing line of the role description and before `## Mode: Review`.

- [ ] **Step 3: Expand the Visual Design checklist**

Find the Visual Design section:

```
#### Visual Design (5)
- **Spacing & layout:** Consistent scale? Alignment?
- **Typography:** Hierarchy? Consistent sizes/weights?
- **Color:** Palette consistency? Contrast?
- **Responsive:** Breakpoints? Overflow/squishing?
- **Polish:** Hover, focus rings, transitions?
```

Replace with:

```
#### Visual Design (7)
- **Spacing & layout:** Consistent scale? Alignment?
- **Typography:** Hierarchy? Consistent sizes/weights?
- **Color:** Palette consistency? Contrast?
- **Responsive:** Breakpoints? Overflow/squishing?
- **Polish:** Hover, focus rings, transitions?
- **Aesthetic intentionality:** Clear design direction, or generic/template? If flagging as generic, name the specific anti-pattern being triggered — a finding without a named anti-pattern is not actionable.
- **Trend awareness:** Do design choices feel current or dated? If a dated movement is present (glassmorphism, claymorphism) without strong contextual justification, flag it by name.
```

- [ ] **Step 4: Verify the edit looks correct**

Read the file and confirm:
1. `## Design Voice` section appears before `## Mode: Review`
2. Visual Design checklist now reads `(7)` and has both new items

- [ ] **Step 5: Commit**

```bash
git -C ~/.claude add agents/lumen-review.md
git -C ~/.claude commit -m "feat: add Design Voice to lumen review agent"
```

---

## Self-Review

**Spec coverage check:**
- [x] Canonical reference file created — Task 1
- [x] Greenfield vs. adaptive mode — all three agents, Design Voice section
- [x] Aesthetic frameworks (hierarchy, tension, rhythm, gestalt) — Design Voice section
- [x] Current design vocabulary with shelf-life signals — Design Voice section
- [x] Craft depth: typography, color (expanded), motion (qualified), spatial — Design Voice section
- [x] Anti-patterns including MUI defaults — Design Voice section
- [x] consult output: Design Direction sub-section — Task 2 Step 3
- [x] implement output: Aesthetic Decisions sub-section — Task 3 Step 3
- [x] review checklist: aesthetic intentionality + trend awareness (named findings required) — Task 4 Step 3

**Placeholder scan:** No TBDs, TODOs, or "similar to Task N" references. All content is complete and explicit in each task.

**Type consistency:** No code types involved — markdown content only. Section headers and format strings are consistent across all four tasks.

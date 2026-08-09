# WriteWise — DESIGN.md

**A Computer Vision and CNN-Based Diagnostic Cursive Handwriting Assessment and Progress Monitoring System**

- **Document type:** Internal design guide (companion to PRD.md, ARCHITECTURE.md, CV_PIPELINE.md, ML_PIPELINE.md, DATABASE.md, API_SPEC.md, TECH_STACK.md, SECURITY.md)
- **Team:** Ryan Christopher B. Estoque, John Lawrence V. Monleon, James David B. Asoy, Saara Eliana G. Ibag
- **Status:** Draft v1 — reflects decisions locked as of this document's creation. Update this file whenever a design decision changes; it should stay the single source of truth for "how the product looks and behaves," the way ARCHITECTURE.md is the source of truth for "how the system is built" and PRD.md is the source of truth for "what the system does."
- **Secondary use:** this document is written to be readable both as a build spec (concrete tokens/values a developer implements directly) and as source material for an AI UI-generation prompt (Figma AI / Google Stitch), if one is drafted later from it.

---

## 1. Design Principles

WriteWise sits between two audiences with genuinely different needs from the same screens: **teachers** need to trust it as a credible diagnostic instrument, and **parents** need it to feel supportive rather than alarming about their own child's developing skill. Almost every design decision in this document resolves that same tension — precision where it builds trust, warmth where it prevents anxiety — rather than picking one tone and applying it everywhere.

Three principles run through the whole system:

1. **Diagnostic, not evaluative.** This is a developmental tool tracking a skill in progress, not a pass/fail grade. Color, layout, and copy consistently avoid alarm-coded signals (no red, no "failing" language) in favor of a growth framing.
2. **Precision where it counts, warmth where it helps.** Data-dense surfaces (score tables, roster views, raw numbers) stay sharp-edged and flat. Human-facing surfaces (feedback panels, cards, buttons) get rounded corners and soft shadows. This split is a repeating pattern across shape, elevation, and even color — not a one-off choice.
3. **Two devices, two jobs.** Photo capture happens on a phone, in a classroom or at home. Review and analysis happens at a desk. The system is designed context-first, not as one generic responsive layout stretched across both.

---

## 2. Design Tokens

### 2.1 Color System

**Brand accent — deep teal.** Kept deliberately far from the band gradient (§2.1.2) on the color wheel so a button or link can never be mistaken for a diagnostic signal.

| Token | Hex | Use |
|---|---|---|
| `brand-700` | `#145049` | Hover/active states, high-emphasis text on light bg |
| `brand-600` | `#1B6B63` | Primary buttons, links, active nav state |
| `brand-100` | `#E4F1EF` | Subtle backgrounds, selected-state fills |

**Diagnostic bands — warm-neutral gradient, no red.** Four ordered stops, amber → gold → sage → forest. Chosen specifically to avoid traffic-light red on a parent-facing screen showing their own child's developing skill.

| Band | Token | Hex | Reads as |
|---|---|---|---|
| Needs Improvement | `band-1` | `#B6754A` (clay) | Early stage, not "failing" |
| Developing | `band-2` | `#C9A227` (gold) | In progress |
| Satisfactory | `band-3` | `#7C9B6E` (sage) | On track |
| Excellent | `band-4` | `#4A8B5C` (forest) | Strong |

> **Why not red-to-green:** the classic traffic-light gradient is the most familiar pattern, but it also reads as pass/fail — and this tool assesses a skill a Grade 3 student is still developing, not a test they passed or failed. A parent checking this repeatedly over a school term shouldn't see red on their kid's work. **Color is never the only signal** — every band indicator anywhere in the product pairs its color with the band's text label (see §10, Accessibility).

**Neutrals.** A cool-leaning warm-gray, not the cream-and-terracotta combination common in generic "warm brand" defaults — chosen to pair cleanly with the teal accent instead of competing with it.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#F7F8F7` | Page background |
| `surface` | `#FFFFFF` | Cards, panels, table rows |
| `border` | `#E3E6E4` | Dividers, input borders, table gridlines |
| `text-primary` | `#1E2422` | Body copy, headings |
| `text-secondary` | `#5B6663` | Labels, captions, secondary info |

### 2.2 Typography

Two-font pairing: a warm display face for headers/branding, a highly legible sans for body text and dense data.

| Role | Typeface | Notes |
|---|---|---|
| Display / headings | **Poppins** | Geometric, rounded terminals — carries the Warm Educational personality on headers, the wordmark, and section titles. Used with restraint (headings only, not body copy). |
| Body / data | **Inter** | Optimized for legibility at small sizes with tabular figures — used for all body copy, table cells, and score numbers, where misreading a digit has real consequences. |

Both are free, widely supported Google Fonts with no licensing overhead for an academic project a panel may review.

### 2.3 Spacing Scale

A constrained subset of Tailwind's default spacing scale, documented as the team's only allowed values — not new tooling, just a shared convention across 4 developers building different screens.

| Token | Value | Tailwind class |
|---|---|---|
| `space-1` | 4px | `1` |
| `space-2` | 8px | `2` |
| `space-3` | 12px | `3` |
| `space-4` | 16px | `4` |
| `space-6` | 24px | `6` |
| `space-8` | 32px | `8` |
| `space-12` | 48px | `12` |
| `space-16` | 64px | `16` |

> **Why constrain it:** with 4 people building UI in parallel, an unconstrained spacing scale drifts fast — one dev's `p-5`, another's `p-6` for the "same" gap. A documented subset costs nothing to adopt and keeps every screen feeling like the same product.

### 2.4 Shape & Elevation

Radius and shadow follow the same precision/warmth split described in §1.

| Element class | Radius | Shadow |
|---|---|---|
| Data-dense (tables, roster rows, score cells, raw measurement displays) | `rounded-none` – `rounded-sm` (0–4px) | None — 1px `border` only |
| Buttons, inputs | `rounded-lg` (8px) | None (default state) |
| Cards, modals, panels, feedback UI | `rounded-xl`–`rounded-2xl` (12–16px) | Soft, warm-toned, low-opacity (e.g. `rgba(30,40,35,0.06)`, not default cool-gray box-shadow) |

> **Why split it:** shape and elevation do real communicative work here, not just decoration. Sharp, flat surfaces on data signal "this is precise, trust the number." Rounded, soft-shadowed surfaces on feedback/cards signal "this is a supportive tool, not a report card." The split is free to implement — it's a per-component Tailwind class choice, not a separate system.

### 2.5 Iconography

**Lucide** — outline style, default shadcn/ui pairing (no extra theming work needed to match), already available in the broader toolchain. Standard sizes: 16px (inline/labels), 20px (buttons/nav), 24px (empty states/section headers). Default 2px stroke weight.

### 2.6 Motion

**Framer Motion**, scoped to a short list of purposeful moments only — not applied broadly across the app:

- Simulated staged-progress sequence during submission processing (§8.2)
- Composite → per-criterion drill-in transition on the diagnostic overlay (§8.4)
- Band badge reveal on the result screen

Everything else (dropdowns, hovers, page-load) uses default shadcn/Tailwind transitions. Standard duration: 200–250ms, ease-out. Drill-in highlight: spring, low bounce.

> **Why scoped, not broad:** motion reinforces "something intelligent just happened" at the few moments that matter (processing, diagnosis) — applied everywhere, it becomes noise and a timeline risk on a 9–10 week runway where motion polish isn't part of the thesis validation.

---

## 3. Component Strategy

**Themed shadcn/ui.** Component structure, behavior, and accessibility patterns are used as-is from shadcn — no bespoke component rebuilds. Visual identity is expressed entirely through token overrides: the color palette (§2.1), font pairing (§2.2), radius/shadow split (§2.4), applied via `tailwind.config` and CSS variables.

> **Why not bespoke:** every design decision in this document is expressible as a token override on top of shadcn's existing components. Rebuilding components visually from scratch would add real build time for a 4-person team against a compressed defense timeline, without changing anything the thesis is actually evaluated on (CV/CNN accuracy, Spearman's Rho, ISO/IEC 25010).

**Dark mode:** not designed or shipped for the pilot (no requirement in the PRD), but because shadcn's theming already runs on CSS variables, the token structure supports adding it later without a re-architecture. This costs nothing now — it's a property of the approach already locked, not separate scope.

---

## 4. Responsive & Layout Strategy

Two primary contexts, not one generic responsive layout:

| Flow | Primary context | Reasoning |
|---|---|---|
| Submission upload/capture | **Mobile-first** | Real-world device is a phone camera, per PRD §9 (Android 9+ / iOS 15+) |
| Dashboard, roster, review, diagnostics | **Desktop-first** | PRD §9 explicitly names desktop/laptop as the review context |

Both remain functional (not broken) at the non-primary size — this is about which breakpoint gets primary design attention, not about excluding either device.

---

## 5. Navigation & Information Architecture

Role-differentiated, matching how much "surface area" each role actually manages:

- **Teacher:** persistent left sidebar (desktop) — Roster, Activities, Dashboard, Settings — collapsing to a top bar + drawer on mobile.
- **Parent:** lightweight top nav, mobile-first — the parent's world is effectively one screen (their child's progress) plus an upload action, so a full sidebar would be wasted structure.
- **Multi-child parents:** an always-present child switcher at the top of the parent nav (a simple selector, not conditional UI) — for a parent with one child it just shows their name; for a parent with more than one enrolled at the school, it scales automatically. Cheap insurance against a real edge case at a single-school pilot scale.

Class-related management (which roster/section a teacher is linked to) lives on the Roster screen, not in Settings — one source of truth for "class" information.

---

## 6. Screen Inventory

**Shared**
1. Login (Supabase Auth, role-aware redirect)
2. Parent invite/accept (set password → land in parent portal)
3. Settings — profile, password, sign out. Same minimal shape for both roles; no class-management here (see §5).

**Teacher — Phase 1**
4. Class roster (list, add/edit student)
5. Create activity (target text entry)
6. Activity list
7. Submission upload (native photo picker → preview/confirm → submit)
8. Processing state ("Analyzing handwriting...", staged)
9. Phase 1 result view — raw measurements + manual rubric-score entry

**Teacher — Phase 2** (adds to / replaces Phase 1 screens)
10. Phase 2 result view — calibrated score, band, diagnostic overlay, text breakdown (*replaces #9*)
11. Class-wide dashboard — roster table sortable by weakest criterion, class-average trend
12. Per-student drill-down — per-criterion trend history

**Parent — Phase 2 only**
13. Child progress dashboard — per-criterion + composite trend
14. Latest diagnostic feedback view
15. Submission upload — same core flow as teacher's, scoped to an assigned activity

---

## 7. Key Interaction Patterns

### 7.1 Submission Upload Flow

1. **Capture:** native file input (`<input type="file" capture>`) opens the device's own camera/photo picker. No custom in-browser camera UI — the backend quality gate (ARCHITECTURE §8) is already the real validation layer; a client-side camera guide would duplicate that work for a 9–10 week runway with no spare margin.
2. **Preview & confirm:** the selected photo is shown full-size with **Retake** and **Submit**, alongside an explicit re-display of which student and activity this submission will attach to (e.g. "Student: Juan Dela Cruz · Activity: Week 3 Cursive Practice").
3. **Submit** → processing state.

> **Why the confirm step names the student and activity, not just the photo:** the real risk here isn't just a bad photo — it's a teacher moving fast through a class of 30 and attaching the right worksheet to the wrong student. That kind of mis-attribution corrupts the Phase 1 calibration dataset as seriously as a blurry image does, and a one-line confirmation catches it for free.

### 7.2 Processing / Loading State

A single spinner with **rotating, simulated staged progress text** advancing on a fixed timer, not a live backend status feed:

> "Checking image quality…" → "Analyzing letters…" → "Calculating scores…"

Timer intervals should be calibrated against real per-stage timing already captured by application logging (ARCHITECTURE §15), not guessed.

> **Why simulated, not backend-driven:** a real stage-by-stage status feed would need new backend surface (polling or SSE) that isn't in the current architecture — unjustified complexity for a pilot at this scale. Simulated timing, calibrated from real logged durations, gives the same reassurance to the user with zero backend changes.

### 7.3 Quality-Gate Rejection State

Inline banner on the same upload screen (no navigation to a separate screen), with a specific tip per error code rather than the raw backend message:

| Error code | Copy |
|---|---|
| `QUALITY_GATE_BLUR` | "This photo is too blurry to analyze. Hold the camera steady and try again." |
| `QUALITY_GATE_BRIGHTNESS` | "This photo is too dark to analyze. Try moving to a brighter spot and retake it." |
| `QUALITY_GATE_RESOLUTION` | "This photo doesn't have enough detail to analyze. Move a little closer and retake it." |

A **Retake** button re-opens the native picker immediately.

### 7.4 Diagnostic Overlay (Phase 2)

Default view: all four annotation types shown at once, at **low visual weight** (subtle lines/boxes, not heavy markup) alongside the text criterion breakdown. Selecting a criterion in the text breakdown highlights just that annotation type on the image and dims the others.

> **Why composite-by-default with drill-in, not one-at-a-time or all-at-once-heavy:** a parent or teacher genuinely wants the full picture in one glance, but four overlapping annotation types at full visual weight on one worksheet photo risks looking like the paper is covered in red flags — exactly the alarm signal the whole band-color system (§2.1) is designed to avoid. The drill-in interaction itself is frontend-only state (the coordinates already live on the Measurement record per ARCHITECTURE §7) — no backend cost.

### 7.5 Composite Score Display

A **horizontal band-position indicator**: a bar spanning the four bands (Needs Improvement → Developing → Satisfactory → Excellent) with a marker showing where the score falls, number displayed alongside — not a bare number, not a circular gauge.

> **Why position-on-a-range, not a gauge:** a gauge (common in fitness/health apps) frames the number as a target hit or missed. A position indicator frames it as "here's where the child is right now, and here's what's next" — consistent with the developmental, non-evaluative framing in §1.

### 7.6 Criterion Breakdown Panel

A vertical stacked list — one row per criterion (Letter Formation, Spacing, Slant, Baseline Alignment, Size Consistency), each showing a small band-position indicator (§7.5, scaled down) plus the one-line diagnostic note (§8.2). No accordion — the diagnostic note is the content parents and teachers are actually here to read, so it shouldn't require an extra tap to reveal.

### 7.7 Trend Charts

Recharts line charts with the **band zones shaded in the background** (each horizontal zone tinted with its band color from §2.1), so a viewer can gauge which band a point falls in by vertical position alone, without reading the axis. Legend pairs each shaded zone with its band name (accessibility, §10).

### 7.8 Class-Wide Dashboard Table

A standard sortable data table (student rows × criterion columns), matching the PRD's explicit "sortable by weakest criterion" requirement — not a card grid, which would lose the column-scan behavior that requirement depends on. Each score cell shows a small band-color indicator alongside the number, so scanning a sorted column for at-risk students is a fast visual scan, not a read-every-number exercise.

### 7.9 Manual Rubric Entry (Phase 1)

Five rows (one per criterion), each a **segmented button group** showing all rubric options as tappable buttons — no dropdown menu-opening step. Optimized for the actual repetitive task: one teacher, many submissions, five criteria each, done fast and precisely.

> **Why this screen gets its own optimization pass:** this input directly feeds the Spearman's Rho calibration study — the PRD's own top-flagged project risk. A segmented button group is faster than a dropdown (no menu-open step) and safer than a slider (no accidental drift), which matters more here than on almost any other screen in the product.

---

## 8. Content & Voice Guidelines

### 8.1 Language & Copy Register

English only — no i18n system (not in PRD/ARCHITECTURE scope, and full localization would be scope creep against the compressed timeline). Copy itself is written in **short, plain, jargon-free language** regardless — this covers the real comprehension gap for a Davao City parent audience without the engineering cost of a second-language system.

General writing rules:
- Active voice, plain verbs: "Add Student," not "Submit Student Record."
- Name things by what the person controls, not backend structure: "Upload a photo," not "Create submission."
- A button's label matches the confirmation it produces: "Submit" → "Submitted."
- Errors state what happened and how to fix it — never vague, never apologetic.

### 8.2 Diagnostic Note Voice

**Hybrid tone:** one clause states the objective measurement finding, a second short clause adds encouraging, next-step framing. Never uses judgment-coded language ("poor," "bad," "fails to"). This balances the teacher's need for diagnostic credibility with the parent's need for a non-alarming read.

Twenty template notes — five criteria × four bands:

**Letter Formation**
| Band | Note |
|---|---|
| Needs Improvement | Several letters aren't fully formed yet — tracing practice on individual letters usually helps build this up. |
| Developing | Letter shapes are taking form but still inconsistent — regular practice should smooth this out over the next few activities. |
| Satisfactory | Most letters are well-formed with only minor inconsistencies — steady practice will sharpen the remaining details. |
| Excellent | Letters are consistently well-formed across the page — a strong, reliable foundation. |

**Spacing**
| Band | Note |
|---|---|
| Needs Improvement | Spacing between letters and words varies a lot — practicing with spacing guides can help build a steadier rhythm. |
| Developing | Spacing is becoming more even but still uneven in places — continued practice should even this out. |
| Satisfactory | Spacing is mostly even and easy to read — small refinements will make it even more consistent. |
| Excellent | Spacing is even and consistent throughout — this makes the writing easy to read at a glance. |

**Slant**
| Band | Note |
|---|---|
| Needs Improvement | Letter slant varies noticeably across the page — slower, more deliberate strokes often help even this out. |
| Developing | Slant is becoming more consistent but still shifts in places — this typically steadies with more practice. |
| Satisfactory | Slant is mostly consistent with only slight variation — a good sign of developing pen control. |
| Excellent | Slant is consistent throughout the page — a clear sign of strong pen control. |

**Baseline Alignment**
| Band | Note |
|---|---|
| Needs Improvement | Letters drift above or below the line often — practicing on lined paper with a visible baseline can help. |
| Developing | Letters are staying closer to the baseline but still drift in places — this usually improves with continued practice. |
| Satisfactory | Letters mostly sit on the baseline with only occasional drift — a solid sign of control. |
| Excellent | Letters consistently sit on the baseline throughout — strong control of line placement. |

**Size Consistency**
| Band | Note |
|---|---|
| Needs Improvement | Letter sizes vary a lot across the page — practicing within guided size boxes can help even this out. |
| Developing | Letter sizes are becoming more even but still vary in places — this typically steadies with more practice. |
| Satisfactory | Letter sizes are mostly consistent with minor variation — small refinements will make this even steadier. |
| Excellent | Letter sizes are consistent throughout the page — a strong, steady hand. |

### 8.3 Empty States

Text + a small Lucide icon (reused from the shared icon system — no dedicated illustration work), each with a direct call-to-action. Treated as an invitation to act, not a dead end:

| Screen | Copy |
|---|---|
| Roster, no students | "No students yet. Add your first student to start creating activities." → **Add Student** |
| Activities, none created | "No activities yet. Create one to start collecting handwriting samples." → **Create Activity** |
| Submission history, none | "No submissions yet. Once a worksheet is uploaded, progress will show up here." |

---

## 9. Accessibility

- **Color is never the sole signal.** Every band indicator (badges, chart zones, overlay legend, table cells) always pairs its color with the band's text name — covers the largest real accessibility gap (color-blindness affects roughly 1 in 12 men) without needing a secondary pattern/texture system.
- **Visible keyboard focus** on all interactive elements (shadcn's defaults cover this; don't override away from it).
- **Reduced motion respected** — Framer Motion's scoped moments (§2.6) should honor `prefers-reduced-motion`.

---

## 10. Branding

**Wordmark:** simple icon + text lockup — a small custom SVG mark (a simple pen-stroke/flourish, not a full illustration) alongside "WriteWise" set in Poppins. Appears in the nav header and login screen. Modest effort (one reusable SVG asset), with value beyond the app itself — reusable on thesis defense slides, a poster, or the PRD/ARCHITECTURE docs.

---

## 11. Open Items / Revisit List

Consistent with ARCHITECTURE.md §17 — things this document deliberately left as assumptions worth checking as the build progresses:

- **Exact band hex values** (§2.1) are a starting point, not final — worth a quick visual check once real worksheet photos/overlays are on screen, to confirm the gradient stays legible and non-alarming in context, not just in isolation.
- **Simulated loading timing** (§7.2) needs calibration against real per-stage logging data once Phase 1 is live — revisit the interval values once actual processing-time data exists.
- **Diagnostic note templates** (§8.2) are a first draft — worth a quick read-through with a participating teacher before Phase 2 ships, since they're reading these professionally and may catch tone issues a non-teacher wouldn't.
- **Dark mode** (§3) is structurally supported but not designed — revisit only if a real need surfaces post-pilot.

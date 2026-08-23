---
name: WriteWise
description: Cursive Handwriting Assessment and Progress Monitoring System
colors:
  primary: "#1b6b63"
  primary-hover: "#145049"
  secondary: "#e4f1ef"
  secondary-foreground: "#145049"
  neutral-bg: "#f7f8f7"
  neutral-surface: "#ffffff"
  neutral-border: "#e3e6e4"
  neutral-text: "#1e2422"
  neutral-muted-text: "#5b6663"
  band-1: "#b6754a"
  band-2: "#c9a227"
  band-3: "#7c9b6e"
  band-4: "#4a8b5c"
  destructive: "#9c4a2f"
typography:
  display:
    fontFamily: "Poppins, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3rem)"
    fontWeight: 600
    lineHeight: 1.15
  headline:
    fontFamily: "Poppins, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
  title:
    fontFamily: "Poppins, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.35
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "0.02em"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  xl: "12px"
  2xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
  2xl: "48px"
  3xl: "64px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral-surface}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.lg}"
    padding: "8px 16px"
    height: "36px"
  card:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.xl}"
    padding: "24px"
  input:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.neutral-text}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
    height: "36px"
  chip-band-1:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.band-1}"
    rounded: "{rounded.full}"
    padding: "2px 8px"
---

# Design System: WriteWise

## Overview

**Creative North Star: "The Warm Educational Studio"**

WriteWise is an objective, AI-driven cursive handwriting diagnostic tool bridging teachers and parents. The visual system resolves a core tension: precision where it builds scientific trust with educators, and warmth where it prevents anxiety for young learners and their families.

Surfaces are calibrated between data density and human reassurance. Analytical views (roster metrics, measurement tables, raw coordinates) adopt clean, flat geometry with sharp borders, while diagnostic feedback panels, assessment cards, and interactive controls use softly curved forms with gentle ambient warmth. The tone is developmental and non-evaluative—celebrating progress rather than applying punitive grading.

**Key Characteristics:**
- **Developmental Non-Evaluative Framing:** Four-tier growth spectrum (Needs Improvement, Developing, Satisfactory, Excellent) using warm terracotta, gold, sage, and forest green—completely replacing alarm-coded red traffic lights.
- **Split-Form Precision:** Crisp, flat borders on data-dense data tables paired with rounded (8–12px), soft-shadowed surfaces on interactive and feedback elements.
- **Context-First Dual Modality:** Mobile-optimized camera capture workflows for quick classroom/home submissions paired with desktop-first analytical dashboards for longitudinal tracking.
- **Explainable Diagnostic Clarity:** Low-opacity, non-punitive handwriting overlays with criterion-specific focus toggles.

## Colors

The palette pairs a grounded, deep pine-teal primary accent with a calm warm-gray canvas and an intentional, non-punitive 4-band developmental diagnostic progression.

### Primary
- **Deep Pine Teal** (`#1b6b63`): Primary action triggers, active navigation highlights, selected states, and brand emphasis.
- **Deep Teal Shade** (`#145049`): Hover and pressed states for primary buttons and high-contrast text on soft teal surfaces.
- **Soft Pine Wash** (`#e4f1ef`): Subtle card highlights, secondary pill fills, avatar backgrounds, and badge surfaces.

### Secondary
- **Muted Sage** (`#7c9b6e`): Secondary milestone indicators, progress bar increments, and satisfactory developmental signals.

### Neutral
- **Crisp Page Canvas** (`#f7f8f7`): High-comfort background canvas balancing optical brightness with eye comfort during prolonged review.
- **Pure Surface White** (`#ffffff`): Elevated cards, sheet panels, popover menus, and table row containers.
- **Slate Boundary Border** (`#e3e6e4`): Structural dividers, input strokes, gridlines, and card container rings.
- **Deep Charcoal Slate** (`#1e2422`): High-contrast primary headings, body copy, and dense score tabular numerals.
- **Muted Slate Gray** (`#5b6663`): Secondary labels, caption copy, timestamps, and placeholder copy.

### Diagnostic Bands
- **Band 1 (Needs Improvement - Clay/Terracotta)** (`#b6754a`): Signals foundational letter-tracing stage without panic or failure connotations.
- **Band 2 (Developing - Ochre Gold)** (`#c9a227`): Reflects active progress and developing stroke rhythm.
- **Band 3 (Satisfactory - Muted Sage)** (`#7c9b6e`): Confirms on-track letter execution and steady baseline control.
- **Band 4 (Excellent - Forest Green)** (`#4a8b5c`): Celebrates consistent slant, spacing, and master letter formation.

### System Alerts
- **Destructive Rust** (`#9c4a2f`): High-contrast (6:1+ ratio) critical system warnings, student removal actions, and upload rejection alerts.

### Named Rules
**The Never-Red-For-Students Rule.** Diagnostic score presentations, feedback notes, and handwriting annotations must never use standard alarm red (`#EF4444` / `#DC2626`). Student skill development is rendered exclusively through the 4-band warm terracotta-to-forest gradient. Standard destructive red is reserved strictly for system errors and irreversible administrative deletes.

**The Dual-Signal Accessibility Rule.** Color must never be the sole conveyor of diagnostic meaning. Every score badge, chart zone, overlay highlight, and tabular cell must pair its band color with explicit textual or numeric labels.

## Typography

The type system pairs a rounded, geometric heading face with a clean, tabular-capable body sans to balance pedagogical approachability with analytical rigor.

**Display Font:** Poppins (geometric sans-serif with rounded terminals, Google Fonts)  
**Body Font:** Inter (clean neo-grotesque with tabular numeric figures, Google Fonts)  
**Cursive Font:** Cedarville Cursive (fluid handwriting accent font, Google Fonts)

**Character:** Friendly and clear. Poppins provides a welcoming, classroom-friendly presence in headings, while Inter delivers crisp legibility in multi-column tables and diagnostic measurement values.

### Hierarchy
- **Display** (Poppins SemiBold 600, `clamp(2rem, 5vw, 3rem)`, line-height `1.15`): Hero promotional headings, landing milestones, auth welcome headers.
- **Headline** (Poppins SemiBold 600, `1.5rem` / 24px, line-height `1.25`): Major section titles, dashboard page headers, class roster titles.
- **Title** (Poppins Medium 500, `1.125rem` / 18px, line-height `1.35`): Card titles, dialog headers, criterion breakdown group titles.
- **Body** (Inter Regular 400, `0.875rem` / 14px, line-height `1.5`): Diagnostic text feedback, general paragraphs, student details, rubric criteria descriptions.
- **Label / Data** (Inter Medium 500, `0.75rem` / 12px, line-height `1.4`, letter-spacing `0.02em`): Table column headers, badge text, chart ticks, measurement coordinate figures.

### Named Rules
**The Tabular Precision Rule.** All quantitative measurements (angles, pixel baseline offsets, letter consistency percentages, dates) must render in Inter with tabular numeric alignments (`font-sans tabular-nums`) to maintain visual vertical alignment in tables and cards.

**The Heading Restraint Rule.** Poppins is strictly reserved for titles and section headings. It must never be applied to long-form body feedback or multi-row table cells.

## Layout

WriteWise enforces a responsive dual-modality layout strategy:
- **Mobile-First Worksheets:** Camera submission, worksheet photo review, and quick quality-gate confirmation are optimized for touchscreens (360px–640px viewport widths).
- **Desktop-First Analytics:** Multi-column class rosters, student longitudinal trends, and multi-criterion side-by-side diagnostic overlays are structured for desktop workspaces (1024px–1440px).

**Grid & Spacing Rhythm:**
- Base grid unit: `4px` (`space-1`).
- Common spacing steps: `4px`, `8px`, `12px`, `16px`, `24px`, `32px`, `48px`, `64px`.
- Standard desktop shell: 240px persistent collapsible sidebar with a fluid main container (`max-w-7xl` centered).
- Mobile touch targets: Minimum interactive element height of 40px (`h-10`) on viewports under 768px, transitioning to compact 36px (`h-9`) on desktop viewports.

## Elevation & Depth

Surfaces emphasize structural clarity through subtle 1px border strokes (`#e3e6e4`) and soft, warm ambient drop shadows that avoid stark dark halos.

### Shadow Vocabulary
- **Warm Subtle** (`box-shadow: 0 2px 10px rgba(30, 40, 35, 0.04)`): Interactive buttons on hover, floating badge chips, dropdown menu surfaces.
- **Warm Medium** (`box-shadow: 0 4px 20px rgba(30, 40, 35, 0.06)`): Elevated cards, diagnostic report panels, popovers, sheet sidebars.
- **Warm Deep** (`box-shadow: 0 12px 36px rgba(30, 40, 35, 0.12)`): Modal dialogs, submission preview overlays, confirmation prompts.

### Named Rules
**The Precision vs Warmth Elevation Rule.** Data tables, raw measurement feeds, and system logs remain strictly flat with 1px border lines and zero shadow. Cards, feedback containers, and floating control bars employ `shadow-warm` to invite human touch.

## Shapes

Form geometry communicates interaction depth and intent:
- **Data-Dense Geometry (0–4px radius):** Table cells, spreadsheet grids, raw measurement tags.
- **Interactive Controls (8px radius / `rounded-lg`):** Standard primary/secondary buttons, input fields, selects, segmented rubric pills.
- **Content Cards & Panels (12px radius / `rounded-xl`):** Assessment summary cards, student detail cards, diagnostic note panels.
- **Overlays & Dialogs (16px radius / `rounded-2xl`):** Confirmation dialogs, modal sheets, file upload dropzones.
- **Pills & Badges (`rounded-full` / 9999px):** Diagnostic band badges, status badges, avatar badges.

## Components

### Buttons
- **Shape:** 8px radius (`rounded-lg`), height 36px (`h-9`) on desktop, 40px (`h-10`) on mobile.
- **Primary Button:** Background `#1b6b63`, text `#ffffff`, hover `#145049`. Transition `all 150ms ease-out`.
- **Secondary Button:** Background `#e4f1ef`, text `#145049`, hover `rgba(20, 80, 73, 0.1)`.
- **Outline Button:** Border 1px `#e3e6e4`, background `#ffffff`, hover `#e4f1ef`.
- **Destructive Button:** Background `rgba(156, 74, 47, 0.1)`, text `#9c4a2f`, hover `rgba(156, 74, 47, 0.2)`.

### Chips & Badges
- **Shape:** Fully rounded (`rounded-full`), height 22px–26px, padding `2px 10px`, text `0.75rem` font-medium.
- **Band Badges:** Colored pill background (15% opacity tint of band color) paired with solid band foreground text and a 6px circular dot indicator.

### Cards / Containers
- **Corner Style:** 12px radius (`rounded-xl`), border 1px `#e3e6e4`, background `#ffffff`.
- **Shadow:** `shadow-warm` (`0 4px 20px rgba(30,40,35,0.06)`).
- **Internal Padding:** `24px` (`p-6`) on desktop, `16px` (`p-4`) on mobile.

### Inputs / Fields
- **Style:** Background `#ffffff`, border 1px `#e3e6e4`, radius 8px (`rounded-lg`), height 36px (`h-9`).
- **Focus:** Border `#1b6b63`, ring `3px rgba(27, 107, 99, 0.2)`.
- **Invalid:** Border `#9c4a2f`, ring `3px rgba(156, 74, 47, 0.2)`.

### Navigation
- **Desktop Sidebar:** 240px fixed width, background `#f7f8f7`, right border 1px `#e3e6e4`. Active nav links: background `#e4f1ef`, text `#145049`, font-medium with a 3px active indicator bar.
- **Mobile Header & Drawer:** 56px sticky top bar, slide-out drawer with auto-dismiss on link navigation.

### Diagnostic Overlay & Cursive Guidelines (Signature Components)
- **Handwriting Overlay:** Low visual weight (1.5px stroke, 60% opacity) geometric bounding lines for slant, spacing, baseline drift, and letter formation. Tapping a criterion highlights its specific lines while dimming others.
- **Cursive Guidelines Background:** Decorative 3-line penmanship guide (headline, dotted midline, baseline) in soft pine wash `#e4f1ef` to anchor cursive typography.

## Do's and Don'ts

### Do:
- **Do** pair every diagnostic band color with its full text name (e.g. `Developing` next to Ochre Gold).
- **Do** maintain a minimum 40px touch target on mobile viewports for all buttons and inputs.
- **Do** frame all feedback notes in constructive, two-part sentences: objective observation + encouraging next step.
- **Do** use tabular figures (`font-sans tabular-nums`) for all score tables and statistical metrics.
- **Do** keep data tables flat with crisp 1px borders, reserving shadows for cards and modals.

### Don't:
- **Don't** use standard red (`#EF4444`) on student scores, progress charts, or handwriting feedback.
- **Don't** use Poppins for body copy, diagnostic descriptions, or table rows.
- **Don't** clutter handwriting photos with heavy, opaque annotations that obscure the original handwriting.
- **Don't** invent random spacing values outside the 4px scale steps.
- **Don't** build custom camera viewports when native mobile capture inputs are more reliable.

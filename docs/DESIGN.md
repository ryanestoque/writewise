# WriteWise — DESIGN.md

## Phase 3 Slice 6 - private submission conversations

Each actual upload has its own thread. Teacher submission viewers and parent worksheet/pending viewers share Details/Comments tabs. Processing, rejected, draft, released and returned attempts retain separate conversations. Activity/gradebook shortcuts use an explicit upload picker, initially the counted upload or newest upload; an open selection stays fixed across uploads/pin changes. Older attempts remain selectable. No-upload work says "Comments are available after a worksheet is uploaded." Point grades alone never create threads.

Retained activity/selected-child history lists sources separately with upload timestamps. Per-source unread indicators appear in picker/history/view tabs; gradebook cells aggregate across all attempts for the student/activity. Details alone never acknowledges messages. The shared Message/Bubble/Marker/Scroller view renders escaped text, chronological entries, Load older/Jump to latest, exact-source Return markers and author tombstones. Author deletion is confirmed inline. Teacher lock/unlock affects only this source. Show all assignment/archive/lock reasons while retaining readable history and authorized author deletion.

The composer says "Visible to the teacher and all linked parents immediately, even before results are released." It counts 1-1000 trimmed Unicode code points, preserves line breaks, bounds textarea height and disables pending writes without retry. Closing/changing account, child or upload clears drafts. Label controls, support keyboard dismissal/opener focus, and show safe errors. Successful source deletion cancels reads and clears private bodies only for returned deleted IDs; denied/failed deletes retain comments. Every source-deletion confirmation names permanent comment removal.

Teacher destinations: /activities/{activity}/submissions/{submission}?view=comments. Parent destinations: /progress?child={student}&activity={activity}&submission={submission}&view=comments. Duplicate/invalid/conflicting parameters and old pair-only links never guess an upload. Derived child/activity must match before body rendering/acknowledgment. Historical-owner comment access does not broaden worksheet access. Existing tab=grades behavior and sibling selection remain. Bell navigation alone never marks read: exact alerted source/version must be loaded, with single/all-read guards. [Approved design and acceptance matrix](superpowers/specs/2026-11-10-submission-private-comments-design.md).

## Phase 3 Slice 5 — gradebook surfaces

Teacher navigation includes Gradebook. Choose a section, search students and filter current/archived activities; those display filters never recalculate totals or narrow the CSV. The grid alone scrolls horizontally on a phone, with student labels retained. Cells expose student/activity context to assistive technology and support arrow-key movement. Show coursework status, automatic/final points, override state and publication separately from the handwriting assessment band. Totals explicitly include drafts for teachers.

Opening a cell shows its reviewed revision, override/clear/Assign 0, excuse/unexcuse and release controls, plus existing deadline, counted-attempt and Return controls. Work details load only while open. Saved grade changes require another review/release; a revision conflict refreshes data and asks the teacher to reopen and review, without automatically releasing a newer revision. Bulk confirmation names selected/currently eligible counts and authoritative changed/skipped results. Activity-wide release explicitly names its cross-section scope. Removing points uses a confirmation explaining cleared overrides and withdrawn point grades.

Parent Progress includes Grades, grouped by teacher with released-only totals. Pending point grades say “Not yet released” and retain their public maximum; no hidden value, synthetic zero or Draft badge appears. Bands-only work keeps its released handwriting assessment. Excused work is labelled and excluded. No-upload/points-only result notices open Grades; an unavailable target offers a return to Grades. Clearing a notification destination preserves the selected sibling. Inactive accounts suppress rendered grades/dialogs as well as clearing caches. Existing Latest Feedback, Practice, progress trends and upload permissions are retained.

**A Computer Vision and CNN-Based Diagnostic Cursive Handwriting Assessment and Progress Monitoring System**

- **Document type:** Internal design guide (companion to PRD.md, ARCHITECTURE.md, CV_PIPELINE.md, ML_PIPELINE.md, DATABASE.md, API_SPEC.md, TECH_STACK.md, SECURITY.md, TESTING.md, DEPLOYMENT.md)
- **Design Tokens & Theme Tokens Source:** see [DESIGN.md (root)](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/DESIGN.md) for the active YAML tokens, CSS variables, and Impeccable specifications.
- **Team:** Ryan Christopher B. Estoque, John Lawrence V. Monleon, James David B. Asoy, Saara Eliana G. Ibag
- **Status:** Draft v1 — reflects decisions locked as of this document's creation. Update this file whenever a UX, flow, screen, or copy decision changes; it is the single source of truth for **product UX, screen inventory, interaction patterns, and copy**, while [DESIGN.md (root)](../DESIGN.md) is the single source of truth for **visual tokens and component styling**.
- **Secondary use:** this document is written to be readable both as a build spec (concrete tokens/values a developer implements directly) and as source material for an AI UI-generation prompt (Figma AI / Google Stitch), if one is drafted later from it.

---

## Browser tab titles

Page titles use `Page Name | WriteWise`, with the suffix supplied by the root Next.js metadata template. Server pages export their page name as metadata; client pages use a server layout for metadata. Nested activity and submission routes declare their own titles so they do not inherit the activity list title.

The homepage retains `WriteWise | Cursive practice, turned into next steps` as an absolute title. Submission assessment retains its contextual student-and-prompt title once data loads, with `Submission Assessment | WriteWise` as the fallback.

Validation: ESLint, TypeScript (after regenerating Next.js route types), and backend Ruff pass. Local HTTP checks confirmed rendered titles for the homepage, sign in, sign up, password reset, invitation acceptance, privacy policy, and terms. Authenticated portal navigation and contextual submission titles still need browser QA; the available browser session was locked.

## 1. Design Principles

WriteWise sits between two audiences with genuinely different needs from the same screens: **teachers** need to trust it as a credible diagnostic instrument, and **parents** need it to feel supportive rather than alarming about their own child's developing skill. Almost every design decision in this document resolves that same tension — precision where it builds trust, warmth where it prevents anxiety — rather than picking one tone and applying it everywhere.

Three principles run through the whole system:

1. **Diagnostic, not evaluative.** This is a developmental tool tracking a skill in progress, not a pass/fail grade. Color, layout, and copy consistently avoid alarm-coded signals (no red, no "failing" language) in favor of a growth framing.
2. **Precision where it counts, warmth where it helps.** Data-dense surfaces (score tables, roster views, raw numbers) stay sharp-edged and flat. Human-facing surfaces (feedback panels, cards, buttons) get rounded corners and soft shadows. This split is a repeating pattern across shape, elevation, and even color — not a one-off choice.
3. **Two devices, two jobs.** Photo capture happens on a phone, in a classroom or at home. Review and analysis happens at a desk. The system is designed context-first, not as one generic responsive layout stretched across both.

---

## 2. Design Tokens

> **Single source of truth for visual tokens:** All active color hex values, typography scale, spacing steps, radii, shadows, and iconography rules live in [DESIGN.md (root)](../DESIGN.md) (paired with `.impeccable/design.json` and implemented in `frontend/app/globals.css`). Do not duplicate token tables here.

### 2.1–2.5 Visual System Rationale

- **Color System (§2.1 — see root `DESIGN.md` > Colors):** Brand accent is deep pine-teal, kept deliberately far from the 4-band warm developmental gradient (`Needs Improvement → Developing → Satisfactory → Excellent`) so interactive controls are never mistaken for diagnostic signals. Traffic-light red is never used on student scores because this tool assesses a developing skill, not pass/fail. **Color is never the only signal** — every band indicator pairs color with its text label (see §9, Accessibility). High-contrast `--destructive` (`#9C4A2F` light / `#E69875` dark, >6:1 WCAG AA) is reserved strictly for system errors and irreversible deletes.
- **Typography (§2.2 — see root `DESIGN.md` > Typography):** Poppins for headings, Inter with `tabular-nums` for body copy and dense data/scores, and Learning Curve for cursive specimens and penmanship accents.
- **Spacing Scale (§2.3 — see root `DESIGN.md` > Layout):** Constrained 4px-based Tailwind subset so 4 developers building screens in parallel keep consistent rhythm.
- **Shape & Elevation (§2.4 — see root `DESIGN.md` > Elevation & Depth, Shapes):** Sharp, flat surfaces (`0–4px` radius, 1px border, no shadow) on data tables signal precision; rounded, soft-shadowed surfaces (`12–16px` radius, `shadow-warm`) on cards, feedback panels, and dialogs signal warmth.
- **Iconography (§2.5 — see root `DESIGN.md` > Iconography & Visual Semantics):** Lucide outline icons paired with grounded domain semantics (no generic AI sparkle/magic icons, and no decorative icons on non-interactable headers, pill badges, or stat cards).

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

**Full-Width Portal Canvas (No Maximum-Width Caps):** Both the Teacher Portal and Parent Portal use the full available viewport width (`w-full min-w-0`) with consistent horizontal page gutters (`px-4 sm:px-6`). Never apply centered maximum-width constraints (`max-w-7xl`, `max-w-5xl`, `max-w-4xl`, `container`, etc.) to layout shells or individual page containers. Every route must occupy the same edge-to-edge fluid canvas without width jumps between pages.

**Touch Target Standard (WCAG 2.5.5 / 2.5.8):** All interactive controls (buttons, form inputs, dialog triggers/actions, and sidebar nav links) must maintain a minimum touch target height of 40px (`h-10`) on mobile viewports (<640px/768px), scaling to desktop `h-9` (`h-10 sm:h-9` or `h-10 md:h-9`).

---

## 5. Navigation & Information Architecture

Role-differentiated, matching how much "surface area" each role actually manages:

- **Teacher:** persistent left sidebar (desktop) structured into two functional groups:
  - **Classroom Navigation:** Dashboard (`/dashboard`), Class Roster (`/roster`), Activities (`/activities`), Gradebook (`/gradebook`). Classroom and reference groups share a named `Teacher navigation` landmark.
  - **Reference Guides:** Triggers for the interactive Cursive Guide and Scoring Rubric dialogs. Scoring Rubric uses a scales icon to remain distinct from Gradebook's book icon in collapsed mode.
  - **Collapsed Desktop Mode:** Icon-only navigation with rich Base UI tooltips, preserving the teacher's identity indicator via an initials avatar (`getInitials`) that reveals full name and email on hover/focus. The existing `sidebar_state` cookie restores the expanded/collapsed preference on reload; missing or invalid values default to expanded.
  - **Mobile Drawer:** Sheet drawer auto-dismisses (`setOpenMobile(false)`) immediately upon link navigation to prevent background trapping. The header toggle, drawer close button, upload button, navigation/reference rows, and account-menu actions retain at least 40px targets below the 768px desktop breakpoint.
  - **Sidebar Toggle:** The header toggle and desktop rail expose expanded state and identify the controlled sidebar. The header toggle's label and tooltip describe the current action: Open/Close navigation on mobile and Expand/Collapse sidebar on desktop.
  - **Keyboard Shortcuts:** A visible account-menu entry opens the shortcut guide. Sidebar, header, and guide hints consistently display Ctrl/Alt on Windows and Command/Option on macOS. Inline upload and reference shortcut badges appear only at desktop widths; the expanded upload label stays on one line alongside its compact badge.
  - **Sign-out Recovery:** Failed sign-out keeps the confirmation open and re-enables its action for retry. The notification uses plain language with connection/retry guidance and never displays raw authentication error messages.
  - **Subroute Matching:** Prefix-aware active state highlighting (`pathname === href || pathname.startsWith(href + '/')`) to maintain parent tab highlighting on nested detail pages (e.g. `/roster/[id]`).
  - **Constrained-height navigation:** The collapsed desktop rail preserves vertical scrolling so reference actions remain reachable in short windows. Settings marks the account trigger active and its menu link as the current page.
  - **Upload setup guidance:** The upload details step distinguishes loading, failed reads, missing activities, missing roster students, unassigned students, and unmatched searches. Missing setup includes a destination to Activities, Class Roster, or the selected activity's assignments; navigation closes the upload dialog first.
  - **Student Avatar Simplification:** Student initials avatars have been removed across student views (roster, class table, drill-down, submission cards) to prioritize clear typography, responsive scannability, and reduce visual noise. Teacher profile avatar is preserved.
- **Parent:** lightweight top nav, mobile-first — the parent's world is effectively one screen (their child's progress) plus an upload action, so a full sidebar would be wasted structure.
- **Multi-child parents:** on tablet/desktop (`>= sm`), the child selector sits centered in the top parent nav (a plain text pill for a single child; a dropdown switcher when multiple children are linked). On phones (`< sm`), the active child's name and section anchor the page header while multi-child parents get a one-handed radio-pill switcher directly above the header.

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

**Parent progress hierarchy:** Desktop uses the full viewport width with normal page gutters; do not introduce a centered maximum-width container. The `/progress` view is organized into a segmented 4-tab layout (`Latest Feedback`, `Practice`, `Progress`, and `Grades`) so parents focus on one task at a time:
- **`Latest Feedback` (default once scored worksheets exist, or when no take-home practice is assigned):** Pairs the latest worksheet photo with coaching (photo-first on phones, side-by-side on desktop), then shows its five-skill breakdown (`LatestSubmissionCard`) with compact band-position indicators and diagnostic notes.
- **`Practice` (default on zero-result onboarding when open take-home worksheets exist; shows a live badge count of open worksheets):** Displays assigned take-home practice worksheets (`TakeHomeActivities`) in a responsive 1/2/3-column grid alongside the current practice-focus tip and teacher comment threads.
- **`Progress`:** Gives full width to longitudinal skill trends (`CriterionTrendChart`) and the sortable archive of past worksheets (`PastWorksheetsSection`).
- **`Grades`:** Pairs released coursework totals (`ParentGrades`) with teacher comment threads (`ParentActivityThreads`), expanding coursework to full width when no comment threads exist.

On all viewports, an urgent-task prompt precedes the tab bar when an open worksheet needs a replacement photo, is overdue but still accepts uploads, or is due within 48 hours. It names the worksheet and opens its existing upload dialog directly (and links to the `Practice` tab when multiple worksheets need attention). Replacement photos take priority, then overdue work, then the nearest upcoming deadline. Processing uploads and closed assignments never receive this upload prompt.

The overview leads with a practical home tip and an available strength, followed by the latest assessment band and optional numeric details. Lower scores use an explicit comparison with the first worksheet; score differences are percentage points. Supporting worksheet and chart surfaces use quieter borders without competing shadows. Submitted work remains distinct from closed work that still needs a photo: the latter is called out even when the submitted/closed list is collapsed, and must never produce an “all turned in” message. The zero-result screen keeps take-home activities and the sample report; the one-result screen explains when the chart becomes available.

Read failures must never appear as an unlinked child or an empty assessment history. Show a retry action, retain previously loaded records with a refresh warning, and reserve onboarding for successfully loaded empty history. Invalid or unavailable notification destinations offer a return to progress without clearing an accessible child profile. Each skill in the latest worksheet shows its diagnostic sentence directly; the photo dialog provides supporting visual evidence. Band explanations describe the worksheet and do not imply grade-level attainment. Overview and chart comparisons use the first counted worksheet; history changes use the previous counted worksheet. Changes of at least 1.5 percentage points in either direction receive a directional label, while smaller changes are described as steady, including when numeric details are shown.

On desktop, the latest worksheet photo sits beside the prompt and coaching. On phones, the photo comes first. "View worksheet" opens Details and Comments for that upload. Below it, five skill rows show ratings and diagnostic notes and open the corresponding worksheet overlay. The percentage switch sits beside the skills and progress chart, "How scores work" accompanies the ratings, and the cursive guide lives in Practice. Keep the actionable Practice count; the Progress tab has no count badge. Dates, deadlines, returned-work notes, and upload actions remain visible where needed.

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
| `QUALITY_GATE_BRIGHTNESS` | Tailor to dark versus bright-with-insufficient-detail using error details: "Retake in even, indirect light without glare." A bright readable white page is permitted. |
| `QUALITY_GATE_CONTRAST` | "This photo looks washed out. Try adjusting the lighting or angle and retake it." |
| `QUALITY_GATE_RESOLUTION` | "This photo doesn't have enough detail to analyze. Move a little closer and retake it." |

Capture tips must preserve the original worksheet. Adjust lighting, focus, and framing; do not ask the student to retrace or darken existing writing to pass a photo-quality check. A contrast rejection describes visibility in this photo, not a judgment about the student's handwriting.

A **Retake** button re-opens the native picker immediately.

### 7.4 Diagnostic Overlay (Phase 2)

Five annotation types, one per criterion — baseline drift line, spacing highlight, size highlight, slant indicator, and a subtle per-word highlight/underline for letter formation (visually distinct from the other four's geometric lines/boxes, since it's not marking a specific measured distance/angle but flagging *which words* the CNN scored weakest, per ML_PIPELINE.md §6.1's per-word output). Default view: all five shown at once, at **low visual weight** (subtle lines/boxes, not heavy markup) alongside the text criterion breakdown. Selecting a criterion in the text breakdown highlights just that annotation type on the image and dims the others.

> **Why composite-by-default with drill-in, not one-at-a-time or all-at-once-heavy:** a parent or teacher genuinely wants the full picture in one glance, but five overlapping annotation types at full visual weight on one worksheet photo risks looking like the paper is covered in red flags — exactly the alarm signal the whole band-color system (§2.1) is designed to avoid. The drill-in interaction itself is frontend-only state (the coordinates already live on the Measurement record per ARCHITECTURE §7) — no backend cost.

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

### 7.10 Submission Attempt Management & Deletion

Provides safe, role-scoped removal of mistaken, illegible, or duplicate submissions:

- **Teacher portal:** From the submission detail modal/page, an accessible **"Delete Attempt"** button opens a high-contrast confirmation `AlertDialog` using the `--destructive` token (§2.1). Confirming permanently removes the attempt, raw CV measurements, rubric scores, and stored photo, invalidating dashboard queries and returning to the activity or student view.
- **Parent portal:** For take-home activities, parents who uploaded a worksheet photo can select **"Delete Upload"** from the assignment view or worksheet dialog *only while the submission is un-graded* (`canDelete = true`). This allows retaking an accidental or blurry upload before the teacher reviews it. Once graded, deletion is disabled/hidden to preserve evaluated school records.
- **Confirmation dialog:** Uses clear, unambiguous copy stating that deletion is permanent and cannot be undone, avoiding vague warning language (§8.1).

### 7.11 Unified Scoring Rubric Reference

A shared interactive modal (`frontend/components/rubric-reference-dialog.tsx`) accessible from both the teacher sidebar and parent portal navigation. Outlines the 5 diagnostic penmanship criteria (Letter Formation, Line Straightness, Word Spacing, Letter Slant, Size Proportion) and their corresponding developmental rubric bands (Needs Attention, Developing, Competent, Exemplary) with concrete descriptors. Unifying this reference eliminates duplicate modal implementations between teacher and parent experiences.

### 7.12 Animated Cursive Stroke Canvas

An interactive HTML5 canvas component (`frontend/components/cursive-stroke-canvas.tsx`) that renders stroke-by-stroke handwriting animations across uppercase and lowercase cursive characters. Demonstrates proper pen movement, ascender/descender trajectory, and connective ligature flow according to standard handwriting motion mechanics, providing visual pedagogical context.

### 7.13 Minimalist Dialog & Header Hierarchy

In accordance with visual hierarchy polish:
- **Card and Dialog Headers:** Decorative icon badges and redundant subheadings have been removed from header bars to create clean, high-density modal surfaces.
- **Activity Filter Controls:** Horizontal filter pills (`FilterPills`) support smooth edge gradients, horizontal scrolling on narrow viewports, and clean active/archived state toggles.

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

Built using the Base UI / shadcn `Empty` primitive pattern: `EmptyMedia` (Lucide icon enclosed in a `bg-brand-100 text-brand-700` badge) + `EmptyTitle` + `EmptyDescription` + `EmptyContent` with a direct call-to-action button. Treated as an invitation to act, not a dead end:

| Screen | Copy | CTA |
|---|---|---|
| Roster, no students | "No students yet. Add your first student to start creating activities and tracking handwriting progress." | **Add Student** (`Users` icon) |
| Activities, none created | "No activities yet. Create one to start collecting handwriting samples." | **Create Activity** (`ClipboardList` icon) |
| Submission history, none | "No submissions yet. Once a worksheet is uploaded, progress will show up here." | |

### 8.4 Self-Service Signup Flow

A unified `/signup` view sharing the atmospheric handwriting background (`HandwritingGuidelineBackground`) and warm card layout of `/login`:

- **Role Selection:** A high-contrast two-segment pill toggle (`Teacher | Parent`), defaulting to Teacher. Each state provides immediate context:
  - *Teacher:* "Manage your class roster and assess cursive handwriting."
  - *Parent:* "Your child's teacher will link your account to their student records."
- **Input Fields:**
  - *Full Name:* Required string input.
  - *Email address:* Validated email with duplicate account obfuscation.
  - *Password:* Minimum 10 characters with live validity indicator (`CheckIcon` + emerald token).
  - *Confirm Password:* Real-time matching feedback ("Passwords match" / "Does not match").
- **Verification & Confirmation State (In-Card):**
  - Success message: "Check your email — We sent a confirmation link to [email]."
  - Explanatory note: "Please click the link in your email to verify your account. Once verified, you can sign in to WriteWise."
  - Resend CTA: Cooldown timer button (60s countdown) with rate-limit protection.
  - Escape hatch: "Entered the wrong email? Use a different email."
- **Navigation Links:** Card footer links directly to `/login` ("Already have an account? Sign in").

---

### 8.5 Public Landing Page

The public `/` route introduces cursive assessment to teachers and parents before account creation. Signed-in teachers continue to `/dashboard`; signed-in parents continue to `/progress`. The middleware permits the exact home path without making other routes public.

- **Hero ("The Interactive Assessment Studio"):** Two-column asymmetric split pairing the headline ("Classroom to home, stroke by stroke." in Poppins with a Learning Curve accent), concise product summary, primary Teacher/Parent CTAs, and capability highlights on the left with the live interactive `AssessmentPreview` studio card on the right. Visitors can immediately toggle assessment marks and guide lines or select any of the five criteria via keyboard-accessible radio pills (`RadioGroup`) to inspect geometric handwriting overlays and read two-part coaching feedback ("What we see" and "Practice next").
- **Workflow ("How it works"):** Three structured cards with custom schematic illustrations (`UploadArt`, `AssessArt`, `ProgressArt`) walking through the classroom loop: photographing the paper worksheet with built-in quality checks, reviewing five-part coaching, and tracking longitudinal growth.
- **Five Criteria & Developmental Bands:** A visible showcase section (`CriteriaDetails`) featuring the four-tier non-punitive developmental spectrum (`Needs Improvement`, `Developing`, `Satisfactory`, `Excellent`) followed by a five-row illustrated specimen ledger (`FormationSpecimen`, `SizeSpecimen`, `SpacingSpecimen`, `SlantSpecimen`, `BaselineSpecimen`) with plain-language descriptions and sample coaching tips.
- **Longitudinal Progress (`GrowthStrip`):** Interactive three-week comparison card (Week 1, Week 4, Week 8 of *"kites fly high"*) connected by a visual progress thread. Keyboard-operable tabs (arrow keys, Home/End) update the coaching note; mobile viewports provide side-by-side starting vs. selected week specimens.
- **Role Signup & Privacy Trust Strip:** Closing pine-teal section with dedicated Teacher (`/signup`) and Parent (`/signup?role=parent`) cards, followed by a three-pillar privacy and safety strip (students stay on paper with no student logins, automatic GPS/device EXIF stripping on upload, and strict role-scoped access).
- **Claims:** No testimonials, outcome statistics, accuracy figures, or institutional endorsements. The page describes automatic assessment and teachers reviewing results to guide practice (product owner confirmed the current mode on 2026-10-27). Copy describes measurement, developmental bands, quality checks, metadata removal, linked teacher/parent portal visibility, and authorized research-team access.
- **Navigation:** Header links to How it works and See an assessment remain available at every size, wrapping below 1024px. Anchors account for the sticky header. Sign in and signup stay visible; mobile signup reads "Sign up" with a 44px minimum height. Parent signup uses `/signup?role=parent`; teacher signup uses `/signup`; returning users use `/login`. Native criteria and privacy disclosures retain keyboard access and themed focus outlines. Workflow copy establishes teacher-set words and paper-only student participation.
- **Visual system:** Existing pine-teal tokens, Poppins/Inter/Learning Curve, and printed guide colours. Landing guides use dedicated tokens: slate `#727f7a`, dotted teal `#298d83`, and rust `#a96840`, each at least 3:1 against white, canvas, and pine wash. Annotation marks use band terracotta, teal, and forest green, never alarm red; criterion marks are visible without hover. Landing styles live in `frontend/app/landing.module.css`; the art lives in `frontend/components/landing/`.
- **Motion and accessibility:** The hero accent "stroke by stroke." writes itself once on first observation using sequential centerline masks over the original Learning Curve letterforms, including crossbars and the final dot; it has no underline. Screen readers retain the real heading text, and reduced-motion/no-JavaScript views show the full static phrase. One orchestrated entrance: slips settle in, the growth thread inks from Week 1 to Week 8, and the nodes appear. The feedback note crossfades when the selection changes. Main entrance motion is gated behind `prefers-reduced-motion: no-preference`; CTA and Back to Top movement are also disabled when reduced motion is requested. Back to Top transfers focus to the hero heading and is inert and hidden from assistive technology while visually hidden. The page also has a skip link, themed focus outlines (white on teal), themed text selection, and decorative SVGs that are `aria-hidden`.
- **Demo implementation:** The static example supplies its known 620×430 dimensions to the inspector and overlay so neither eagerly probes the worksheet before its lazy image loads. SVG annotation hit geometry maintains a 44 CSS-pixel minimum, with upward scale rounding. Text-bearing spacing pills use opaque backgrounds for contrast. The growth strip, assessment badges, and criteria legend share the global diagnostic-band colour tokens.

---

## 9. Accessibility

- **Color is never the sole signal.** Every band indicator (badges, chart zones, overlay legend, table cells) always pairs its color with the band's text name — covers the largest real accessibility gap (color-blindness affects roughly 1 in 12 men) without needing a secondary pattern/texture system.
- **Accessible Text Contrast (WCAG 2.1 AA):** All foreground text meets or exceeds the 4.5:1 ratio against light/dark card backgrounds. System destructive and error states enforce >6:1 contrast (`#9C4A2F` in light mode, `#E69875` in dark mode).
- **Semantic Landmark Hierarchy:** Enforce a single `<main>` landmark per view (outer `SidebarInset` serves as `<main>`, nested page wrappers inside use `<div>` or `<section>`). Navigation menus are wrapped in `<nav aria-label="...">` with dynamic `aria-current="page"` active bindings.
- **Screen Reader Context for Row Actions:** Interactive table actions provide dynamic, student-specific labels (e.g. `aria-label="Actions for [Student Name]"` and `<span className="sr-only">Actions for [Student Name]</span>`) per WCAG 2.4.4.
- **Visible Keyboard Focus:** Visible focus rings on all interactive elements (`focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2`).
- **Reduced Motion Respected:** Framer Motion sequences and Base UI / shadcn modal dialog overlays strictly enforce `motion-reduce:animate-none motion-reduce:transition-none`, honoring the system's `prefers-reduced-motion` setting.

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


## Phase 3 Slice 1 — Assignment and deadline flow

Contract implemented on the feature branch; verification status is in IMPLEMENTATION_STATUS.md. Create/edit retains the existing modal visual system and adds required title, optional plain-text instructions, section checkboxes, optional individual targets, and a datetime-local input labelled "Due date and time (optional)". Due-date labels and displays omit the timezone name; conversion still uses Asia/Manila. Clearing due clears closure. Empty target selection receives inline feedback; no targets links to roster management. Retained targets no longer in the current roster have explicit removal controls. Unchanged targets are omitted from unrelated PATCH edits. Failed saves preserve entered values.

Duplicate copies title, prompt, instructions, mode and targets, clearing due/closure. Cards/details use title as the primary heading and retain the cursive prompt. The teacher activity page lists every assigned roster child, including children with no uploads, with Assigned/Missing/Turned in and Late. Quick upload filters choices by assignment and unlocks invalid prefills with explanatory recovery copy.

Parent activity reads are scoped to the selected child before fetching activity rows. Cards show title, instructions, mode, due date in Manila and coursework status; newer rejection/processing feedback is separate. In-class cards have no visible upload action. Closed take-home cards explain closure and disable upload; history remains available. Assignment/closure server errors refresh the list, close invalid upload flows and use error.code. Read errors show a retry state instead of an empty assignment list.

Statuses use the latest completed attempt ordered by created_at then ID descending. Without one, work is Assigned through the deadline and Missing strictly afterward. Late compares the completed attempt's persisted creation time with due. Timers refresh displayed status/closure while open. No draft/release/return/excused status is introduced in this slice.

Manual QA must cover create/edit/duplicate, section/direct/overlapping targets, roster removal/reselection, empty legacy activity edits, sibling isolation, both modes, open/closed/exact-boundary deadlines, processing/rejection after a completed attempt, timezone changes, keyboard controls, narrow screens, and archive/delete regressions. Component-only checks do not substitute for signed-in portal QA.

## Phase 3 Slice 2 — Return and release flow

Teacher submission detail shows the work state and whether the inspected attempt is counted/pinned. Completed attempts offer Return; the active graded draft offers Release result. Count this attempt pins a completed historical attempt; Use automatic selection clears the pin. Returned attempts retain their reason, note, photo and historical assessment, with rubric editing disabled.

The Return dialog requires a reason (wrong worksheet, blurry/cropped photo, wrong target text, incomplete, other), allows a plain-text parent note of up to 2,000 characters, and optionally sets a Manila-time resubmission deadline. Leaving the deadline blank preserves it. Returning an attempt requests fresh work without automatically counting an older attempt. A valid teacher pin can deliberately count an older completed attempt.

Assigned-student rows show the shared work status and Deadline & attempt controls. Settings change only fields the teacher edits: clear the student deadline to restore the activity deadline, or select an eligible completed attempt to pin. Past deadlines explain the resulting Missing state. Release results shows the draft count and confirms before bulk sharing; the server rechecks eligibility and reports the actual count.

The activity workspace retains the unified review queue, including assigned students without uploads, counted worksheet context, latest-upload status, worksheet history and persistent navigation sessions. Needs attention, Awaiting upload and All students combine with latest-upload filters, search and sorting. Worksheet inspection and return preserve this queue. Release review is activity-wide and independent of these filters.

The activity header displays the full ruled worksheet prompt and any instructions, with a Copy action beside the prompt heading and the created date and word/upload totals below it. The compact header keeps the activity title, deadline and upload action visible. The class summary exposes its next practice focus without opening the detailed chart; a measured zero remains a valid practice focus. Names wrap in both uploaded and no-upload rows. When worksheet drafts are absent and the activity has no point grades, release readiness appears as quiet status text rather than a disabled release button.

Activity-wide release starts with Review release, listing the currently ready worksheet results and student sections. Page filters do not limit release. Point-bearing activities load the existing section Gradebook reads while the dialog is open and show eligible draft point grades with their values, overrides and zeros, including work without uploads. Uncovered students are named and explicitly require manual review; a partial inventory never claims a complete count. Failed reads block confirmation and provide retry, and students missing from the loaded roster block confirmation until identified. Changes to worksheet state or fetched grade values/revisions require reviewing again. Activity/section links open the relevant Gradebook view. The server's returned release counts remain visible after success; this UI does not change publication eligibility or the scoring provider.

Roster, worksheet and work-state reads have distinct loading/error states. Progress totals wait for their dependencies; failed work-state reads fall back to newest uploads and label status unavailable, with retry. Empty assignment guidance opens activity editing. Release controls explain readiness and distinguish worksheet results from point grades; activities with points can open confirmation even with no worksheet drafts. The confirmation retains the point-grade inventory, discloses cross-section scope and any uncovered students, and stacks its actions to fit phone and desktop dialogs. Grouping, layout and sorting use keyboard-accessible radio groups in the View menu. The activity toolbar, attempt switcher and inspection actions have 44px phone targets.

Diagnostic scores identify Teacher rubric or Calibrated as their source. Class performance retains its scored-student count on phones and identifies its source; mixed summaries show the count from each source. These labels use the existing score resolver and do not change which attempts enter the aggregate.

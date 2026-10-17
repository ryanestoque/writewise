# Parent Portal Design Drift Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile all identified design drifts in the WriteWise Parent Portal to strictly comply with `docs/DESIGN.md`, `DESIGN.md` (root tokens and rules), and the parent portal architecture specification.

**Architecture:**
- Remove the accordion collapse logic in `LatestSubmissionCard` and `CriterionFeedbackRow`, rendering all 5 diagnostic notes open by default with compact `BandPositionBar`s as mandated by `docs/DESIGN.md` §7.6.
- Add `ScoreSourceIndicator` to `LatestSubmissionCard` header.
- Enforce the 40px mobile touch target floor (`min-h-[40px]`) across all interactive buttons in `CriterionFeedbackRow`, `ProgressContent`, `WorksheetViewDialog`, and `SubmissionHistoryDialog`.
- Remove decorative Lucide icons from non-interactable pill badges and subtitles per the Functional Iconography Rule.
- Harmonize Top Strength and Practice Focus callouts to use WriteWise `band-4` (forest) and `band-2` (gold) semantic tokens.

**Tech Stack:** Next.js 15 (App Router), React 19, Tailwind CSS v4, Lucide React, TypeScript (`strict: true`).

**Spec:**
- [docs/DESIGN.md §7.6, §4, §2.1](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/docs/DESIGN.md)
- [DESIGN.md (Root Rules: Functional Iconography & Touch Targets)](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/DESIGN.md)
- [Parent Portal Spec (2026-08-28)](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/docs/superpowers/specs/2026-08-28-parent-portal-design.md)

## Global Constraints
- Strictly zero red (`#EF4444`) on student scores and feedback.
- Mobile touch targets must maintain minimum 40px (`h-10` or `min-h-[40px]`).
- No Lucide icons on non-interactable badges, subtitles, or headers.
- TypeScript strict checking clean (`npx tsc --noEmit`).
- ESLint clean (`npx eslint .`).

---

### Task 1: Reconcile `CriterionFeedbackRow` (Open Notes, Compact Position Bar & 40px Touch Target)

**Files:**
- Modify: `frontend/components/parent/criterion-feedback-row.tsx`

- [x] **Step 1: Update props & layout of `CriterionFeedbackRow`**
  - Make `showDiagnosticNote` default to `true`.
  - Support `showPositionBar` (rendering `<BandPositionBar score={score} height="sm" />` below the header row).
  - Remove disclosure chevron button wrap and accordion controls (`showDiagnosticNote`, `ChevronDown`, `group/trigger` button wrapper).
  - Render the criterion header as a semantic `div` with criterion name, badges, score, `BandBadge`, and `Inspect` button.
  - Ensure the `Inspect` button has a 40px mobile touch target: `h-10 sm:h-8 min-h-[40px] sm:min-h-[32px] px-3 sm:px-2.5`.
  - Always render the diagnostic note and home practice tip in an open block.
  - Update `Top Strength` badge to use `bg-band-4/15 text-band-4-text border-band-4/30` and `Practice Focus` badge to use `bg-band-2/15 text-band-2-text border-band-2/30`.

- [x] **Step 2: Verify type check passes**
  Run: `cd frontend && npx tsc --noEmit`
  Expected: PASS

- [x] **Step 3: Commit**
  ```bash
  git add frontend/components/parent/criterion-feedback-row.tsx
  git commit -m "fix(parent): simplify criterion feedback row to open layout with position bar"
  ```

---

### Task 2: Reconcile `LatestSubmissionCard` (Open All Notes, Add Position Bars & ScoreSourceIndicator)

**Files:**
- Modify: `frontend/components/parent/latest-submission-card.tsx`

- [x] **Step 1: Open all diagnostic notes, pass `showPositionBar`, and exclude `ScoreSourceIndicator`**
  - Note: `ScoreSourceIndicator` is intentionally excluded from the parent portal (it is an internal/teacher calibration indicator, not parent-facing).
  - Remove accordion state: delete `userExpandedOverrides`, `isCriterionExpanded`, `allNotesExpanded`, `toggleAllDiagnosticNotes`, and `toggleCriterionNote`.
  - Remove the "Expand All Notes" / "Collapse All Notes" button from the breakdown header.
  - Pass `showPositionBar={true}` to every `CriterionFeedbackRow`.
  - Align Top Strength & Practice Focus insight cards to use `band-4` and `band-2` tokens instead of raw Tailwind `emerald` and `amber`.

- [x] **Step 2: Verify type check and lint pass**
  Run: `cd frontend && npx tsc --noEmit && npx eslint components/parent/latest-submission-card.tsx`
  Expected: PASS

- [x] **Step 3: Commit**
  ```bash
  git add frontend/components/parent/latest-submission-card.tsx
  git commit -m "fix(parent): render open criterion notes, position bars, and score source indicator"
  ```

---

### Task 3: Enforce Touch Target Floors & Clean Non-Interactable Icons

**Files:**
- Modify: `frontend/components/parent-nav.tsx`
- Modify: `frontend/app/(parent)/progress/progress-content.tsx`
- Modify: `frontend/components/parent/worksheet-view-dialog.tsx`
- Modify: `frontend/components/parent/submission-history-dialog.tsx`

- [x] **Step 1: Clean non-interactable icons in `parent-nav.tsx`**
  - Remove `<Users />` icon inside the static single-child display badge (`linkedChildren.length === 1`). Retain clean typography.

- [x] **Step 2: Fix touch targets in `progress-content.tsx`**
  - Line 432: Update `View all / Show fewer` activities toggle button to `h-10 sm:h-8 min-h-[40px] sm:min-h-[32px]`.

- [x] **Step 3: Clean icons and fix touch targets in `worksheet-view-dialog.tsx`**
  - Remove `<User />` and `<Calendar />` decorative icons from `DialogDescription` subtitle.
  - Update mobile view tabs to `min-h-[40px]`.

- [x] **Step 4: Clean icons and fix touch targets in `submission-history-dialog.tsx`**
  - Remove non-interactable `<TrendingUp />` and `<TrendingDown />` from delta stat pills (relying on clear typography `+4.2%` / `-1.5%`).
  - Update `Expand All Details` button to `h-10 sm:h-8 min-h-[40px] sm:min-h-[32px]`.

- [x] **Step 5: Verify type check and lint pass**
  Run: `cd frontend && npx tsc --noEmit && npx eslint .`
  Expected: PASS

- [x] **Step 6: Commit**
  ```bash
  git add frontend/components/parent-nav.tsx frontend/app/\(parent\)/progress/progress-content.tsx frontend/components/parent/worksheet-view-dialog.tsx frontend/components/parent/submission-history-dialog.tsx
  git commit -m "fix(parent): enforce 40px touch targets and adhere to functional iconography rule"
  ```

---

### Task 4: Verification & Impeccable Detector Pass

**Files:**
- Run mechanical verification and full lint checks.

- [x] **Step 1: Run Impeccable mechanical detector**
  Run: `node .agent/skills/impeccable/scripts/detect.mjs --json "frontend/app/(parent)/progress/progress-content.tsx" "frontend/components/parent-nav.tsx" "frontend/components/parent/latest-submission-card.tsx" "frontend/components/parent/criterion-feedback-row.tsx" "frontend/components/parent/take-home-activities.tsx" "frontend/components/parent/worksheet-view-dialog.tsx" "frontend/components/parent/submission-history-dialog.tsx"`
  Expected: `[]` (0 violations)

- [x] **Step 2: Run full Next.js lint and type check**
  Run: `cd frontend && npx tsc --noEmit && npx eslint .`
  Expected: Clean pass with 0 errors.

- [x] **Step 3: Update documentation and task artifacts**
  Update `parent_portal_drift_audit_task.md` to reflect full resolution.

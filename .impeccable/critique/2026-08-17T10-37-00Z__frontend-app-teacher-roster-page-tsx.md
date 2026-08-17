---
target: roster page
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-17T10-37-00Z
slug: frontend-app-teacher-roster-page-tsx
---
# Class Roster Critique Report

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading spinners on fetch/mutations, toast notifications; minor gap: no row-level pending state |
| 2 | Match System / Real World | 3 | Classroom terms like Section/Roster; "Date Added" is database-centric rather than classroom-centric |
| 3 | User Control and Freedom | 4 | Cancel on modals, escape dismiss, clear unenrollment confirmation with data preservation explanation |
| 4 | Consistency and Standards | 3 | Follows shadcn & DESIGN §8.3 empty state; nested double-padding conflict with TeacherLayout |
| 5 | Error Prevention | 3 | Zod validation on name/section/email, confirmation on remove; no duplicate name warning within section |
| 6 | Recognition Rather Than Recall | 2 | No search bar or section filtering; finding students in large lists requires manual scanning |
| 7 | Flexibility and Efficiency | 2 | No bulk/CSV add, no "Save & Add Another", no sortable column headers |
| 8 | Aesthetic and Minimalist Design | 3 | Clean, flat data-dense table matching DESIGN.md §4; low-utility date column |
| 9 | Error Recovery | 3 | Inline form errors, clear error banner with Retry button, mutation failure toasts |
| 10 | Help and Documentation | 2 | Helpful empty state copy, but no inline hints explaining parent email invite mechanics |
| **Total** | | **28/40** | **Good** |

## Design Specificity Verdict

- **LLM Assessment**: The current roster interface is structurally functional and faithfully implements the base shadcn UI patterns and DESIGN.md empty-state guidelines, but feels like a generic SaaS CRUD table rather than an education-specific handwriting assessment tool. Philippine elementary teachers handle 30–50 students per class and often manage multiple sections. A flat, unsearchable, unsorted list with one-by-one modal entry imposes unnecessary cognitive friction.
- **Deterministic Scan**: Automated detector scanned `frontend/app/(teacher)/roster/page.tsx` and `frontend/components/roster/student-dialog.tsx` with **0 findings**. Codebase adheres cleanly to lint, styling, and design token rules.
- **Visual Overlays**: Skipped live script injection (direct browser evaluation unavailable in authenticated server-rendered context).

## Overall Impression
A clean and stable CRUD foundation that adheres to design tokens and empty-state guidelines, but currently behaves like a generic contacts table. Adding real-time search, section filtering, student initial avatars, and a faster onboarding path ("Save & Add Another" / Bulk Add) will elevate this from a basic database viewer to an efficient classroom management workspace.

## What's Working
- **DESIGN §8.3-Compliant Empty State**: Uses the custom `Empty` primitive with `EmptyMedia` (`bg-brand-100 text-brand-700`), `EmptyTitle`, `EmptyDescription`, and a prominent `Add Student` CTA, ensuring a welcoming onboarding experience when zero students are enrolled.
- **Thoughtful Destructive Dialog Copy**: The unenrollment `AlertDialog` provides explicit, reassuring copy explaining that removing a student will unenroll them without deleting historical submission and measurement data.
- **Reliable Form Validation & Error States**: `student-dialog.tsx` uses `zod` + `react-hook-form` with inline error messages, and the main page features a dedicated error banner with a one-click `Retry` action.

## Priority Issues
- **[P1] No Search or Section Filtering**:
  - **Why it matters**: Teachers with 30–60 students across multiple sections cannot quickly find a student without scrolling through the entire list.
  - **Fix**: Add a real-time search input and a Section filter (tabs or dropdown) above the table.
  - **Suggested command**: `/impeccable layout`
- **[P1] Slow One-by-One Student Onboarding**:
  - **Why it matters**: Entering an entire class section (30+ students) requires opening, filling, submitting, and re-opening the dialog 30+ times.
  - **Fix**: Add a "Save & Add Another" action in the dialog or provide a quick bulk paste/entry workflow.
  - **Suggested command**: `/impeccable onboard`
- **[P2] Low-Utility "Date Added" Column & Generic Row Layout**:
  - **Why it matters**: "Date Added" is low-relevance database metadata for teachers. Teachers need at-a-glance student identification (initials/avatar), section clarity, and activity/parent status.
  - **Fix**: Add student initial avatars, replace/supplement "Date Added" with parent invite status or submission activity badges, and make table headers sortable.
  - **Suggested command**: `/impeccable distill`
- **[P2] Nested Container Double Padding**:
  - **Why it matters**: `TeacherLayout` provides `p-6`, while `RosterPage` adds `p-4 sm:p-6 md:p-8 max-w-5xl mx-auto`, unnecessarily cramping horizontal table width on medium displays.
  - **Fix**: Remove outer page padding in `RosterPage` and let `TeacherLayout` handle surface padding.
  - **Suggested command**: `/impeccable polish`

## Persona Red Flags
- **Teacher Maria (High-Volume Grade 3 Teacher / "Alex" power user)**: Managing 45 students in "Rizal" and 40 in "Bonifacio". Mixed alphabetical listing forces constant scanning; enrolling 85 students one-by-one in the modal is a major pain point.
- **Teacher Jordan (First-Timer / "Jordan" persona)**: Wondering what happens when entering a "Parent Email" (does it send an invite email immediately? Can it be added later?). No inline explanatory hint provided.
- **Accessibility User ("Sam")**: Table rows have screen-reader labels on action buttons, but column headers lack sortable aria attributes and section filter shortcuts.

## Minor Observations
- Table container uses `rounded-sm` (matching DESIGN.md §4 data-dense rule), but modal uses `rounded-2xl` and buttons use default rounded styling.
- Combobox in `student-dialog.tsx` provides existing section suggestions, which is a nice touch, but could benefit from a clearer dropdown trigger icon.
- Roster count badge or summary counter (e.g. "Total: 42 Students · 2 Sections") is missing from the header.

## Questions to Consider
- "What if teachers could paste a simple list of student names to instantly populate an entire section?"
- "Should the roster table highlight students who have pending worksheet submissions or missing diagnostic reviews?"
- "Could section tabs allow one-click switching between different Grade 3 classes?"

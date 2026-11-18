# Phase 4 — Student Avatars and Growth Badges design

**Date:** 2026-11-18 (Asia/Manila)
**Status:** Approved for implementation planning on 2026-11-18. Design resolved across a 6-round, 22-question grilling session. This document does not claim application implementation, verification, merge, migration, or deployment.

**Scope source:** Defense panel feedback requesting a simple reward/progress system for students. Post-defense enhancement with no timeline pressure.

## 1. Decisions confirmed in this conversation

1. The feature is a **post-defense Phase 4** enhancement. No external deadline constrains it.
2. The purpose is **parent motivation** — giving parents a visible, feel-good signal when their child improves. The defense panel's feedback was that parents will be happy to see children improving or reaching a certain status.
3. The reward appears on **both portals** — teacher and parent.
4. Badges are driven by **improvement trajectory** (growth events), not by absolute score level. This aligns with the product's "diagnostic, not evaluative" design principle.
5. Once earned, a badge is **permanent** (high-water mark). A student whose composite band drops on a later submission does not lose the badge. The badge is a reward system; the existing band indicator shows current status.
6. The visual form is **cartoon avatars with decorative borders** (Reddit-inspired). Avatars are handwriting/stationery-themed SVG illustrations committed to the repo. The border around the avatar evolves as the student earns badges.
7. Badge and border are a **unified system**. The student's most significant earned badge determines their current border. There is no separate trophy case or dual reward track.
8. DESIGN.md §5's previous "Student initials avatars removed" decision is **fully reversed**. Cartoon avatars return to all student surfaces: roster rows, class-wide dashboard table, submission cards, per-student drill-down header, parent progress view header.
9. The teacher picks the avatar when creating/editing a student; the parent can change it later. Both use the same popover picker component.
10. If the teacher skips avatar selection, the system **auto-assigns** a random avatar deterministically (`hash(student.id) % pool_size`) so it is stable across page loads.
11. Badges are **computed on submission release** (when a counted submission is first released by the teacher) and stored in the database. Border tier is derived at read time from earned badges.
12. Only **released, counted** submissions drive badge comparisons — consistent with how trends, progress charts and all other progress surfaces work per Phase 3 Slice 2.
13. New badge awards produce both an **inline celebration** on the submission result screen and a **bell notification** for parents who were not the uploader. Notifications use the existing Phase 3 Slice 3 bell infrastructure.
14. Users discover earned and unearned badges by **tapping the avatar** anywhere it appears (popover detail) and by viewing a **persistent badge card** on the parent progress view and teacher per-student drill-down.

## 2. Avatar system

### 2.1 Pool and assets

Fifteen to twenty handwriting/stationery-themed SVG illustrations: pen characters, notebook creatures, ink-drop mascots, eraser buddies, pencil pals. Thematically tied to WriteWise's domain rather than generic animals or abstract shapes.

- Format: SVG, committed to the repo (e.g. `frontend/public/avatars/`). Not stored in Supabase Storage.
- Scalable and themeable: SVGs can be color-tinted to match border tiers if desired.
- Production path: AI-generated drafts cleaned up in Figma or Illustrator.

### 2.2 Selection UX

A **popover picker** (shadcn Popover). Click the current avatar to open a small grid of available options. Click to select. Popover closes. Same component for both portals:

- **Teacher entry point:** the "Add Student" and "Edit Student" forms. Avatar selection is optional.
- **Parent entry point:** the child's avatar on the `/progress` view header.

### 2.3 Fallback

When a teacher does not select an avatar, the system assigns one deterministically: `hash(student.id) % pool_size`. This keeps the assignment stable across page loads and avoids a bland placeholder. Both teacher and parent may replace the auto-assigned avatar at any time.

## 3. Badge catalog

Ten growth-event badges in five categories. Each badge's trigger condition evaluates against the student's history of released, counted submissions only.

### 3.1 Participation

| Badge | Trigger |
|---|---|
| **First Steps** | First released, counted submission processed successfully. |

### 3.2 Improvement

| Badge | Trigger |
|---|---|
| **First Improvement** | Composite score improved over the previous released, counted submission for the first time. |
| **On a Roll** | Composite improved on three consecutive released, counted submissions. |

### 3.3 Criterion breadth

| Badge | Trigger |
|---|---|
| **Well-Rounded** | Improved in three or more of five criteria in a single submission compared to the previous counted submission. |
| **Clean Sweep** | Improved in all five criteria in a single submission compared to the previous counted submission. |

### 3.4 Band milestones

| Badge | Trigger |
|---|---|
| **Reached Developing** | Composite band reached Developing for the first time. |
| **Reached Satisfactory** | Composite band reached Satisfactory for the first time. |
| **Reached Excellent** | Composite band reached Excellent for the first time. |

### 3.5 Consistency

| Badge | Trigger |
|---|---|
| **Steady Hand** | Maintained Satisfactory or above for three consecutive counted submissions. |
| **Master Penman** | Maintained Excellent for three consecutive counted submissions. |

### 3.6 Comparison semantics

"Previous" means the chronologically preceding released, counted submission for that student across all activities. Returned and rejected submissions are excluded from badge computation entirely. If a submission is returned after badges have already been computed from a release that included it, no badge is revoked (badges are permanent).

## 4. Border tier system

### 4.1 Tier mapping

The ten badges map to six visual border tiers. The student's highest-tier badge determines their current border. Multiple badges within the same tier are collected achievements that do not change the border appearance.

| Tier | Name | Border color | Border complexity | Unlocking badges |
|---|---|---|---|---|
| 0 | Default | Thin `border` gray (`#E3E6E4`) | Simple circle | No badges earned |
| 1 | Starter | `brand-600` teal (`#1B6B63`) ring | Clean circle, slightly thicker | First Steps |
| 2 | Growing | `band-2` gold (`#C9A227`) ring | Circle with subtle pen-stroke flourish | First Improvement, On a Roll, Well-Rounded |
| 3 | Strong | `band-3` sage (`#7C9B6E`) ring | Circle with ornamental frame elements | Reached Developing, Reached Satisfactory, Clean Sweep |
| 4 | Outstanding | `band-4` forest (`#4A8B5C`) ring with glow | Full ornate frame with flourishes | Reached Excellent, Steady Hand |
| 5 | Mastery | `band-4` forest with `band-2` gold accent | Elaborate frame with animated shimmer | Master Penman |

### 4.2 Color source

Border colors reuse the existing band color tokens from DESIGN.md §2.1. No new palette entries are introduced. The progression (gray → teal → gold → sage → forest → forest-gold) avoids alarm-coded red, consistent with the band color system's design intent.

### 4.3 Motion

The Tier 5 animated shimmer respects `prefers-reduced-motion` and falls back to a static glow. All other border tiers are static. Consistent with DESIGN.md §2.6's scoped motion policy.

### 4.4 Border asset format

Tier 1 is a CSS ring (no asset). Tiers 2 through 5 require decorative SVG frame assets committed alongside the avatar pool. These are reusable across all avatar characters.

## 5. Badge discoverability

### 5.1 New badge celebration

When a submission finishes processing and one or more new badges are awarded:

- **Inline celebration** on the submission result screen: an animated badge reveal consistent with the existing band badge reveal motion (DESIGN.md §2.6). Shows the new badge name, icon, description, and the updated border around the avatar.
- **Bell notification** for parents who were not the uploader: a notification in the existing Phase 3 Slice 3 bell system. Event type: `badge_earned`. Copy: "[Student] earned the '[Badge Name]' badge!" No score, image, or measurement data appears in the notification body.

### 5.2 Avatar tap popover

Tapping or clicking the avatar and border **anywhere it appears** in the app opens a popover or bottom sheet showing:

- Student name and current avatar with its border.
- Current border tier name.
- Earned badges: listed with name, icon, and earned date.
- Unearned badges: grayed out, with descriptions of how to unlock them.
- A "Change avatar" action that opens the avatar picker popover (§2.2). This is the parent's entry point for customization; the teacher's entry point remains the student edit form.

The badge popover and the avatar picker are **separate popovers** — the badge popover shows achievement details and includes a link/button to open the avatar picker. They do not share a trigger.

### 5.3 Persistent badge section

The **parent `/progress` view** and the **teacher per-student drill-down** include a small visible badge card or panel showing earned badges. Always visible, requiring no interaction to discover. Keeps the badge system prominent on the two key progress-focused surfaces without cluttering dense data views like the roster table or class-wide dashboard.

## 6. Data model

### 6.1 New enum

```sql
CREATE TYPE public.badge_type AS ENUM (
  'first_steps',
  'first_improvement',
  'on_a_roll',
  'well_rounded',
  'clean_sweep',
  'reached_developing',
  'reached_satisfactory',
  'reached_excellent',
  'steady_hand',
  'master_penman'
);
```

### 6.2 Student avatar column

```sql
ALTER TABLE public.student
  ADD COLUMN avatar_id text NOT NULL DEFAULT 'auto';
```

A value of `'auto'` means system-assigned via deterministic hash. Any other value is a chosen avatar slug matching a filename in the committed SVG pool. Validation: the backend rejects avatar IDs not present in the known pool.

### 6.3 Earned badges table

```sql
CREATE TABLE public.student_badge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.student(id) ON DELETE CASCADE,
  badge_type public.badge_type NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  triggered_by_submission_id uuid REFERENCES public.submission(id) ON DELETE SET NULL,
  UNIQUE (student_id, badge_type)
);
```

- `ON DELETE CASCADE` on `student_id`: deleting a student removes their badges.
- `ON DELETE SET NULL` on `triggered_by_submission_id`: deleting the triggering submission nullifies the reference but preserves the badge (badges are permanent).
- `UNIQUE (student_id, badge_type)`: each badge is earned at most once per student.
- Write-once rows. No update path. The backend inserts, never modifies.

### 6.4 Border tier derivation

The border tier is **derived at read time** from the student's earned badges. No stored tier column. Query: select all `badge_type` values for the student, map each to its tier per §4.1, return the maximum. At most ten rows per student, negligible cost.

### 6.5 RLS

- Teachers see badges for students in their roster (via `teacher_student` join, consistent with existing student RLS patterns).
- Parents see badges for their linked children (via `student_parent` join, consistent with existing parent RLS patterns).
- Badge rows are **read-only from the client**. All writes happen through the FastAPI service using the service-role key. No insert, update, or delete policies on `student_badge` for authenticated callers.
- `avatar_id` on student follows the existing student row's RLS. Avatar updates go through the existing `PATCH /students/{id}` authorization path.

## 7. Badge computation

### 7.1 Trigger point

Badge evaluation runs **in the backend** when a submission transitions to a released, counted state. This occurs within the existing release flow — after the teacher releases results (single or bulk). No separate background job, no recomputation on page load.

### 7.2 Evaluation procedure

For the student whose submission was just released:

1. Query the student's full history of released, counted submissions ordered chronologically.
2. Identify the newly released submission's position in that history.
3. Evaluate each badge condition in §3 against the full history.
4. For any badge not yet present in `student_badge`, insert a new row.
5. If new badges were inserted, enqueue a `badge_earned` notification for each linked parent (excluding the current caller if they are a parent).

Steps 4 and 5 execute in the same database transaction as the release operation.

### 7.3 Idempotency

Re-releasing an already-released submission does not re-evaluate badges (consistent with existing release idempotency). Badges are only evaluated on first release of a counted submission.

## 8. API surface

| Endpoint | Method | Description |
|---|---|---|
| `GET /students/{id}/badges` | GET | Returns the student's earned badges (badge type, earned date, triggering submission ID) and derived border tier. |
| `PATCH /students/{id}` | PATCH | Existing endpoint, extended to accept `avatar_id`. Validates against the known avatar pool. |
| `GET /avatars` | GET | Returns the available avatar pool: slug identifiers and SVG asset paths. Static, cacheable. |

Badge awards happen internally during submission release processing. No dedicated award endpoint exists.

## 9. Notification event

A new `badge_earned` event type is added to the Phase 3 Slice 3 notification system.

- **Recipients:** all parents linked to the student via `student_parent`, excluding the current caller if they are a parent.
- **Teacher recipient:** none. Teachers see badges directly on their portal surfaces.
- **Copy:** "[Student] earned the '[Badge Name]' badge!"
- **Destination:** `/progress?child={student_id}` — leads to the persistent badge section.
- **Body:** no score, image, measurement, or diagnostic data. Consistent with existing notification body rules.
- **Deduplication:** one notification per badge earned per parent. A bulk release that triggers multiple badges for the same student sends one notification per badge.

## 10. Voice and copy

Badge names and descriptions follow DESIGN.md §8.1 copy register: short, plain, jargon-free, active voice. Badge descriptions use encouraging growth framing consistent with §8.2 diagnostic note voice. No judgment-coded language ("poor," "bad," "fails to"). The unearned badge descriptions explain how to unlock them in terms of what the student can do next, not what they have failed to do.

## 11. Accessibility

- **Color is never the sole signal.** Each border tier is paired with the tier name in the avatar tap popover. Border color alone does not communicate tier — the popover text does.
- **Badge icons** pair their visual with text labels (badge name). No icon-only display.
- **Popover** follows existing shadcn Popover keyboard and screen reader patterns.
- **Celebration animation** respects `prefers-reduced-motion`, falling back to a static badge reveal.
- **Avatar picker** popover grid supports keyboard navigation (arrow keys) and has descriptive labels for each option.

## 12. Open items

- **Avatar illustration production:** fifteen to twenty stationery-themed SVGs need design. Production path and timeline are not gated by this spec.
- **Badge icon design:** ten badge icons/emblems for the popover, persistent section, and celebration screen.
- **Border frame SVGs:** four decorative frame assets for Tiers 2 through 5.
- **Celebration animation design:** the inline badge reveal needs motion design consistent with existing §2.6 patterns.
- **Copy review:** badge names and descriptions should get a tone pass against §8.1 before shipping.
- **Email integration:** whether `badge_earned` events should trigger optional email (Slice 4 extension) is deferred. In-app notification only for now.

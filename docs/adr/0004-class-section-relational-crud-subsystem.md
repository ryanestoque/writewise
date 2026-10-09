# ADR 0004: Class Section Relational CRUD Subsystem & Hybrid Sync Architecture

- **Status:** Accepted / Implemented
- **Date:** 2026-10-10
- **Authors:** WriteWise Engineering Team
- **Implements:** `PRD.md` §7.1, `DATABASE.md` §5, `docs/superpowers/specs/2026-10-10-class-section-crud-design.md`, Migration `0020_class_sections.sql`

---

## 1. Context & Problem Statement

In the initial prototype schema (`0003_roster.sql`), class sections were represented solely as a flat string column (`student.section text not null`) on the `student` table. Unique sections and filter pills were derived dynamically in-memory from the enrolled students list.

While functional for minimal prototypes, this string-only approach presented operational bottlenecks:
1. **Lack of Lifecycle Management:** Teachers could not pre-create sections before enrolling students, view empty sections, or manage section names centrally.
2. **Rename Friction & Misspelling Overhead:** Renaming or fixing typos required manually editing each student row or selecting all students to execute batch updates.
3. **No Relational Integrity:** There was no formal database entity guaranteeing that students in the same class section shared a canonical reference ID.

However, completely replacing the `student.section` column with a strict foreign key (`section_id`) would have broken dozens of existing direct Supabase reads across the Teacher Dashboard, Parent Portal, Quick Upload Dialog, and CSV exports, necessitating high-risk join refactorings across both frontend and backend.

---

## 2. Decision Drivers

- **Administrative Control:** Empower teachers to create, rename, and delete class sections independently of student enrollment.
- **Backward Compatibility & Zero Regressions:** Guarantee that all existing queries, dashboard analytics, parent views, and report exports continue to work seamlessly without invasive join rewrites.
- **Data Safety & Integrity:** Prevent accidental deletion of active sections and ensure orphan prevention at the database constraint level.
- **Multi-Tenant Security:** Maintain strict Row Level Security (RLS) ensuring teachers cannot see, edit, or delete another teacher's sections.
- **Pilot & Defense Timeline:** Keep the architecture robust, well-tested, and verifiable within the October 2026 technical defense roadmap.

---

## 3. Considered Options & Architectural Decisions

### Considered Options

* **Option 1: Status Quo (String-Only + Batch Move):** Retain string-only storage and rely on the batch move dialog. *Rejected* because it provided no dedicated section entity, no visibility into empty sections, and no centralized renaming.
* **Option 2: Virtual UI Section Manager (No DB Entity):** Provide a management UI that batch-updates `student.section` text strings without creating a database table. *Rejected* because it lacked foreign-key referential integrity and could not support empty sections.
* **Option 3: Strict Normalized Relational (Breaking Column Replacement):** Create `public.section`, add `section_id`, and drop `student.section`. *Rejected* due to severe regression risk across all frontend Supabase queries and exports.
* **Option 4: Hybrid Relational with Sync (Chosen):** Create `public.section`, link `student.section_id` via foreign key, and keep `student.section` synchronized as a denormalized string.

---

### Key Architectural Decisions

#### Decision 1: Dedicated `public.section` Entity Owned by Teacher
We introduced a dedicated table `public.section`:
```sql
create table public.section (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_teacher_section_name unique (teacher_id, name)
);
```
Sections are strictly scoped to the authenticated teacher. RLS is enforced on `public.section` (`using (teacher_id = auth.uid())`).

#### Decision 2: Foreign Key Constraint with Restricted Deletion
We linked `student` to `section` via:
```sql
alter table public.student
  add column section_id uuid references public.section(id) on delete restrict;
```
`ON DELETE RESTRICT` guarantees at the database engine level that a section cannot be deleted while active student records still reference it.

#### Decision 3: Denormalized String Synchronization
We retained `student.section text not null`. When sections are renamed or students are assigned:
- Renaming a section via `PATCH /api/sections/{id}` automatically updates `section.name` and executes a synchronized update across all students matching `student.section_id = id`.
- Creating or editing a student resolves `section_id` and keeps `student.section` identical.
- Direct client reads (`useDashboard`, `useParentData`, `quick-upload-dialog`, CSV exports) continue reading `student.section` without requiring nested foreign-table join syntax (`student:student_id(id, section:section_id(name))`).

#### Decision 4: Backend REST API (`/api/sections`) with Aggregation & Conflict Guards
A new router `backend/app/api/sections.py` exposes:
- `GET /api/sections`: Returns teacher sections with aggregated active `student_count`.
- `POST /api/sections`: Creates section; rejects duplicates with `409 Conflict` (`SECTION_NAME_EXISTS`).
- `PATCH /api/sections/{id}`: Renames section and cascades string update to students.
- `DELETE /api/sections/{id}`: Verifies `student_count == 0`; rejects deletion of non-empty sections with `409 Conflict` (`SECTION_NOT_EMPTY`).

#### Decision 5: Embedded Management UX (`ManageSectionsDialog`)
Instead of cluttering navigation with an isolated `/sections` page, section management is directly embedded in the class management workspace (`/roster`) via a **Manage Sections** toolbar button. The modal provides:
- Quick inline section creation.
- Section list displaying student enrollment badges.
- Inline rename with keyboard shortcuts (`Enter` to save, `Escape` to cancel).
- Safe deletion with disabled state/tooltips for non-empty sections and an `AlertDialog` confirmation for empty sections.
- Integration with `StudentDialog` and `BatchMoveDialog` comboboxes.

---

## 4. Consequences & Trade-offs

### Positive Consequences
- **True Relational Integrity:** Class sections exist as first-class relational records with unique constraints and foreign-key referential integrity.
- **Zero Client Regressions:** By keeping `student.section` synced, all existing client hooks, parent portal views, and data exports remained 100% operational with zero breaking changes.
- **Accidental Deletion Prevention:** Protected at both application layer (UI disabled + 409 guard) and database layer (`ON DELETE RESTRICT`).
- **Complete Test Coverage:** Comprehensive Pytest integration suite (`test_sections.py`) validating permissions, cross-teacher isolation, conflict codes, and student string synchronization.

### Negative / Known Trade-offs
- **Denormalization Maintenance:** Application writes must ensure `section_id` and `student.section` stay synchronized. This is encapsulated within `app/api/sections.py` and `app/api/students.py`.

---

## 5. Verification & Audit Trail

- **Database:** Migration `0020_class_sections.sql` applied to `writewise-dev` via `supabase db push`.
- **API Tests:** 14/14 automated tests passing in `backend/tests/api/test_sections.py` and `backend/tests/api/test_students.py`.
- **Linters & Types:** `ruff check` clean; TypeScript strict mode (`npx tsc --noEmit`) clean; ESLint clean.
- **Specs & Tracking:** Documented in `docs/superpowers/specs/2026-10-10-class-section-crud-design.md`, `docs/superpowers/plans/2026-10-10-class-section-crud.md`, and `IMPLEMENTATION_STATUS.md`.

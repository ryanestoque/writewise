# Class Section Relational Subsystem Design Spec

- **Document type:** Engineering Design Spec
- **Feature:** Class Section Relational CRUD & Roster Management Subsystem
- **Status:** Draft / Approved Design
- **Date:** 2026-10-10
- **Target Release:** Phase 1 / Pilot Baseline

---

## 1. Overview & Context

Currently, class sections in WriteWise are stored as a flat string column (`student.section text not null`) on the `student` table. Unique sections are derived dynamically in-memory from enrolled students.

While effective for minimal pilots, this has limitations as rosters grow:
1. Teachers cannot manage or pre-configure class sections independently of student records.
2. Renaming a misspelled section requires updating every student individually or via batch selection.
3. Sections cannot be deleted unless all students are removed, and there is no explicit view of section capacities or empty sections.

This specification defines a **Hybrid Relational Architecture (Approach 1)**:
- Introduces a dedicated `public.section` relational entity owned by teachers.
- Links `public.student` to `public.section` via `section_id` while maintaining the denormalized `student.section` text column in sync.
- Guarantees backward compatibility: existing direct Supabase reads across the Teacher Dashboard, Parent Portal, Quick Upload Dialog, and CSV exports remain unbroken.
- Implements a full Section CRUD experience embedded directly in the Teacher Roster page (`/roster`).

---

## 2. Database Schema & Migration

### 2.1 Schema Definition (`supabase/migrations/0020_class_sections.sql`)

```sql
-- 1. Create public.section table
create table public.section (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_teacher_section_name unique (teacher_id, name)
);

-- Trigger for updated_at
create trigger set_section_updated_at
  before update on public.section
  for each row execute function public.set_updated_at();

-- 2. Link student to section
alter table public.student
  add column section_id uuid references public.section(id) on delete restrict;

-- 3. Backfill existing sections from current roster
insert into public.section (teacher_id, name)
select distinct ts.teacher_id, s.section
from public.teacher_student ts
join public.student s on s.id = ts.student_id
where s.section is not null and trim(s.section) <> ''
on conflict (teacher_id, name) do nothing;

-- 4. Backfill student.section_id
update public.student s
set section_id = sec.id
from public.teacher_student ts
join public.section sec on sec.teacher_id = ts.teacher_id and sec.name = s.section
where ts.student_id = s.id;

-- 5. Row Level Security
alter table public.section enable row level security;

create policy "teacher can view own sections"
  on public.section for select
  using (teacher_id = auth.uid());
```

### 2.2 RLS & Data Invariants
- Direct client reads (`useSections()`) are protected by RLS: teachers can only select their own sections (`teacher_id = auth.uid()`).
- Writes are executed exclusively via FastAPI with JWT teacher authentication.
- Foreign key constraint `on delete restrict` prevents deleting sections that have active student references at the database level.

---

## 3. Backend API Specification

A new router `backend/app/api/sections.py` is registered under `/api/sections`.

### 3.1 Pydantic Models

```python
class SectionCreate(BaseModel):
    name: str

class SectionUpdate(BaseModel):
    name: str

class SectionResponse(BaseModel):
    id: str
    name: str
    student_count: int
    created_at: str
    updated_at: str
```

### 3.2 Endpoints

#### `GET /api/sections`
- **Auth:** `get_current_teacher`
- **Logic:** Queries `public.section` where `teacher_id = current_teacher.id`. Aggregates active student counts via join with `public.student` where `student.section_id = section.id`.
- **Response:** `200 OK` with `list[SectionResponse]`.

#### `POST /api/sections`
- **Auth:** `get_current_teacher`
- **Logic:** 
  1. Trims and validates `name`. If empty, returns `422 VALIDATION_ERROR`.
  2. Checks for existing section with same name for this teacher. If found, returns `409 Conflict`:
     ```json
     {
       "error": {
         "code": "SECTION_NAME_EXISTS",
         "message": "A section with this name already exists.",
         "details": { "name": "..." }
       }
     }
     ```
  3. Inserts into `public.section`.
- **Response:** `201 Created` with `SectionResponse` (`student_count = 0`).

#### `PATCH /api/sections/{section_id}`
- **Auth:** `get_current_teacher`
- **Logic:**
  1. Verifies ownership of `section_id` by `current_teacher.id`. Returns `404 NOT_FOUND` if not found.
  2. Trims and validates new name. Checks uniqueness across teacher's sections.
  3. Updates `public.section.name`.
  4. **Denormalization Sync:** Updates `public.student.section = new_name` for all students with `student.section_id = section_id`.
- **Response:** `200 OK` with updated `SectionResponse`.

#### `DELETE /api/sections/{section_id}`
- **Auth:** `get_current_teacher`
- **Logic:**
  1. Verifies ownership of `section_id` by `current_teacher.id`. Returns `404 NOT_FOUND` if not found.
  2. Counts enrolled students:
     ```sql
     select count(*) from public.student where section_id = :section_id
     ```
  3. If count > 0, returns `409 Conflict`:
     ```json
     {
       "error": {
         "code": "SECTION_NOT_EMPTY",
         "message": "Cannot delete section with assigned students. Please reassign or unenroll students first.",
         "details": { "student_count": count }
       }
     }
     ```
  4. If count == 0, deletes from `public.section`.
- **Response:** `200 OK` with `{ "success": true, "deleted_id": section_id }`.

### 3.3 Student Integration (`backend/app/api/students.py`)
- `POST /api/students`:
  - Accepts `section_id: Optional[str] = None` or `section: Optional[str] = None`.
  - If `section_id` provided: validates ownership, sets `student.section_id = section_id`, sets `student.section = section.name`.
  - If only `section` string provided: looks up or creates matching section for teacher, sets both fields.
- `PATCH /api/students/{id}`:
  - Supports updating `section_id` and keeps `student.section` in sync.

---

## 4. Frontend UI/UX Architecture

### 4.1 Data Fetching (`frontend/lib/hooks/use-sections.ts`)
- `useSections()`: Fetches teacher sections via TanStack React Query (`queryKey: ["sections"]`).
- `useCreateSection()`: Mutation calling `POST /api/sections`. Invalidates `["sections"]`.
- `useUpdateSection()`: Mutation calling `PATCH /api/sections/{id}`. Invalidates `["sections"]` and `["students"]`.
- `useDeleteSection()`: Mutation calling `DELETE /api/sections/{id}`. Invalidates `["sections"]`.

### 4.2 Modal Component: `ManageSectionsDialog` (`frontend/components/roster/manage-sections-dialog.tsx`)
- **Trigger:** "Manage Sections" button in Roster page toolbar (icon: `FolderKanban` / `Layers`), beside "Bulk Add" and "Add Student".
- **Top Quick-Add Bar:**
  - Input: "New section name (e.g. Diamond, Pearl)"
  - Button: "Add Section" with spinner during mutation.
- **Section List:**
  - Responsive rows displaying Section Name, Student Count Badge (`X students`), and Row Actions.
  - **Inline Renaming:** Click Edit icon or name to enter inline edit state with Save and Cancel buttons.
  - **Safe Deletion:**
    - If `student_count > 0`: Trash button is disabled with assistive tooltip explaining students must be moved first.
    - If `student_count === 0`: Trash button is enabled. Clicking opens a shadcn `AlertDialog` confirming permanent removal.

### 4.3 Form Integrations
- **`StudentDialog` (`student-dialog.tsx`):**
  - Section field changes to a Select Combobox driven by `useSections()`, displaying existing sections and an inline "+ Create new section" prompt.
- **`BatchMoveDialog` (`batch-move-dialog.tsx`):**
  - Target section dropdown lists teacher's sections from `useSections()`.
- **`FilterPills` (`frontend/app/(teacher)/roster/page.tsx`):**
  - Powered by sections list, displaying real-time student counts per pill.

---

## 5. Security & Privacy

- **RLS Isolation:** Section records are strictly partitioned by `teacher_id = auth.uid()`. Cross-teacher read or write operations are rejected at both API and database layers.
- **Child Privacy / PII:** Sections only contain academic class names (e.g. "Grade 3 - Ruby"). No student PII is stored on the `section` table.
- **Audit Consistency:** Historical submissions and measurements remain intact regardless of section renaming, as they reference `student_id`.

---

## 6. Testing & Quality Assurance

### 6.1 Automated Pytest Suite (`backend/tests/api/test_sections.py`)
- `test_list_sections_empty`: returns empty list for new teacher.
- `test_create_section`: creates section and verifies response.
- `test_create_duplicate_section_fails`: returns 409 `SECTION_NAME_EXISTS`.
- `test_rename_section_syncs_students`: asserts student denormalized string updates.
- `test_delete_empty_section`: succeeds for 0-student section.
- `test_delete_section_with_students_blocked`: returns 409 `SECTION_NOT_EMPTY`.
- `test_cross_teacher_isolation`: unauthorized teacher cannot view or edit sections.

### 6.2 Frontend Type Safety & Linters
- Regenerate DB and OpenAPI TypeScript types.
- Ensure `npx tsc --noEmit`, `npx eslint .`, and `uv run ruff check .` pass with zero errors.

### 6.3 Manual QA Checklist
1. Open `/roster` and click **Manage Sections**.
2. Add new section "Diamond". Verify it appears immediately in the modal and Roster FilterPills.
3. Assign a student to "Diamond". Verify the badge shows "1 student".
4. Attempt to delete "Diamond": verify deletion is disabled / blocked with warning.
5. Rename "Diamond" to "Grade 3 - Diamond": verify student row and filter pill update instantly.
6. Move student to another section. Verify student count drops to 0.
7. Delete "Grade 3 - Diamond": confirm successful removal.

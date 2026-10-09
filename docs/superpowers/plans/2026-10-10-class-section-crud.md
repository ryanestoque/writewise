# Class Section Relational Subsystem Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a dedicated relational Class Section CRUD subsystem (table, RLS, FastAPI routes, TanStack Query hooks, and Roster management UI modal) while maintaining backward compatibility with existing student queries.

**Architecture:** Approach 1 (Hybrid Relational with Sync). A new `public.section` table owned by teachers is created, linked to `public.student.section_id` via FK constraint (`on delete restrict`), while synchronizing `student.section` as a denormalized string. FastAPI exposes `/api/sections` CRUD with student-count aggregation and strict deletion guards, connected to a `ManageSectionsDialog` component in the Teacher Portal.

**Tech Stack:** PostgreSQL (Supabase SQL migrations, RLS), Python 3.13 / FastAPI / Pydantic v2 / Pytest, Next.js 14 / TypeScript (strict) / Tailwind CSS / TanStack React Query / Radix UI (shadcn) / Sonner.

**Spec:** [`docs/superpowers/specs/2026-10-10-class-section-crud-design.md`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/docs/superpowers/specs/2026-10-10-class-section-crud-design.md)

## Global Constraints

- Never bypass RLS from app code; service-role key is never used in deployed API.
- All API errors must follow envelope `{ error: { code, message, details } }`.
- Frontend branches on `error.code` only — never on `message` text.
- TypeScript `strict: true` must remain clean (`npx tsc --noEmit`).
- Schema changes are versioned SQL migrations only (`supabase/migrations/*.sql`).
- Conventional Commits: `feat:`, `fix:`, `docs:`, `test:`, `chore:`.

---

### Task 1: Supabase Migration for `public.section` and `student.section_id`

**Files:**
- Create: `supabase/migrations/0020_class_sections.sql`
- Modify: `frontend/types/database.ts`

**Interfaces:**
- Produces: `public.section` table with `id`, `teacher_id`, `name`, `created_at`, `updated_at`, `UNIQUE(teacher_id, name)`
- Produces: `public.student.section_id` UUID column referencing `public.section(id)`
- Produces: RLS policy `"teacher can view own sections"` on `public.section`

- [ ] **Step 1: Write migration `0020_class_sections.sql`**

Create `supabase/migrations/0020_class_sections.sql` with the following content:

```sql
-- 1. Create public.section table
create table if not exists public.section (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.teacher(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_teacher_section_name unique (teacher_id, name)
);

-- Trigger for updated_at
drop trigger if exists set_section_updated_at on public.section;
create trigger set_section_updated_at
  before update on public.section
  for each row execute function public.set_updated_at();

-- 2. Link student to section
alter table public.student
  add column if not exists section_id uuid references public.section(id) on delete restrict;

-- 3. Backfill existing sections from current roster
insert into public.section (teacher_id, name)
select distinct ts.teacher_id, trim(s.section)
from public.teacher_student ts
join public.student s on s.id = ts.student_id
where s.section is not null and trim(s.section) <> ''
on conflict (teacher_id, name) do nothing;

-- 4. Backfill student.section_id
update public.student s
set section_id = sec.id
from public.teacher_student ts
join public.section sec on sec.teacher_id = ts.teacher_id and sec.name = trim(s.section)
where ts.student_id = s.id
  and s.section_id is null;

-- 5. Row Level Security
alter table public.section enable row level security;

drop policy if exists "teacher can view own sections" on public.section;
create policy "teacher can view own sections"
  on public.section for select
  using (teacher_id = auth.uid());
```

- [ ] **Step 2: Update TypeScript database types**

Add the `section` table definition and `section_id` field to `frontend/types/database.ts`:

In `frontend/types/database.ts` under `Database["public"]["Tables"]`:
```typescript
      section: {
        Row: {
          created_at: string
          id: string
          name: string
          teacher_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          teacher_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          teacher_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teacher"
            referencedColumns: ["id"]
          },
        ]
      }
```
And add `section_id: string | null` to `Database["public"]["Tables"]["student"]["Row"]`, `Insert`, and `Update`.

- [ ] **Step 3: Run database migration against dev/local Supabase**

Run SQL against Supabase database or verify via migration tool.

- [ ] **Step 4: Verify typecheck passes**

Run: `npx tsc --noEmit` in `frontend/`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0020_class_sections.sql frontend/types/database.ts
git commit -m "feat(db): add public.section table and student.section_id reference"
```

---

### Task 2: Backend API Endpoints (`/api/sections`) and Student Integration

**Files:**
- Create: `backend/app/api/sections.py`
- Create: `backend/tests/api/test_sections.py`
- Modify: `backend/app/main.py:40-60`
- Modify: `backend/app/api/students.py:10-35, 120-250`

**Interfaces:**
- Produces: `GET /api/sections` -> list of `{ id, name, student_count, created_at, updated_at }`
- Produces: `POST /api/sections` -> `{ id, name, student_count: 0, created_at, updated_at }`
- Produces: `PATCH /api/sections/{id}` -> `{ id, name, student_count, created_at, updated_at }`
- Produces: `DELETE /api/sections/{id}` -> `{ success: true, deleted_id: str }`
- Consumes: `get_current_teacher` dependency

- [ ] **Step 1: Write the failing tests in `backend/tests/api/test_sections.py`**

Create `backend/tests/api/test_sections.py`:

```python
import uuid
import pytest
from app.core.supabase import supabase_client
from tests.conftest import TEST_TEACHER_ID

@pytest.fixture
def cleanup_sections():
    section_ids = []
    yield section_ids
    for sid in section_ids:
        # Unlink students first if any
        supabase_client.table("student").update({"section_id": None}).eq("section_id", sid).execute()
        supabase_client.table("section").delete().eq("id", sid).execute()

def test_list_sections_empty_or_existing(client):
    response = client.get("/api/sections")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)

def test_create_section_success(client, cleanup_sections):
    name = f"TestSec_{uuid.uuid4().hex[:6]}"
    response = client.post("/api/sections", json={"name": name})
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == name
    assert data["student_count"] == 0
    cleanup_sections.append(data["id"])

def test_create_duplicate_section_fails(client, cleanup_sections):
    name = f"TestSec_{uuid.uuid4().hex[:6]}"
    res1 = client.post("/api/sections", json={"name": name})
    assert res1.status_code == 200
    cleanup_sections.append(res1.json()["id"])

    res2 = client.post("/api/sections", json={"name": name})
    assert res2.status_code == 409
    body = res2.json()
    assert body["error"]["code"] == "SECTION_NAME_EXISTS"

def test_rename_section_syncs_students(client, cleanup_sections):
    old_name = f"OldSec_{uuid.uuid4().hex[:6]}"
    new_name = f"NewSec_{uuid.uuid4().hex[:6]}"
    res = client.post("/api/sections", json={"name": old_name})
    sec_id = res.json()["id"]
    cleanup_sections.append(sec_id)

    # Create student in this section
    stu_res = client.post("/api/students", json={"full_name": "Test Student Sec", "section": old_name, "section_id": sec_id})
    stu_id = stu_res.json()["id"]

    try:
        # Rename section
        patch_res = client.patch(f"/api/sections/{sec_id}", json={"name": new_name})
        assert patch_res.status_code == 200
        assert patch_res.json()["name"] == new_name

        # Verify student.section was synced
        student_check = supabase_client.table("student").select("section").eq("id", stu_id).single().execute()
        assert student_check.data["section"] == new_name
    finally:
        supabase_client.table("student").delete().eq("id", stu_id).execute()

def test_delete_empty_section_success(client):
    name = f"EmptySec_{uuid.uuid4().hex[:6]}"
    create_res = client.post("/api/sections", json={"name": name})
    sec_id = create_res.json()["id"]

    del_res = client.delete(f"/api/sections/{sec_id}")
    assert del_res.status_code == 200
    assert del_res.json()["success"] is True

def test_delete_section_with_students_blocked(client, cleanup_sections):
    name = f"ActiveSec_{uuid.uuid4().hex[:6]}"
    create_res = client.post("/api/sections", json={"name": name})
    sec_id = create_res.json()["id"]
    cleanup_sections.append(sec_id)

    # Assign student
    stu_res = client.post("/api/students", json={"full_name": "Active Student", "section": name, "section_id": sec_id})
    stu_id = stu_res.json()["id"]

    try:
        del_res = client.delete(f"/api/sections/{sec_id}")
        assert del_res.status_code == 409
        assert del_res.json()["error"]["code"] == "SECTION_NOT_EMPTY"
    finally:
        supabase_client.table("student").delete().eq("id", stu_id).execute()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `uv run pytest backend/tests/api/test_sections.py -v`
Expected: FAIL with 404 Not Found (router not yet registered).

- [ ] **Step 3: Implement `backend/app/api/sections.py`**

Create `backend/app/api/sections.py`:

```python
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from app.api.deps import get_current_teacher
from app.core.supabase import supabase_client

router = APIRouter()

class SectionCreate(BaseModel):
    name: str = Field(..., min_length=1)

class SectionUpdate(BaseModel):
    name: str = Field(..., min_length=1)

class SectionResponse(BaseModel):
    id: str
    name: str
    student_count: int
    created_at: str
    updated_at: str

@router.get("", response_model=List[SectionResponse])
def list_sections(teacher: dict = Depends(get_current_teacher)):
    teacher_id = teacher.get("sub")
    
    # 1. Fetch teacher sections
    sec_res = (
        supabase_client.table("section")
        .select("*")
        .eq("teacher_id", teacher_id)
        .order("name")
        .execute()
    )
    sections = sec_res.data or []

    # 2. Fetch student counts for this teacher's roster
    # Join teacher_student and student
    ts_res = (
        supabase_client.table("teacher_student")
        .select("student:student_id(id, section_id)")
        .eq("teacher_id", teacher_id)
        .execute()
    )
    
    counts: dict[str, int] = {}
    for row in (ts_res.data or []):
        stu = row.get("student")
        if stu and stu.get("section_id"):
            sid = stu["section_id"]
            counts[sid] = counts.get(sid, 0) + 1

    return [
        SectionResponse(
            id=s["id"],
            name=s["name"],
            student_count=counts.get(s["id"], 0),
            created_at=s["created_at"],
            updated_at=s["updated_at"],
        )
        for s in sections
    ]

@router.post("", response_model=SectionResponse)
def create_section(section_in: SectionCreate, teacher: dict = Depends(get_current_teacher)):
    teacher_id = teacher.get("sub")
    trimmed_name = section_in.name.strip()
    if not trimmed_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "VALIDATION_ERROR", "message": "Section name cannot be empty", "details": {}}},
        )

    # Check uniqueness
    existing = (
        supabase_client.table("section")
        .select("id")
        .eq("teacher_id", teacher_id)
        .ilike("name", trimmed_name)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "SECTION_NAME_EXISTS",
                    "message": "A section with this name already exists.",
                    "details": {"name": trimmed_name},
                }
            },
        )

    res = (
        supabase_client.table("section")
        .insert({"teacher_id": teacher_id, "name": trimmed_name})
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=500, detail={"error": {"code": "INTERNAL_ERROR", "message": "Failed to create section", "details": {}}})

    row = res.data[0]
    return SectionResponse(
        id=row["id"],
        name=row["name"],
        student_count=0,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )

@router.patch("/{section_id}", response_model=SectionResponse)
def update_section(section_id: str, section_in: SectionUpdate, teacher: dict = Depends(get_current_teacher)):
    teacher_id = teacher.get("sub")
    trimmed_name = section_in.name.strip()
    if not trimmed_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": {"code": "VALIDATION_ERROR", "message": "Section name cannot be empty", "details": {}}},
        )

    # Verify ownership
    existing = (
        supabase_client.table("section")
        .select("*")
        .eq("id", section_id)
        .eq("teacher_id", teacher_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "Section not found", "details": {}}},
        )

    # Check name collision with another section
    collision = (
        supabase_client.table("section")
        .select("id")
        .eq("teacher_id", teacher_id)
        .neq("id", section_id)
        .ilike("name", trimmed_name)
        .execute()
    )
    if collision.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "SECTION_NAME_EXISTS",
                    "message": "Another section with this name already exists.",
                    "details": {"name": trimmed_name},
                }
            },
        )

    # Update section
    res = (
        supabase_client.table("section")
        .update({"name": trimmed_name})
        .eq("id", section_id)
        .execute()
    )
    updated = res.data[0]

    # Denormalization sync: update all students referencing this section_id
    supabase_client.table("student").update({"section": trimmed_name}).eq("section_id", section_id).execute()

    # Count students
    c_res = supabase_client.table("student").select("id", count="exact").eq("section_id", section_id).execute()
    count = c_res.count if c_res.count is not None else len(c_res.data or [])

    return SectionResponse(
        id=updated["id"],
        name=updated["name"],
        student_count=count,
        created_at=updated["created_at"],
        updated_at=updated["updated_at"],
    )

@router.delete("/{section_id}")
def delete_section(section_id: str, teacher: dict = Depends(get_current_teacher)):
    teacher_id = teacher.get("sub")

    # Verify ownership
    existing = (
        supabase_client.table("section")
        .select("id")
        .eq("id", section_id)
        .eq("teacher_id", teacher_id)
        .execute()
    )
    if not existing.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"error": {"code": "NOT_FOUND", "message": "Section not found", "details": {}}},
        )

    # Check if students are linked
    c_res = supabase_client.table("student").select("id", count="exact").eq("section_id", section_id).execute()
    count = c_res.count if c_res.count is not None else len(c_res.data or [])
    if count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "error": {
                    "code": "SECTION_NOT_EMPTY",
                    "message": "Cannot delete section with assigned students. Please reassign or unenroll students first.",
                    "details": {"student_count": count},
                }
            },
        )

    supabase_client.table("section").delete().eq("id", section_id).execute()
    return {"success": True, "deleted_id": section_id}
```

- [ ] **Step 4: Register `/api/sections` in `backend/app/main.py`**

In `backend/app/main.py`:
```python
from app.api import activities, sections, students, submissions
...
app.include_router(sections.router, prefix="/api/sections", tags=["sections"])
```

- [ ] **Step 5: Update `backend/app/api/students.py` to support `section_id`**

In `backend/app/api/students.py`:
- Update `StudentCreate`:
  ```python
  class StudentCreate(BaseModel):
      full_name: str
      section: Optional[str] = None
      section_id: Optional[str] = None
      parent_email: Optional[str] = None
  ```
- Update `StudentUpdate`:
  ```python
  class StudentUpdate(BaseModel):
      full_name: Optional[str] = None
      section: Optional[str] = None
      section_id: Optional[str] = None
      parent_email: Optional[str] = None
  ```
- In `create_student`:
  - If `student_in.section_id` is supplied: resolve section name, set `section_id` and `section`.
  - If `student_in.section` is supplied without `section_id`: lookup or auto-insert `public.section` for this teacher, set both.
- In `update_student`:
  - Apply similar resolution so `section_id` and `section` stay in lockstep.

- [ ] **Step 6: Run tests and verify they pass**

Run: `uv run pytest backend/tests/api/test_sections.py backend/tests/api/test_students.py -v`
Expected: PASS with 100% success.
Run: `uv run ruff check backend/`
Expected: All checks passed.

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/sections.py backend/app/main.py backend/app/api/students.py backend/tests/api/test_sections.py
git commit -m "feat(api): add /api/sections router and student section_id sync"
```

---

### Task 3: Frontend Data Fetching Hooks (`use-sections.ts`)

**Files:**
- Create: `frontend/lib/hooks/use-sections.ts`
- Modify: `frontend/lib/hooks/use-students.ts:1-85`

**Interfaces:**
- Produces: `useSections()`, `useCreateSection()`, `useUpdateSection()`, `useDeleteSection()`
- Produces: `export interface Section { id: string; name: string; student_count: number; created_at: string; updated_at: string }`

- [ ] **Step 1: Create `frontend/lib/hooks/use-sections.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export interface Section {
  id: string;
  name: string;
  student_count: number;
  created_at: string;
  updated_at: string;
}

export interface SectionCreateInput {
  name: string;
}

export interface SectionUpdateInput {
  name: string;
}

export function useSections() {
  return useQuery<Section[]>({
    queryKey: ["sections"],
    queryFn: async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Unauthorized");

      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${backendUrl}/api/sections`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }

      return res.json();
    },
    staleTime: 1000 * 30, // 30s
  });
}

export function useCreateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SectionCreateInput) => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Unauthorized");

      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${backendUrl}/api/sections`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(input),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
  });
}

export function useUpdateSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SectionUpdateInput }) => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Unauthorized");

      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${backendUrl}/api/sections/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
}

export function useDeleteSection() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Unauthorized");

      const backendUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const res = await fetch(`${backendUrl}/api/sections/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw err;
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
    },
  });
}
```

- [ ] **Step 2: Update `Student` interface in `frontend/lib/hooks/use-students.ts`**

Add `section_id?: string | null;` to the `Student` interface in `frontend/lib/hooks/use-students.ts`.

- [ ] **Step 3: Run linter and typecheck**

Run: `npx eslint frontend/lib/hooks/use-sections.ts`
Run: `npx tsc --noEmit` in `frontend/`
Expected: PASS with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/hooks/use-sections.ts frontend/lib/hooks/use-students.ts
git commit -m "feat(frontend): add useSections queries and mutation hooks"
```

---

### Task 4: `ManageSectionsDialog` Component

**Files:**
- Create: `frontend/components/roster/manage-sections-dialog.tsx`

**Interfaces:**
- Produces: `<ManageSectionsDialog open={isOpen} onOpenChange={setIsOpen} />`
- Consumes: `useSections()`, `useCreateSection()`, `useUpdateSection()`, `useDeleteSection()`

- [ ] **Step 1: Implement `frontend/components/roster/manage-sections-dialog.tsx`**

Build the modal with:
1. Header: Title "Manage Class Sections", description "Create, rename, or remove class sections for your roster."
2. Top bar: Text input + "Add Section" button with loading state.
3. List of sections:
   - Name label (or inline edit input when editing).
   - Badge: `{s.student_count} students` (primary pill for >0, muted for 0).
   - Edit button: activates inline editing mode with checkmark (save) and X (cancel).
   - Delete button:
     - Disabled with tooltip if `s.student_count > 0` ("Cannot delete: X students assigned. Move students first.").
     - Enabled if `s.student_count === 0`. Opens `AlertDialog` confirmation before deletion.
4. Error handling:
   - Catches `SECTION_NAME_EXISTS` -> toast "A section with this name already exists."
   - Catches `SECTION_NOT_EMPTY` -> toast "Cannot delete section while students are assigned."

- [ ] **Step 2: Run linter and typecheck**

Run: `npx eslint frontend/components/roster/manage-sections-dialog.tsx`
Run: `npx tsc --noEmit` in `frontend/`
Expected: PASS with 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/roster/manage-sections-dialog.tsx
git commit -m "feat(ui): add ManageSectionsDialog modal component"
```

---

### Task 5: Integrate Section Management into Roster Page and Dialogs

**Files:**
- Modify: `frontend/app/(teacher)/roster/page.tsx`
- Modify: `frontend/components/roster/student-dialog.tsx`
- Modify: `frontend/components/roster/batch-move-dialog.tsx`

**Interfaces:**
- Consumes: `ManageSectionsDialog` in `RosterPage`
- Consumes: `useSections()` in `StudentDialog` and `BatchMoveDialog`

- [ ] **Step 1: Add "Manage Sections" button to Roster page header**

In `frontend/app/(teacher)/roster/page.tsx`:
- Import `ManageSectionsDialog` and `FolderKanban` / `Layers` icon.
- Add `const [isManageSectionsOpen, setIsManageSectionsOpen] = useState(false);`
- In header actions (next to "Add Student" and "Bulk Add"), add:
  ```tsx
  <Button
    variant="outline"
    size="sm"
    onClick={() => setIsManageSectionsOpen(true)}
    className="gap-2"
  >
    <FolderKanban className="w-4 h-4 text-muted-foreground" />
    <span>Manage Sections</span>
  </Button>
  ```
- Render `<ManageSectionsDialog open={isManageSectionsOpen} onOpenChange={setIsManageSectionsOpen} />`.

- [ ] **Step 2: Update `StudentDialog` to use `useSections()`**

In `frontend/components/roster/student-dialog.tsx`:
- Hook: call `useSections()`.
- Section selector: render options from `sections.map(s => s.name)`.
- If teacher wants a new section not in list, provide "+ Create new section..." item that opens a quick prompt or transitions to custom input.
- Pass `section_id` when available to `useCreateStudent` / `useUpdateStudent`.

- [ ] **Step 3: Update `BatchMoveDialog` to use `useSections()`**

In `frontend/components/roster/batch-move-dialog.tsx`:
- Hook: call `useSections()`.
- Populate target section options from `sections.map(s => s.name)` with student count badges.

- [ ] **Step 4: Verify typecheck and linting**

Run: `npx eslint frontend/app/(teacher)/roster/page.tsx frontend/components/roster/student-dialog.tsx frontend/components/roster/batch-move-dialog.tsx`
Run: `npx tsc --noEmit` in `frontend/`
Expected: PASS with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/(teacher)/roster/page.tsx frontend/components/roster/student-dialog.tsx frontend/components/roster/batch-move-dialog.tsx
git commit -m "feat(roster): integrate section management and selection across roster views"
```

---

### Task 6: End-to-End Verification and Documentation Update

**Files:**
- Modify: `IMPLEMENTATION_STATUS.md`

- [ ] **Step 1: Run full backend verification**

Run: `uv run ruff check backend/`
Run: `uv run pytest backend/tests/api/test_sections.py backend/tests/api/test_students.py -v`
Expected: ALL PASS.

- [ ] **Step 2: Run full frontend verification**

Run: `npx eslint frontend/`
Run: `npx tsc --noEmit` in `frontend/`
Expected: ALL PASS.

- [ ] **Step 3: Update `IMPLEMENTATION_STATUS.md`**

Add section detailing the Phase 1 Class Section Relational Subsystem (Migration `0020_class_sections.sql`, `/api/sections` CRUD, `ManageSectionsDialog`).

- [ ] **Step 4: Commit**

```bash
git add IMPLEMENTATION_STATUS.md
git commit -m "docs: document class section relational subsystem in implementation status"
```

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-10-10-class-section-crud.md`.

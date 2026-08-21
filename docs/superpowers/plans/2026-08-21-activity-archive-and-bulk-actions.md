# Activity Archive & Bulk Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace client-side `localStorage` archiving with a database-backed `is_archived` column, expose archive/unarchive via the backend API, and add multi-select bulk archive/unarchive on the activities list page.

**Architecture:**
1. **Task 1 (DB + API):** Add `is_archived boolean NOT NULL DEFAULT false` to `public.activity`, wire RLS UPDATE policy, add `/api/activities/{id}/archive` toggle endpoint and a `/api/activities/bulk-archive` batch endpoint.
2. **Task 2 (Frontend hooks):** Add `useToggleArchive` and `useBulkArchive` mutations to `use-activities.ts`; update `Activity` type to include `is_archived`; update the `useActivities` query to select the new column.
3. **Task 3 (Page UI):** Remove `localStorage` archiving state from `activities/page.tsx`, wire the new hooks, and add multi-select checkboxes with a floating bulk-action bar.

**Tech Stack:** PostgreSQL (Supabase), FastAPI (Python/Pydantic), Next.js 14, TanStack Query v5, shadcn/ui, Tailwind CSS v4.

**Spec:** Derived from `/impeccable critique` findings for `http://localhost:3000/activities` (2026-08-21). P2 issues: server-synced archiving and bulk actions.

## Global Constraints

- `strict: true` TypeScript — no `any` unless forced by an existing boundary.
- Backend error envelope: `{ error: { code, message, details } }` — frontend branches only on `error.code`, never `error.message`.
- Never bypass RLS from app code; service-role key is off-limits here.
- No multi-worker change; single Uvicorn worker.
- No automated dependency bots; no new packages unless absolutely needed.
- SQL-first migrations: every schema change must be a versioned `.sql` file in `supabase/migrations/`.
- After a migration is added, regenerate types: `supabase gen types typescript --project-id <dev-project-id> > frontend/src/types/database.ts`.
- RLS `UPDATE` requires both `USING` and `WITH CHECK`.
- Conventional Commits: `feat:`, `fix:`, `chore:` prefixes.

---

## Task 1: Database Migration + Backend Archive Endpoints

**Files:**
- Create: `supabase/migrations/0012_activity_archive.sql`
- Modify: `backend/app/api/activities.py`

**Interfaces:**
- Produces:
  - `PATCH /api/activities/{id}/archive` → `{ id: str, is_archived: bool }`
  - `POST /api/activities/bulk-archive` body `{ ids: list[str], archived: bool }` → `{ updated: list[str], skipped: list[str] }`
  - `activity` table gains `is_archived` column; existing SELECT queries unaffected because `useActivities` opts-in by selecting it.

---

- [ ] **Step 1: Create the migration file**

  ```bash
  # In repo root
  supabase migration new activity_archive
  ```
  This creates `supabase/migrations/0012_activity_archive.sql`. Open it and replace its contents with the SQL below.

- [ ] **Step 2: Write the migration SQL**

  Fill `supabase/migrations/0012_activity_archive.sql` with:

  ```sql
  -- Add is_archived column to activity table
  alter table public.activity
    add column if not exists is_archived boolean not null default false;

  -- Index to speed up the common filter "active activities for this teacher"
  create index if not exists activity_teacher_active_idx
    on public.activity (created_by, is_archived)
    where is_archived = false;

  -- RLS: allow teacher to toggle archive state only on own activities
  create policy "teacher can update own activity archive flag"
    on public.activity for update
    to authenticated
    using  ((select auth.uid()) = created_by)
    with check ((select auth.uid()) = created_by);
  ```

- [ ] **Step 3: Apply the migration to dev**

  ```bash
  supabase db push --local
  ```
  Or if using the hosted dev project:
  ```bash
  supabase db push
  ```
  Verify with `supabase migration list`.

- [ ] **Step 4: Regenerate TypeScript types**

  ```bash
  supabase gen types typescript --project-id <dev-project-id> > frontend/src/types/database.ts
  ```

- [ ] **Step 5: Add Pydantic schemas for archive endpoints to `backend/app/api/activities.py`**

  Open `backend/app/api/activities.py`. Add these two classes after the existing `ActivityUpdate` class (around line 36):

  ```python
  class ActivityBulkArchiveRequest(BaseModel):
      ids: list[str]
      archived: bool


  class ActivityBulkArchiveResponse(BaseModel):
      updated: list[str]
      skipped: list[str]
  ```

- [ ] **Step 6: Add the single-activity archive toggle endpoint**

  Add this route after the existing `@router.patch("/{activity_id}")` handler:

  ```python
  @router.patch("/{activity_id}/archive")
  def toggle_archive_activity(
      activity_id: str,
      teacher: dict = Depends(get_current_teacher),
  ):
      teacher_id = teacher.get("sub")

      # Verify ownership
      existing_res = (
          supabase_client.table("activity")
          .select("id, is_archived")
          .eq("id", activity_id)
          .eq("created_by", teacher_id)
          .execute()
      )
      if not existing_res.data:
          raise HTTPException(
              status_code=404,
              detail={
                  "code": "NOT_FOUND",
                  "message": "Activity not found or you do not have permission to archive it",
                  "details": {},
              },
          )

      current = existing_res.data[0]
      new_archived = not current["is_archived"]

      res = (
          supabase_client.table("activity")
          .update({"is_archived": new_archived})
          .eq("id", activity_id)
          .execute()
      )
      if not res.data:
          raise HTTPException(
              status_code=500,
              detail={
                  "code": "INTERNAL_ERROR",
                  "message": "Failed to toggle archive state",
                  "details": {},
              },
          )

      return {"id": activity_id, "is_archived": new_archived}
  ```

- [ ] **Step 7: Add the bulk archive endpoint**

  Add this route after the toggle endpoint above:

  ```python
  @router.post("/bulk-archive")
  def bulk_archive_activities(
      body: ActivityBulkArchiveRequest,
      teacher: dict = Depends(get_current_teacher),
  ):
      teacher_id = teacher.get("sub")

      if not body.ids:
          return ActivityBulkArchiveResponse(updated=[], skipped=[])

      # Fetch all activities the teacher owns from the provided IDs
      existing_res = (
          supabase_client.table("activity")
          .select("id")
          .in_("id", body.ids)
          .eq("created_by", teacher_id)
          .execute()
      )

      owned_ids = [row["id"] for row in (existing_res.data or [])]
      skipped_ids = [aid for aid in body.ids if aid not in owned_ids]

      if not owned_ids:
          return ActivityBulkArchiveResponse(updated=[], skipped=skipped_ids)

      res = (
          supabase_client.table("activity")
          .update({"is_archived": body.archived})
          .in_("id", owned_ids)
          .execute()
      )
      if res.data is None:
          raise HTTPException(
              status_code=500,
              detail={
                  "code": "INTERNAL_ERROR",
                  "message": "Failed to bulk archive activities",
                  "details": {},
              },
          )

      return ActivityBulkArchiveResponse(updated=owned_ids, skipped=skipped_ids)
  ```

  > **Route order note.** `POST /bulk-archive` won't conflict with `PATCH /{activity_id}` (different HTTP methods), but verify it doesn't conflict with `GET /` or similar. Check `app/main.py` if the bulk-archive endpoint returns a 404.

- [ ] **Step 8: Lint and verify backend starts**

  ```bash
  uv run ruff check .
  # Restart uvicorn; visit http://localhost:8000/docs
  # Confirm these routes appear:
  # PATCH /activities/{activity_id}/archive
  # POST  /activities/bulk-archive
  ```

- [ ] **Step 9: Commit**

  ```bash
  git add supabase/migrations/0012_activity_archive.sql backend/app/api/activities.py
  git commit -m "feat: add is_archived column and archive toggle/bulk endpoints"
  ```

---

## Task 2: Frontend Hooks — Archive Mutations & Updated Activity Type

**Files:**
- Modify: `frontend/lib/hooks/use-activities.ts`

**Interfaces:**
- Consumes: backend endpoints from Task 1.
- Produces:
  - `Activity` interface gains `is_archived: boolean`
  - `useToggleArchive()` → `useMutation` taking `id: string`, returns `{ id: string; is_archived: boolean }`
  - `useBulkArchive()` → `useMutation` taking `{ ids: string[]; archived: boolean }`, returns `{ updated: string[]; skipped: string[] }`
  - `useActivities()` selects `is_archived` column

---

- [ ] **Step 1: Update the `Activity` interface**

  In `frontend/lib/hooks/use-activities.ts`, change:

  ```typescript
  // BEFORE
  export interface Activity {
    id: string;
    target_text: string;
    is_take_home: boolean;
    created_by: string;
    created_at: string;
    submissions?: ActivitySubmissionSummary[];
  }

  // AFTER
  export interface Activity {
    id: string;
    target_text: string;
    is_take_home: boolean;
    is_archived: boolean;
    created_by: string;
    created_at: string;
    submissions?: ActivitySubmissionSummary[];
  }
  ```

- [ ] **Step 2: Update `useActivities` and `useActivity` select strings**

  ```typescript
  // useActivities — BEFORE
  .select(
    "id, target_text, is_take_home, created_by, created_at, submissions:submission(id, status)"
  )

  // useActivities — AFTER
  .select(
    "id, target_text, is_take_home, is_archived, created_by, created_at, submissions:submission(id, status)"
  )

  // useActivity — BEFORE
  .select("id, target_text, is_take_home, created_by, created_at")

  // useActivity — AFTER
  .select("id, target_text, is_take_home, is_archived, created_by, created_at")
  ```

- [ ] **Step 3: Add `useToggleArchive` mutation**

  Append to the bottom of `frontend/lib/hooks/use-activities.ts`:

  ```typescript
  export function useToggleArchive() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (id: string) => {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token) {
          throw new Error("No active session");
        }

        const response = await fetch(`/api/activities/${id}/archive`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${token}` },
        });

        const data = await response.json();

        if (!response.ok) {
          console.error("Backend returned error:", data.error);
          throw data.error;
        }

        return data as { id: string; is_archived: boolean };
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["activities"] });
      },
    });
  }
  ```

- [ ] **Step 4: Add `useBulkArchive` mutation**

  Append to the bottom of `frontend/lib/hooks/use-activities.ts`:

  ```typescript
  export function useBulkArchive() {
    const supabase = createClient();
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn: async (payload: { ids: string[]; archived: boolean }) => {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;

        if (!token) {
          throw new Error("No active session");
        }

        const response = await fetch("/api/activities/bulk-archive", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json();

        if (!response.ok) {
          console.error("Backend returned error:", data.error);
          throw data.error;
        }

        return data as { updated: string[]; skipped: string[] };
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["activities"] });
      },
    });
  }
  ```

- [ ] **Step 5: Type-check and lint**

  ```bash
  npx tsc --noEmit
  npx eslint .
  ```

- [ ] **Step 6: Commit**

  ```bash
  git add frontend/lib/hooks/use-activities.ts
  git commit -m "feat: add is_archived to Activity type, useToggleArchive and useBulkArchive hooks"
  ```

---

## Task 3: Activities Page — Remove localStorage, Wire DB Archive, Add Multi-Select Bulk Bar

**Files:**
- Modify: `frontend/app/(teacher)/activities/page.tsx`

**Interfaces:**
- Consumes: `useToggleArchive()`, `useBulkArchive()`, and `Activity.is_archived` from Task 2.
- Produces: multi-select checkboxes on cards, floating bulk-action bar, server-synced archive state.

---

- [ ] **Step 1: Remove localStorage archive state**

  Delete from `frontend/app/(teacher)/activities/page.tsx`:
  - The `ARCHIVE_STORAGE_KEY` constant (around line 62).
  - The `archivedIds` `useState` with its `localStorage` initialization (around lines 107–118).
  - The `handleToggleArchive` `useCallback` (around lines 120–141).

- [ ] **Step 2: Update imports**

  ```typescript
  // BEFORE
  import { type Activity, useActivities } from "@/lib/hooks/use-activities";

  // AFTER
  import {
    type Activity,
    useActivities,
    useToggleArchive,
    useBulkArchive,
  } from "@/lib/hooks/use-activities";
  ```

- [ ] **Step 3: Add multi-select state and wire new hooks**

  Inside `ActivitiesPage`, after the existing state declarations:

  ```typescript
  const { mutate: toggleArchive } = useToggleArchive();
  const { mutate: bulkArchive, isPending: isBulkPending } = useBulkArchive();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const isSelectMode = selectedIds.size > 0;

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredAndSortedActivities.map((a) => a.id)));
  }, [filteredAndSortedActivities]);

  const handleClearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleBulkArchive = useCallback(
    (archived: boolean) => {
      const ids = Array.from(selectedIds);
      bulkArchive(
        { ids, archived },
        {
          onSuccess: (result) => {
            const count = result.updated.length;
            toast.success(
              archived
                ? `${count} ${count === 1 ? "activity" : "activities"} archived.`
                : `${count} ${count === 1 ? "activity" : "activities"} restored.`
            );
            setSelectedIds(new Set());
          },
          onError: () => {
            toast.error("Failed to update activities. Please try again.");
          },
        }
      );
    },
    [selectedIds, bulkArchive]
  );
  ```

- [ ] **Step 4: Update `counts` memo — replace `archivedIds.has()` with `a.is_archived`**

  ```typescript
  const counts = useMemo(() => {
    if (!activities) return { all: 0, in_class: 0, take_home: 0, archived: 0 };
    const archivedList = activities.filter((a) => a.is_archived);
    const activeList = activities.filter((a) => !a.is_archived);
    return {
      all: activeList.length,
      in_class: activeList.filter((a) => !a.is_take_home).length,
      take_home: activeList.filter((a) => a.is_take_home).length,
      archived: archivedList.length,
    };
  }, [activities]);
  ```

- [ ] **Step 5: Update `filteredAndSortedActivities` memo — remove `archivedIds` dependency**

  ```typescript
  const filteredAndSortedActivities = useMemo(() => {
    if (!activities) return [];

    let result = activities;
    if (filterType === "archived") {
      result = result.filter((a) => a.is_archived);
    } else {
      result = result.filter((a) => !a.is_archived);
      if (filterType === "in_class") result = result.filter((a) => !a.is_take_home);
      else if (filterType === "take_home") result = result.filter((a) => a.is_take_home);
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((a) => a.target_text.toLowerCase().includes(query));
    }

    return [...result].sort((a, b) => {
      if (sortBy === "newest")
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      if (sortBy === "oldest")
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      const countA = a.submissions?.length ?? 0;
      const countB = b.submissions?.length ?? 0;
      if (sortBy === "most_submissions") return countB - countA;
      if (sortBy === "least_submissions") return countA - countB;
      return 0;
    });
  }, [activities, searchQuery, filterType, sortBy]);
  ```

- [ ] **Step 6: Wire single-activity archive in the 3-dot dropdown**

  Inside each card, replace the Archive/Unarchive `DropdownMenuItem`. Change `isArchived` (old local var) to `activity.is_archived`, and the `onClick` to:

  ```tsx
  onClick={() => {
    toggleArchive(activity.id, {
      onSuccess: (result) => {
        toast.success(
          result.is_archived
            ? "Activity moved to archive."
            : "Activity restored from archive."
        );
      },
      onError: () => {
        toast.error("Failed to update archive state.");
      },
    });
  }}
  ```

  Replace every remaining reference to the old `isArchived` local var with `activity.is_archived`.

- [ ] **Step 7: Add checkbox to each card**

  The card's outer `<div>` already has the `group` class. Add `relative` if it isn't there. Then, as the first child inside the card `<div>`:

  ```tsx
  {/* Selection checkbox */}
  <div
    className={`absolute top-3 left-3 z-10 transition-opacity ${
      isSelectMode ? "opacity-100" : "opacity-0 group-hover:opacity-100"
    }`}
  >
    <input
      type="checkbox"
      checked={selectedIds.has(activity.id)}
      onChange={() => handleToggleSelect(activity.id)}
      aria-label={`Select "${activity.target_text.slice(0, 40)}"`}
      className="size-4 rounded border-border accent-primary cursor-pointer"
    />
  </div>
  ```

  Add `onClick={isSelectMode ? () => handleToggleSelect(activity.id) : undefined}` to the outer card `<div>` so clicking anywhere on the card toggles selection while in select mode.

- [ ] **Step 8: Clear selection when filter tab changes**

  Update each filter button's `onClick`:

  ```tsx
  onClick={() => { setFilterType("all"); setSelectedIds(new Set()); }}
  onClick={() => { setFilterType("in_class"); setSelectedIds(new Set()); }}
  onClick={() => { setFilterType("take_home"); setSelectedIds(new Set()); }}
  onClick={() => { setFilterType("archived"); setSelectedIds(new Set()); }}
  ```

- [ ] **Step 9: Add floating bulk-action bar**

  Before the `<CreateActivityDialog>` portal at the bottom of the JSX:

  ```tsx
  {isSelectMode && (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-foreground text-background shadow-xl border border-border/20 animate-in slide-in-from-bottom-4 fade-in-0 duration-200"
      role="toolbar"
      aria-label="Bulk activity actions"
    >
      <span className="text-xs font-semibold tabular-nums pr-1 border-r border-background/20 mr-1">
        {selectedIds.size} selected
      </span>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={handleSelectAll}
        className="h-7 px-2.5 text-xs text-background/80 hover:text-background hover:bg-background/10"
      >
        Select All
      </Button>
      {filterType !== "archived" && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isBulkPending}
          onClick={() => handleBulkArchive(true)}
          className="h-7 px-2.5 text-xs text-background/80 hover:text-background hover:bg-background/10 flex items-center gap-1.5"
        >
          <Archive className="size-3.5" />
          Archive
        </Button>
      )}
      {filterType === "archived" && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={isBulkPending}
          onClick={() => handleBulkArchive(false)}
          className="h-7 px-2.5 text-xs text-background/80 hover:text-background hover:bg-background/10 flex items-center gap-1.5"
        >
          <ArchiveRestore className="size-3.5" />
          Unarchive
        </Button>
      )}
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={handleClearSelection}
        className="h-7 w-7 p-0 text-background/70 hover:text-background hover:bg-background/10"
        aria-label="Clear selection"
      >
        <X className="size-3.5" />
      </Button>
    </div>
  )}
  ```

  (`Archive`, `ArchiveRestore`, `X` are already imported in the page file.)

- [ ] **Step 10: Type-check and lint**

  ```bash
  npx tsc --noEmit
  npx eslint .
  ```

- [ ] **Step 11: Manual QA checklist**

  - [ ] Archive single activity via 3-dot menu → card moves to Archived tab immediately.
  - [ ] Reload page → still archived (DB-backed, not localStorage).
  - [ ] Open incognito tab → same archived list (confirms cross-device sync works).
  - [ ] Hover a card → checkbox fades in.
  - [ ] Check a card → bulk bar appears with count.
  - [ ] Select multiple → click "Archive" → all move to archived tab, bar disappears, toast shows count.
  - [ ] Switch to Archived tab → select multiple → "Unarchive" → all restored.
  - [ ] Click "Select All" → all visible cards selected.
  - [ ] Switch filter tab → selection clears automatically.

- [ ] **Step 12: Commit**

  ```bash
  git add frontend/app/(teacher)/activities/page.tsx
  git commit -m "feat: replace localStorage archive with DB-backed state, add multi-select bulk archive"
  ```

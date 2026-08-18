# Activity Creation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Activity creation backend endpoint, frontend data hooks, Activities list page (card grid), Create Activity dialog, and Activity detail page shell.

**Architecture:** Backend `POST /api/activities` follows the same pattern as `students.py` — Pydantic model, `get_current_teacher` dep, Supabase insert, bare resource response. Frontend reads use direct Supabase queries (RLS-gated), writes go through FastAPI. The Activities list uses a card grid (not a data table), and clicking a card navigates to `/activities/[id]` which shows activity info + a placeholder submissions section.

**Tech Stack:** FastAPI, Pydantic v2, supabase-py (backend); Next.js, React, TanStack Query, shadcn/ui, Zod, react-hook-form, Lucide icons (frontend)

**Spec:** `docs/superpowers/specs/2026-08-18-activity-creation-design.md`

## Global Constraints

- TypeScript `strict: true` — don't relax it
- Python: ruff for lint and format
- API errors use envelope `{ error: { code, message, details } }`; frontend branches on `error.code` only
- Actor-derived fields (`created_by`) come from JWT, never accepted from request body
- Success responses are bare — no `{ data: ... }` wrapper
- Activity list reads are direct Supabase reads (RLS-gated: `created_by = auth.uid()`)
- Activity writes go through FastAPI (`POST /api/activities`)
- Follow existing component patterns from the roster feature (dialog structure, empty states, search bar, button styles)
- Conventional Commits for all commits

---

### Task 1: Backend — `POST /api/activities` Endpoint + Tests

**Files:**
- Create: `backend/app/api/activities.py`
- Modify: `backend/app/main.py` (lines 5, 43 — add import + router registration)
- Create: `backend/tests/api/test_activities.py`

**Interfaces:**
- Consumes: `get_current_teacher` from `app.api.deps` (returns `{"sub": teacher_id, "role": "teacher"}`)
- Consumes: `supabase_client` from `app.core.supabase`
- Produces: `POST /api/activities` endpoint — accepts `{"target_text": str, "is_take_home": bool}`, returns `{"id", "target_text", "is_take_home", "created_by", "created_at"}` with status 201

- [ ] **Step 1: Write the test file for `POST /api/activities`**

Create `backend/tests/api/test_activities.py`:

```python
import pytest

from app.core.supabase import supabase_client
from tests.conftest import TEST_TEACHER_ID


@pytest.fixture
def cleanup_activities():
    activity_ids = []
    yield activity_ids
    for aid in activity_ids:
        supabase_client.table("activity").delete().eq("id", aid).execute()


def test_create_activity(client, cleanup_activities):
    payload = {"target_text": "the quick brown fox", "is_take_home": False}
    response = client.post("/api/activities", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert "id" in data
    assert data["target_text"] == "the quick brown fox"
    assert data["is_take_home"] is False
    assert data["created_by"] == TEST_TEACHER_ID
    assert "created_at" in data

    cleanup_activities.append(data["id"])

    # Verify in DB
    res = (
        supabase_client.table("activity")
        .select("*")
        .eq("id", data["id"])
        .execute()
    )
    assert len(res.data) == 1
    assert res.data[0]["target_text"] == "the quick brown fox"
    assert res.data[0]["created_by"] == TEST_TEACHER_ID


def test_create_take_home_activity(client, cleanup_activities):
    payload = {"target_text": "cursive letters a b c", "is_take_home": True}
    response = client.post("/api/activities", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["is_take_home"] is True
    assert data["target_text"] == "cursive letters a b c"

    cleanup_activities.append(data["id"])


def test_create_activity_defaults_not_take_home(client, cleanup_activities):
    payload = {"target_text": "hello world"}
    response = client.post("/api/activities", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["is_take_home"] is False

    cleanup_activities.append(data["id"])


def test_create_activity_empty_text_fails(client):
    payload = {"target_text": "   ", "is_take_home": False}
    response = client.post("/api/activities", json=payload)
    assert response.status_code == 422
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend
uv run pytest tests/api/test_activities.py -v
```

Expected: FAIL — `POST /api/activities` returns 404 (route not registered)

- [ ] **Step 3: Create `backend/app/api/activities.py`**

```python
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator

from app.api.deps import get_current_teacher
from app.core.supabase import supabase_client

router = APIRouter()


class ActivityCreate(BaseModel):
    target_text: str
    is_take_home: bool = False

    @field_validator("target_text")
    @classmethod
    def target_text_not_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("Target text must not be blank")
        return v


@router.post("", status_code=status.HTTP_201_CREATED)
def create_activity(
    activity_in: ActivityCreate,
    teacher: dict = Depends(get_current_teacher),
):
    teacher_id = teacher.get("sub")

    res = (
        supabase_client.table("activity")
        .insert(
            {
                "target_text": activity_in.target_text,
                "is_take_home": activity_in.is_take_home,
                "created_by": teacher_id,
            }
        )
        .execute()
    )

    if not res.data:
        raise HTTPException(
            status_code=500,
            detail={
                "code": "INTERNAL_ERROR",
                "message": "Failed to create activity",
                "details": {},
            },
        )

    activity = res.data[0]

    return {
        "id": activity["id"],
        "target_text": activity["target_text"],
        "is_take_home": activity["is_take_home"],
        "created_by": activity["created_by"],
        "created_at": activity["created_at"],
    }
```

- [ ] **Step 4: Register the router in `backend/app/main.py`**

Add the import alongside the existing students import:

```python
from app.api.activities import router as activities_router
```

Add the router registration after the existing students line:

```python
app.include_router(activities_router, prefix="/api/activities", tags=["activities"])
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend
uv run pytest tests/api/test_activities.py -v
```

Expected: All 4 tests PASS

- [ ] **Step 6: Run lint**

```bash
cd backend
uv run ruff check .
```

Expected: Clean

- [ ] **Step 7: Commit**

```bash
git add backend/app/api/activities.py backend/app/main.py backend/tests/api/test_activities.py
git commit -m "feat: add POST /api/activities endpoint with tests"
```

---

### Task 2: Frontend — Data Layer (`use-activities` Hook)

**Files:**
- Create: `frontend/lib/hooks/use-activities.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client`
- Consumes: `POST /api/activities` (from Task 1)
- Produces: `Activity` type — `{ id: string, target_text: string, is_take_home: boolean, created_by: string, created_at: string }`
- Produces: `useActivities()` — returns TanStack Query result for the activity list, query key `["activities"]`
- Produces: `useActivity(id: string)` — returns TanStack Query result for a single activity, query key `["activities", id]`
- Produces: `useCreateActivity()` — returns TanStack mutation for `POST /api/activities`

- [ ] **Step 1: Create `frontend/lib/hooks/use-activities.ts`**

```typescript
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "../supabase/client";

export interface Activity {
  id: string;
  target_text: string;
  is_take_home: boolean;
  created_by: string;
  created_at: string;
}

export function useActivities() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity")
        .select("id, target_text, is_take_home, created_by, created_at")
        .order("created_at", { ascending: false });

      if (error) {
        throw new Error(error.message);
      }

      return data as unknown as Activity[];
    },
  });
}

export function useActivity(id: string) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["activities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity")
        .select("id, target_text, is_take_home, created_by, created_at")
        .eq("id", id)
        .single();

      if (error) {
        throw new Error(error.message);
      }

      return data as unknown as Activity;
    },
    enabled: !!id,
  });
}

export function useCreateActivity() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (activityData: {
      target_text: string;
      is_take_home?: boolean;
    }) => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      if (!token) {
        throw new Error("No active session");
      }

      const response = await fetch("/api/activities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(activityData),
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("Backend returned error:", data.error);
        throw data.error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
  });
}
```

- [ ] **Step 2: Run type check**

```bash
cd frontend
npx tsc --noEmit
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/hooks/use-activities.ts
git commit -m "feat: add useActivities, useActivity, useCreateActivity hooks"
```

---

### Task 3: Frontend — Create Activity Dialog

**Files:**
- Create: `frontend/components/activities/create-activity-dialog.tsx`

**Interfaces:**
- Consumes: `useCreateActivity` from `@/lib/hooks/use-activities` (from Task 2)
- Produces: `<CreateActivityDialog open onOpenChange />` component — a dialog with target text textarea, take-home switch, live word count, and submit button

- [ ] **Step 1: Create `frontend/components/activities/create-activity-dialog.tsx`**

```tsx
"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Field,
  FieldLabel,
  FieldGroup,
  FieldError,
  FieldContent,
} from "@/components/ui/field";
import { useCreateActivity } from "@/lib/hooks/use-activities";
import { Loader2, Plus, ClipboardList, Home } from "lucide-react";
import { toast } from "sonner";

const activitySchema = z.object({
  target_text: z
    .string()
    .min(1, "Target text is required")
    .refine((v) => v.trim().length > 0, "Target text must not be blank"),
  is_take_home: z.boolean(),
});

type ActivityFormValues = z.infer<typeof activitySchema>;

function getWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

interface CreateActivityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateActivityDialog({
  open,
  onOpenChange,
}: CreateActivityDialogProps) {
  const { mutate: createActivity, isPending } = useCreateActivity();

  const form = useForm<ActivityFormValues>({
    resolver: zodResolver(activitySchema),
    defaultValues: {
      target_text: "",
      is_take_home: false,
    },
  });

  const targetText = form.watch("target_text");
  const isTakeHome = form.watch("is_take_home");
  const wordCount = getWordCount(targetText);

  useEffect(() => {
    if (open) {
      form.reset({ target_text: "", is_take_home: false });
    }
  }, [open, form]);

  const onSubmit = (data: ActivityFormValues) => {
    createActivity(
      {
        target_text: data.target_text,
        is_take_home: data.is_take_home,
      },
      {
        onSuccess: () => {
          toast.success("Activity created successfully.");
          onOpenChange(false);
        },
        onError: (error: Error) => {
          toast.error(error.message || "Failed to create activity.");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100%-1.5rem)] max-w-lg sm:max-w-[520px] max-h-[min(92dvh,calc(100vh-2rem))] flex flex-col p-5 sm:p-6 rounded-2xl sm:rounded-3xl gap-0 overflow-hidden shadow-xl border border-border/80 bg-surface dark:bg-card">
        <DialogHeader className="pb-3 sm:pb-4 shrink-0 text-left">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
              <Plus className="size-5" />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="font-heading text-lg sm:text-xl font-semibold tracking-tight text-foreground">
                Create Activity
              </DialogTitle>
              <DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Define the target text students will copy in cursive.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col flex-1 min-h-0 overflow-hidden pt-1"
        >
          <div className="space-y-4 overflow-y-auto overflow-x-hidden overscroll-contain px-1 py-1 flex-1 min-h-0">
            <FieldGroup className="space-y-4">
              {/* Target Text */}
              <Field data-invalid={!!form.formState.errors.target_text}>
                <FieldLabel
                  htmlFor="target_text"
                  className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                >
                  Target Text{" "}
                  <span className="text-destructive" aria-hidden="true">
                    *
                  </span>
                </FieldLabel>
                <FieldContent>
                  <Textarea
                    id="target_text"
                    {...form.register("target_text")}
                    aria-invalid={!!form.formState.errors.target_text}
                    aria-describedby={
                      form.formState.errors.target_text
                        ? "target_text-error target_text_hint"
                        : "target_text_hint"
                    }
                    aria-required="true"
                    placeholder="e.g., the quick brown fox jumps over the lazy dog"
                    className="min-h-24 text-base sm:text-sm rounded-lg sm:rounded-xl"
                    autoFocus
                  />
                </FieldContent>
                <div className="flex items-center justify-between mt-1.5">
                  <p
                    id="target_text_hint"
                    className="text-xs text-muted-foreground leading-normal"
                  >
                    Students will copy this text in cursive handwriting.
                  </p>
                  <span
                    className="text-xs font-medium text-muted-foreground tabular-nums shrink-0 ml-2"
                    aria-live="polite"
                    aria-label={`${wordCount} ${wordCount === 1 ? "word" : "words"}`}
                  >
                    {wordCount} {wordCount === 1 ? "word" : "words"}
                  </span>
                </div>
                <FieldError
                  id="target_text-error"
                  errors={[form.formState.errors.target_text]}
                />
              </Field>

              {/* Take-Home Toggle */}
              <Field>
                <div className="flex items-center justify-between gap-4 p-3 rounded-xl bg-muted/40 border border-border/60">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex size-8 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0 mt-0.5">
                      <Home className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <FieldLabel
                        htmlFor="is_take_home"
                        className="text-sm font-medium text-foreground cursor-pointer"
                      >
                        Take-home activity
                      </FieldLabel>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-normal">
                        Allow parents to upload submissions for this activity.
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="is_take_home"
                    checked={isTakeHome}
                    onCheckedChange={(checked: boolean) =>
                      form.setValue("is_take_home", checked)
                    }
                  />
                </div>
              </Field>
            </FieldGroup>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2 pt-3.5 sm:pt-4 mt-2 border-t border-border shrink-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              className="h-10 sm:h-9 w-full sm:w-auto text-muted-foreground hover:text-foreground text-xs sm:text-sm rounded-lg sm:rounded-xl font-medium"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="h-10 sm:h-9 w-full sm:w-auto bg-primary hover:bg-brand-700 text-primary-foreground font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl shadow-xs"
            >
              {isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <ClipboardList className="w-4 h-4 mr-1.5" />
              )}
              Create Activity
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Run type check and lint**

```bash
cd frontend
npx tsc --noEmit
npx eslint components/activities/create-activity-dialog.tsx
```

Expected: Clean

- [ ] **Step 3: Commit**

```bash
git add frontend/components/activities/create-activity-dialog.tsx
git commit -m "feat: add CreateActivityDialog component"
```

---

### Task 4: Frontend — Activities List Page

**Files:**
- Modify: `frontend/app/(teacher)/activities/page.tsx` (replace entire 17-line placeholder)

**Interfaces:**
- Consumes: `useActivities`, `Activity` from `@/lib/hooks/use-activities` (from Task 2)
- Consumes: `<CreateActivityDialog>` from `@/components/activities/create-activity-dialog` (from Task 3)
- Produces: Full Activities list page at `/activities` — card grid with search, empty states, loading skeleton, clickable cards navigating to `/activities/[id]`

- [ ] **Step 1: Replace `frontend/app/(teacher)/activities/page.tsx` with the full implementation**

```tsx
"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActivities, Activity } from "@/lib/hooks/use-activities";
import { CreateActivityDialog } from "@/components/activities/create-activity-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Kbd } from "@/components/ui/kbd";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Plus,
  Loader2,
  AlertCircle,
  RotateCcw,
  Search,
  X,
  SearchX,
  ClipboardList,
  Home,
  CalendarDays,
  FileText,
} from "lucide-react";
import { toast } from "sonner";

function getWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function getRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 30) {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year:
        date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  }
  if (diffDays > 0)
    return `${diffDays}d ago`;
  if (diffHours > 0)
    return `${diffHours}h ago`;
  if (diffMins > 0)
    return `${diffMins}m ago`;
  return "Just now";
}

export default function ActivitiesPage() {
  const router = useRouter();
  const { data: activities, isLoading, error, refetch } = useActivities();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: "/" to focus search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      if (isDialogOpen) return;

      if (
        (e.key === "/" ||
          ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) &&
        !isTyping
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isDialogOpen]);

  const filteredActivities = useMemo(() => {
    if (!activities) return [];
    if (!searchQuery) return activities;

    const query = searchQuery.toLowerCase();
    return activities.filter((activity) =>
      activity.target_text.toLowerCase().includes(query)
    );
  }, [activities, searchQuery]);

  if (error) {
    return (
      <div className="max-w-6xl mx-auto">
        <div
          role="alert"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">
              Failed to load activities: {error.message}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-destructive/30 hover:bg-destructive/10 text-destructive"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5 sm:space-y-6 pb-20 sm:pb-16 px-1 sm:px-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-foreground tracking-tight">
              Activities
            </h1>
            {activities && activities.length > 0 && (
              <Badge
                variant="outline"
                className="text-xs font-semibold px-2.5 py-0.5 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border-brand-200/80 dark:border-brand-900"
              >
                {activities.length}{" "}
                {activities.length === 1 ? "Activity" : "Activities"}
              </Badge>
            )}
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-normal">
            Create and manage handwriting activities for your students.
          </p>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="h-10 sm:h-9 w-full sm:w-auto bg-primary hover:bg-brand-700 text-primary-foreground text-xs sm:text-sm font-medium shadow-xs rounded-lg sm:rounded-xl"
          >
            <Plus className="w-4 h-4 mr-1.5 shrink-0" />
            Create Activity
          </Button>
        </div>
      </div>

      {/* Search Bar — only when activities exist */}
      {activities && activities.length > 0 && (
        <div className="bg-surface dark:bg-card p-3 rounded-xl sm:rounded-2xl border border-border shadow-2xs">
          <div className="relative w-full lg:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              ref={searchInputRef}
              placeholder="Search activities..."
              aria-label="Search activities by target text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  if (searchQuery) {
                    setSearchQuery("");
                  } else {
                    searchInputRef.current?.blur();
                  }
                }
              }}
              className="pl-9 pr-8 h-10 sm:h-9 text-base sm:text-sm rounded-lg sm:rounded-xl"
              aria-keyshortcuts="/"
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1 rounded-full transition-colors cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring after:absolute after:-inset-2 after:content-['']"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex items-center pointer-events-none">
                <Kbd className="text-[10px] h-5 px-1 bg-muted text-muted-foreground border-border">
                  /
                </Kbd>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Filter results indicator */}
      {searchQuery && activities && activities.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            Showing{" "}
            <strong className="text-foreground">
              {filteredActivities.length}
            </strong>{" "}
            of {activities.length} activities matching &ldquo;
            <strong className="text-foreground">{searchQuery}</strong>
            &rdquo;
          </span>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-primary hover:underline font-medium cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring rounded-sm px-1 py-0.5"
          >
            Clear search
          </button>
        </div>
      )}

      {/* Content Area */}
      {isLoading ? (
        /* Loading Skeleton */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-5 space-y-3 shadow-2xs"
            >
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-12 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : activities?.length === 0 ? (
        /* Empty State — No activities */
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-2xs overflow-hidden">
          <Empty className="py-14 border-0">
            <EmptyMedia
              variant="icon"
              className="bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300"
            >
              <ClipboardList className="w-6 h-6" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-lg sm:text-xl">
                No activities yet
              </EmptyTitle>
              <EmptyDescription className="text-xs sm:text-sm max-w-sm mx-auto">
                Create your first handwriting activity to start assessing
                student submissions.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex items-center justify-center w-full sm:w-auto px-4 sm:px-0">
              <Button
                onClick={() => setIsDialogOpen(true)}
                className="h-10 sm:h-9 w-full sm:w-auto bg-primary hover:bg-brand-700 text-primary-foreground font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create Activity
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : filteredActivities.length === 0 ? (
        /* Empty State — No search results */
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-2xs overflow-hidden">
          <Empty className="py-12 border-0">
            <EmptyMedia
              variant="icon"
              className="bg-muted text-muted-foreground"
            >
              <SearchX className="w-6 h-6" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-lg sm:text-xl">
                No matching activities
              </EmptyTitle>
              <EmptyDescription className="text-xs sm:text-sm">
                We couldn&apos;t find any activities matching &ldquo;
                {searchQuery}&rdquo;.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button
                variant="outline"
                onClick={() => setSearchQuery("")}
                className="h-10 sm:h-9 font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl"
              >
                Clear Search
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      ) : (
        /* Activity Card Grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredActivities.map((activity) => (
            <button
              key={activity.id}
              type="button"
              onClick={() => router.push(`/activities/${activity.id}`)}
              className="group text-left bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-5 shadow-2xs hover:shadow-md hover:border-brand-200 dark:hover:border-brand-900 transition-all duration-200 cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              {/* Target Text Preview */}
              <div className="flex items-start gap-3 mb-3">
                <div className="flex size-9 items-center justify-center rounded-lg bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0 mt-0.5">
                  <FileText className="size-4" />
                </div>
                <p className="text-sm font-medium text-foreground line-clamp-2 leading-relaxed group-hover:text-brand-700 dark:group-hover:text-brand-300 transition-colors">
                  &ldquo;{activity.target_text}&rdquo;
                </p>
              </div>

              {/* Metadata Row */}
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant="outline"
                  className="text-[10px] font-semibold px-2 py-0.5 bg-muted/50 text-muted-foreground border-border"
                >
                  {getWordCount(activity.target_text)}{" "}
                  {getWordCount(activity.target_text) === 1
                    ? "word"
                    : "words"}
                </Badge>

                {activity.is_take_home && (
                  <Badge
                    variant="outline"
                    className="text-[10px] font-semibold px-2 py-0.5 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border-brand-200/80 dark:border-brand-900"
                  >
                    <Home className="w-3 h-3 mr-1" />
                    Take-home
                  </Badge>
                )}

                <span className="text-[10px] text-muted-foreground ml-auto flex items-center gap-1">
                  <CalendarDays className="w-3 h-3" />
                  {getRelativeTime(activity.created_at)}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Create Activity Dialog */}
      <CreateActivityDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run type check and lint**

```bash
cd frontend
npx tsc --noEmit
npx eslint "app/(teacher)/activities/page.tsx"
```

Expected: Clean

- [ ] **Step 3: Manual QA — verify in browser**

Open `http://localhost:3000/activities`:
1. Empty state renders with "No activities yet" message and "Create Activity" CTA
2. Click "Create Activity" → dialog opens
3. Type target text → word count updates live
4. Toggle take-home switch → switch reflects state
5. Submit → toast "Activity created successfully", dialog closes, card appears in grid
6. Search filters cards by target text
7. Cards show word count badge, take-home badge (if applicable), relative date

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/(teacher)/activities/page.tsx"
git commit -m "feat: build Activities list page with card grid, search, and create dialog"
```

---

### Task 5: Frontend — Activity Detail Page

**Files:**
- Create: `frontend/app/(teacher)/activities/[id]/page.tsx`

**Interfaces:**
- Consumes: `useActivity`, `Activity` from `@/lib/hooks/use-activities` (from Task 2)
- Produces: Activity detail page at `/activities/[id]` — displays activity info header + empty-state submissions placeholder

- [ ] **Step 1: Create `frontend/app/(teacher)/activities/[id]/page.tsx`**

```tsx
"use client";

import { use } from "react";
import Link from "next/link";
import { useActivity } from "@/lib/hooks/use-activities";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  ArrowLeft,
  ClipboardList,
  Home,
  CalendarDays,
  FileText,
  Upload,
  Inbox,
  AlertCircle,
  RotateCcw,
} from "lucide-react";

function getWordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).filter(Boolean).length;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function ActivityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: activity, isLoading, error, refetch } = useActivity(id);

  if (error) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/activities"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Activities
          </Link>
        </div>
        <div
          role="alert"
          className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-sm font-medium">
              {error.message.includes("not found") || error.message.includes("No rows")
                ? "Activity not found. It may have been removed."
                : `Failed to load activity: ${error.message}`}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            className="border-destructive/30 hover:bg-destructive/10 text-destructive"
          >
            <RotateCcw className="w-4 h-4 mr-1.5" />
            Retry
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-4 w-32" />
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-6 space-y-4 shadow-2xs">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <div className="flex gap-2 pt-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-6 space-y-4 shadow-2xs">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (!activity) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link
            href="/activities"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Activities
          </Link>
        </div>
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-2xs overflow-hidden">
          <Empty className="py-14 border-0">
            <EmptyMedia
              variant="icon"
              className="bg-muted text-muted-foreground"
            >
              <ClipboardList className="w-6 h-6" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle>Activity not found</EmptyTitle>
              <EmptyDescription>
                This activity may have been removed or you don&apos;t have
                access.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild variant="outline" className="rounded-lg sm:rounded-xl">
                <Link href="/activities">
                  <ArrowLeft className="w-4 h-4 mr-1.5" />
                  Back to Activities
                </Link>
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      </div>
    );
  }

  const wordCount = getWordCount(activity.target_text);

  return (
    <div className="max-w-4xl mx-auto space-y-5 sm:space-y-6 pb-20 sm:pb-16 px-1 sm:px-0">
      {/* Back Link */}
      <Link
        href="/activities"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Activities
      </Link>

      {/* Activity Info Card */}
      <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl p-5 sm:p-6 shadow-2xs">
        <div className="flex items-start gap-4">
          <div className="flex size-11 items-center justify-center rounded-xl bg-brand-100 dark:bg-brand-950 text-brand-700 dark:text-brand-300 shrink-0">
            <FileText className="size-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-3">
            {/* Target Text */}
            <div>
              <h1 className="text-lg sm:text-xl font-heading font-semibold text-foreground tracking-tight mb-1">
                Activity Details
              </h1>
              <p className="text-sm sm:text-base text-foreground leading-relaxed">
                &ldquo;{activity.target_text}&rdquo;
              </p>
            </div>

            {/* Metadata */}
            <div className="flex items-center gap-2.5 flex-wrap">
              <Badge
                variant="outline"
                className="text-xs font-semibold px-2.5 py-0.5 bg-muted/50 text-muted-foreground border-border"
              >
                {wordCount} {wordCount === 1 ? "word" : "words"}
              </Badge>

              {activity.is_take_home && (
                <Badge
                  variant="outline"
                  className="text-xs font-semibold px-2.5 py-0.5 bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300 border-brand-200/80 dark:border-brand-900"
                >
                  <Home className="w-3 h-3 mr-1" />
                  Take-home
                </Badge>
              )}

              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="w-3.5 h-3.5" />
                {formatDate(activity.created_at)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Submissions Section — Placeholder */}
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground tracking-tight mb-3">
          Submissions
        </h2>
        <div className="bg-surface dark:bg-card border border-border rounded-xl sm:rounded-2xl shadow-2xs overflow-hidden">
          <Empty className="py-12 border-0">
            <EmptyMedia
              variant="icon"
              className="bg-muted text-muted-foreground"
            >
              <Inbox className="w-6 h-6" />
            </EmptyMedia>
            <EmptyHeader>
              <EmptyTitle className="text-lg sm:text-xl">
                No submissions yet
              </EmptyTitle>
              <EmptyDescription className="text-xs sm:text-sm max-w-sm mx-auto">
                Upload a student&apos;s handwriting for this activity to begin
                assessment.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex items-center justify-center w-full sm:w-auto px-4 sm:px-0">
              <Button
                disabled
                className="h-10 sm:h-9 w-full sm:w-auto font-medium text-xs sm:text-sm rounded-lg sm:rounded-xl opacity-50 cursor-not-allowed"
              >
                <Upload className="w-4 h-4 mr-2" />
                Upload Submission
              </Button>
            </EmptyContent>
          </Empty>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check and lint**

```bash
cd frontend
npx tsc --noEmit
npx eslint "app/(teacher)/activities/[id]/page.tsx"
```

Expected: Clean

- [ ] **Step 3: Manual QA — verify in browser**

1. From the Activities list, click an activity card → navigates to `/activities/<id>`
2. Back link returns to `/activities`
3. Activity info card displays target text, word count, take-home badge, formatted date
4. Submissions section shows empty state with disabled Upload button
5. Navigate to a non-existent ID → error state renders with "Activity not found"
6. Loading skeleton appears on initial load

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/(teacher)/activities/[id]/page.tsx"
git commit -m "feat: add Activity detail page with submissions placeholder"
```

---

### Task 6: Verification & Status Update

**Files:**
- Modify: `IMPLEMENTATION_STATUS.md` (lines 5, 12, 57)

**Interfaces:**
- Consumes: All prior tasks

- [ ] **Step 1: Run full backend tests**

```bash
cd backend
uv run ruff check .
uv run pytest -v
```

Expected: All tests pass, lint clean

- [ ] **Step 2: Run full frontend checks**

```bash
cd frontend
npx tsc --noEmit
npx eslint .
```

Expected: Clean

- [ ] **Step 3: Update `IMPLEMENTATION_STATUS.md`**

Change line 57 — mark Activity creation as Done:

```diff
-| Activity creation (freeform target text) | Not Started | | PRD §7.1, API_SPEC §3.2, DATABASE §5 |
+| Activity creation (freeform target text) | Done | | PRD §7.1, API_SPEC §3.2, DESIGN §6 screens 5–6 |
```

Update the Phase 1 count in the summary table (line 12):

```diff
-| Phase 1 — Teacher Tooling & Raw CV Pipeline | 1 / 17 |
+| Phase 1 — Teacher Tooling & Raw CV Pipeline | 2 / 17 |
```

Update the `Last updated` date (line 5):

```diff
-**Last updated:** 2026-08-17
+**Last updated:** 2026-08-18
```

- [ ] **Step 4: Final commit**

```bash
git add IMPLEMENTATION_STATUS.md
git commit -m "docs: mark Activity creation as Done in IMPLEMENTATION_STATUS"
```

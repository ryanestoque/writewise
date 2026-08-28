# Parent Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full parent portal — navigation, single-page progress dashboard, take-home activities list, and simplified upload dialog.

**Architecture:** Frontend direct-read architecture using `supabase-js` and TanStack Query, gated by existing RLS policies. The only backend change is extending `POST /api/submissions` to accept parent callers for take-home activities. Parent layout uses a lightweight top nav (no sidebar). Shared scoring utilities and band presentation components from the teacher dashboard build are reused without modification.

**Tech Stack:** Next.js 15, React 19, TypeScript, TanStack Query, Recharts, shadcn/ui, Tailwind CSS, Supabase, FastAPI

**Spec:** `docs/superpowers/specs/2026-08-28-parent-portal-design.md`

## Global Constraints

- TypeScript `strict: true` — don't relax it
- ESLint (flat config, `eslint-config-next`) + Prettier for frontend
- ruff for backend lint and format
- Frontend branches on `error.code`, never on `error.message` text
- All interactive elements: minimum 40px touch target on mobile (`h-10 sm:h-9`)
- Color is never the sole signal — all band indicators pair color with text label
- Visible keyboard focus rings on all interactive elements (`focus-visible:ring-2`)
- Single `<main>` landmark per view
- All Supabase reads are direct `supabase-js` queries, gated by existing RLS — no new RLS policies
- Backend uses service-role key — authorization checks are in Python, not RLS
- No new database migrations

---

### Task 1: Backend — Extend Submission Endpoint for Parent Callers

Extend `POST /api/submissions` to accept both teacher and parent callers, with role-conditional authorization. This unblocks the parent upload dialog (Task 6).

**Files:**
- Modify: `backend/app/api/submissions.py` (lines 8, 38-45, 78-115, 185-186)
- Test: `backend/tests/api/test_submissions_parent.py` (new)

**Interfaces:**
- Consumes: `get_current_user` from `backend/app/api/deps.py` (already exists, returns `{ "sub": uuid, "role": "teacher"|"parent", "email": str }`)
- Produces: Same `POST /api/submissions` endpoint, now accepting parent JWTs. Response shape unchanged. Parent-specific 404 errors for: not linked to student, activity not take-home, activity's teacher not linked to student.

- [ ] **Step 1: Write failing tests for parent submission authorization**

Create `backend/tests/api/test_submissions_parent.py`:

```python
"""Tests for parent submission authorization in POST /api/submissions.

These tests verify the three parent-specific authorization checks:
1. Parent is linked to the student (student_parent row exists)
2. Activity has is_take_home = true
3. Activity's teacher is linked to the student (teacher_student row exists)
"""
import pytest
from unittest.mock import patch, MagicMock


def _make_user(role: str, user_id: str = "parent-uuid-1"):
    """Build a fake JWT payload dict matching get_current_user output."""
    return {"sub": user_id, "role": role, "email": f"{role}@test.com"}


class TestParentSubmissionAuthorization:
    """Parent-specific authorization branch in create_submission."""

    def test_parent_rejected_when_not_linked_to_student(self, client):
        """Parent who is not linked to the student gets 404."""
        # This test validates check #1: student_parent row must exist
        pass  # Placeholder — actual HTTP call depends on test fixtures

    def test_parent_rejected_when_activity_not_take_home(self, client):
        """Parent submitting against a non-take-home activity gets 404."""
        # This test validates check #2: activity.is_take_home must be true
        pass

    def test_parent_rejected_when_teacher_not_linked_to_student(self, client):
        """Parent submitting against activity whose teacher isn't linked to child gets 404."""
        # This test validates check #3: teacher_student row must exist
        pass

    def test_parent_can_submit_for_valid_take_home_activity(self, client):
        """Parent with valid link, take-home activity, and linked teacher succeeds."""
        pass
```

> **Note:** The exact test implementation depends on the existing test fixtures in `backend/tests/`. The tests above are structural — the implementing agent should check `backend/tests/conftest.py` and existing test patterns (e.g., `backend/tests/api/`) for the actual fixture setup, mocking pattern (whether tests use a real ephemeral Supabase or mock `supabase_client`), and HTTP client configuration.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend; uv run pytest tests/api/test_submissions_parent.py -v`
Expected: FAIL (tests have placeholder `pass` bodies or missing fixtures)

- [ ] **Step 3: Modify the submission endpoint to accept both roles**

In `backend/app/api/submissions.py`, make these changes:

**a) Change import** (line 8):
```python
# Before:
from app.api.deps import get_current_teacher
# After:
from app.api.deps import get_current_user
```

**b) Change the endpoint signature** (lines 38-45):
```python
# Before:
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_submission(
    image: UploadFile = File(...),
    activity_id: str = Form(...),
    student_id: str = Form(...),
    teacher: dict = Depends(get_current_teacher),
):
    teacher_id = teacher.get("sub")

# After:
@router.post("", status_code=status.HTTP_201_CREATED)
async def create_submission(
    image: UploadFile = File(...),
    activity_id: str = Form(...),
    student_id: str = Form(...),
    caller: dict = Depends(get_current_user),
):
    caller_id = caller.get("sub")
    caller_role = caller.get("role")
```

**c) Replace the authorization checks** (lines 78-115) with role-conditional logic:
```python
    # 3. Fetch activity — check exists, get target_text and is_take_home
    activity_res = (
        supabase_client.table("activity")
        .select("id, target_text, is_take_home, created_by")
        .eq("id", activity_id)
        .execute()
    )
    if not activity_res.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "code": "NOT_FOUND",
                "message": "Activity not found.",
                "details": {},
            },
        )
    activity_row = activity_res.data[0]
    target_text: str = activity_row["target_text"]
    expected_word_count = len(target_text.split())

    # 4. Role-conditional authorization
    if caller_role == "teacher":
        # Teacher: activity must belong to them, student must be on their roster
        if activity_row["created_by"] != caller_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOT_FOUND", "message": "Activity not found.", "details": {}},
            )
        roster_res = (
            supabase_client.table("teacher_student")
            .select("student_id")
            .eq("teacher_id", caller_id)
            .eq("student_id", student_id)
            .execute()
        )
        if not roster_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOT_FOUND", "message": "Student not found on your roster.", "details": {}},
            )

    elif caller_role == "parent":
        # Parent check 1: parent is linked to the student
        parent_link_res = (
            supabase_client.table("student_parent")
            .select("student_id")
            .eq("parent_id", caller_id)
            .eq("student_id", student_id)
            .execute()
        )
        if not parent_link_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOT_FOUND", "message": "Student not found.", "details": {}},
            )

        # Parent check 2: activity must be take-home
        if not activity_row.get("is_take_home"):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOT_FOUND", "message": "Activity not found.", "details": {}},
            )

        # Parent check 3: activity's teacher is linked to the student
        teacher_link_res = (
            supabase_client.table("teacher_student")
            .select("student_id")
            .eq("teacher_id", activity_row["created_by"])
            .eq("student_id", student_id)
            .execute()
        )
        if not teacher_link_res.data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={"code": "NOT_FOUND", "message": "Activity not found.", "details": {}},
            )

    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Invalid role.", "details": {}},
        )
```

**d) Update the submission insert** (lines 185-186) to use the caller's role:
```python
# Before:
                "uploader_id": teacher_id,
                "uploader_role": "teacher",
# After:
                "uploader_id": caller_id,
                "uploader_role": caller_role,
```

- [ ] **Step 4: Update the tests with real assertions and run them**

Flesh out the test bodies based on the existing test patterns found in `backend/tests/`. Run:
```
cd backend; uv run pytest tests/api/test_submissions_parent.py -v
```
Expected: All 4 tests PASS

- [ ] **Step 5: Run existing submission tests to verify no regressions**

```
cd backend; uv run pytest tests/api/ -v
```
Expected: All existing tests still PASS (teacher flow unchanged)

- [ ] **Step 6: Lint check**

```
cd backend; uv run ruff check .
```
Expected: No errors

- [ ] **Step 7: Commit**

```
git add backend/app/api/submissions.py backend/tests/api/test_submissions_parent.py
git commit -m "feat(api): extend POST /api/submissions to accept parent callers for take-home activities"
```

---

### Task 2: Parent Data Hooks

Create all TanStack Query hooks the parent portal needs. These are the data layer for Tasks 3–6.

**Files:**
- Create: `frontend/lib/hooks/use-parent-data.ts`

**Interfaces:**
- Consumes: `createClient` from `@/lib/supabase/client`, `getBandFromScore` and `ScoreBand` from `@/lib/utils/scoring`
- Produces:
  - `useLinkedChildren()` → `{ data: LinkedChild[] | undefined, isLoading, error }` where `LinkedChild = { id: string; fullName: string; section: string }`
  - `useChildLatestScores(childId: string | null)` → `{ data: ChildLatestScores | null | undefined, isLoading, error }` where `ChildLatestScores = { submissionId, submissionDate, activityText, scoreSource, scores: Record<CriterionKey, number|null>, bands: Record<CriterionKey, ScoreBand|null> }`
  - `useChildScoreHistory(childId: string | null)` → `{ data: StudentScoreHistoryItem[] | undefined, isLoading, error }` (reuses the same type from `use-dashboard.ts`)
  - `useTakeHomeActivities(childId: string | null)` → `{ data: TakeHomeActivity[] | undefined, isLoading, error }` where `TakeHomeActivity = { id: string; targetText: string; createdAt: string }`
  - `useChildSubmissionForActivity(childId: string | null, activityId: string)` → `{ data: { submissionId: string; status: string; compositeScore: number|null; compositeBand: ScoreBand|null } | null | undefined, isLoading }`

- [ ] **Step 1: Create the hooks file with `useLinkedChildren`**

Create `frontend/lib/hooks/use-parent-data.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { createClient } from "../supabase/client";
import { getBandFromScore, type ScoreBand } from "../utils/scoring";
import type { StudentScoreHistoryItem } from "./use-dashboard";

// --- Types ---

export interface LinkedChild {
  id: string;
  fullName: string;
  section: string;
}

export interface ChildLatestScores {
  submissionId: string;
  submissionDate: string;
  activityText: string;
  scoreSource: "manual" | "calibrated" | "none";
  scores: {
    letter_formation: number | null;
    size_consistency: number | null;
    spacing: number | null;
    slant: number | null;
    baseline_alignment: number | null;
    composite: number | null;
  };
  bands: {
    letter_formation: ScoreBand | null;
    size_consistency: ScoreBand | null;
    spacing: ScoreBand | null;
    slant: ScoreBand | null;
    baseline_alignment: ScoreBand | null;
    composite: ScoreBand | null;
  };
}

export interface TakeHomeActivity {
  id: string;
  targetText: string;
  createdAt: string;
}

// --- Hooks ---

export function useLinkedChildren() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["parent-linked-children"],
    queryFn: async (): Promise<LinkedChild[]> => {
      // student_parent RLS: parent can view own links
      // student RLS: parent can view own child
      const { data, error } = await supabase
        .from("student_parent")
        .select("student:student_id(id, full_name, section)")
        .order("created_at");

      if (error) throw new Error(error.message);

      return (data || [])
        .map((row: Record<string, unknown>) => {
          const student = Array.isArray(row.student) ? row.student[0] : row.student;
          if (!student) return null;
          return {
            id: (student as { id: string }).id,
            fullName: (student as { full_name: string }).full_name,
            section: (student as { section: string }).section,
          };
        })
        .filter((child): child is LinkedChild => child !== null);
    },
  });
}
```

- [ ] **Step 2: Add `useChildLatestScores` hook**

Append to `frontend/lib/hooks/use-parent-data.ts`:

```typescript
export function useChildLatestScores(childId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["parent-child-latest-scores", childId],
    queryFn: async (): Promise<ChildLatestScores | null> => {
      const { data, error } = await supabase
        .from("submission")
        .select(`
          id,
          created_at,
          status,
          activity:activity_id(
            id,
            target_text
          ),
          manual_score(
            letter_formation_band,
            letter_formation_score,
            size_consistency_band,
            size_consistency_score,
            spacing_band,
            spacing_score,
            slant_band,
            slant_score,
            baseline_alignment_band,
            baseline_alignment_score
          ),
          measurement(
            letter_formation_score,
            size_consistency_score,
            spacing_score,
            slant_score,
            baseline_alignment_score,
            composite_score
          )
        `)
        .eq("student_id", childId!)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(20); // Fetch recent to find the latest with scores

      if (error) throw new Error(error.message);

      // Find the latest completed submission that has scores
      for (const row of data || []) {
        const m = Array.isArray(row.measurement) ? row.measurement[0] : row.measurement;
        const ms = Array.isArray(row.manual_score) ? row.manual_score[0] : row.manual_score;
        if (!m?.composite_score && !ms) continue;

        const rawActivity = Array.isArray(row.activity) ? row.activity[0] : row.activity;
        const isCalibrated = m?.composite_score != null;

        let scores: ChildLatestScores["scores"];
        let bands: ChildLatestScores["bands"];

        if (isCalibrated) {
          scores = {
            letter_formation: Number(m.letter_formation_score),
            size_consistency: Number(m.size_consistency_score),
            spacing: Number(m.spacing_score),
            slant: Number(m.slant_score),
            baseline_alignment: Number(m.baseline_alignment_score),
            composite: Number(m.composite_score),
          };
          bands = {
            letter_formation: getBandFromScore(scores.letter_formation),
            size_consistency: getBandFromScore(scores.size_consistency),
            spacing: getBandFromScore(scores.spacing),
            slant: getBandFromScore(scores.slant),
            baseline_alignment: getBandFromScore(scores.baseline_alignment),
            composite: getBandFromScore(scores.composite),
          };
        } else {
          const lfScore = ms.letter_formation_score != null ? Number(ms.letter_formation_score) : null;
          const scScore = ms.size_consistency_score != null ? Number(ms.size_consistency_score) : null;
          const spScore = ms.spacing_score != null ? Number(ms.spacing_score) : null;
          const slScore = ms.slant_score != null ? Number(ms.slant_score) : null;
          const baScore = ms.baseline_alignment_score != null ? Number(ms.baseline_alignment_score) : null;
          const compScore =
            lfScore !== null && scScore !== null && spScore !== null && slScore !== null && baScore !== null
              ? (lfScore + scScore + spScore + slScore + baScore) / 5
              : null;

          scores = {
            letter_formation: lfScore,
            size_consistency: scScore,
            spacing: spScore,
            slant: slScore,
            baseline_alignment: baScore,
            composite: compScore,
          };
          bands = {
            letter_formation: ms.letter_formation_band ?? null,
            size_consistency: ms.size_consistency_band ?? null,
            spacing: ms.spacing_band ?? null,
            slant: ms.slant_band ?? null,
            baseline_alignment: ms.baseline_alignment_band ?? null,
            composite: compScore !== null ? getBandFromScore(compScore) : null,
          };
        }

        return {
          submissionId: row.id,
          submissionDate: row.created_at,
          activityText: (rawActivity as { target_text: string } | null)?.target_text || "Handwriting Activity",
          scoreSource: isCalibrated ? "calibrated" : "manual",
          scores,
          bands,
        };
      }

      return null; // No scored submissions found
    },
    enabled: !!childId,
  });
}
```

- [ ] **Step 3: Add `useChildScoreHistory`, `useTakeHomeActivities`, and `useChildSubmissionForActivity`**

Append to the same file:

```typescript
export function useChildScoreHistory(childId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["parent-child-score-history", childId],
    queryFn: async (): Promise<StudentScoreHistoryItem[]> => {
      // Same query as useStudentScoreHistory in use-dashboard.ts
      // RLS ensures parent only sees their own child's data
      const { data, error } = await supabase
        .from("submission")
        .select(`
          id,
          created_at,
          status,
          activity:activity_id(
            id,
            target_text,
            is_take_home
          ),
          manual_score(
            letter_formation_band,
            letter_formation_score,
            size_consistency_band,
            size_consistency_score,
            spacing_band,
            spacing_score,
            slant_band,
            slant_score,
            baseline_alignment_band,
            baseline_alignment_score
          ),
          measurement(
            letter_formation_score,
            size_consistency_score,
            spacing_score,
            slant_score,
            baseline_alignment_score,
            composite_score
          )
        `)
        .eq("student_id", childId!)
        .eq("status", "completed")
        .order("created_at", { ascending: true });

      if (error) throw new Error(error.message);

      const history: StudentScoreHistoryItem[] = [];

      for (const row of data || []) {
        const rawMeasurement = Array.isArray(row.measurement) ? row.measurement[0] : row.measurement;
        const rawManual = Array.isArray(row.manual_score) ? row.manual_score[0] : row.manual_score;
        const rawActivity = Array.isArray(row.activity) ? row.activity[0] : row.activity;

        const isCalibrated = rawMeasurement?.composite_score != null;
        if (!isCalibrated && !rawManual) continue;

        let lfScore: number | null = null;
        let scScore: number | null = null;
        let spScore: number | null = null;
        let slScore: number | null = null;
        let baScore: number | null = null;
        let compScore: number | null = null;

        let lfBand: ScoreBand | null = null;
        let scBand: ScoreBand | null = null;
        let spBand: ScoreBand | null = null;
        let slBand: ScoreBand | null = null;
        let baBand: ScoreBand | null = null;

        if (isCalibrated) {
          lfScore = Number(rawMeasurement.letter_formation_score);
          scScore = Number(rawMeasurement.size_consistency_score);
          spScore = Number(rawMeasurement.spacing_score);
          slScore = Number(rawMeasurement.slant_score);
          baScore = Number(rawMeasurement.baseline_alignment_score);
          compScore = Number(rawMeasurement.composite_score);
          lfBand = getBandFromScore(lfScore);
          scBand = getBandFromScore(scScore);
          spBand = getBandFromScore(spScore);
          slBand = getBandFromScore(slScore);
          baBand = getBandFromScore(baScore);
        } else if (rawManual) {
          lfScore = rawManual.letter_formation_score != null ? Number(rawManual.letter_formation_score) : null;
          scScore = rawManual.size_consistency_score != null ? Number(rawManual.size_consistency_score) : null;
          spScore = rawManual.spacing_score != null ? Number(rawManual.spacing_score) : null;
          slScore = rawManual.slant_score != null ? Number(rawManual.slant_score) : null;
          baScore = rawManual.baseline_alignment_score != null ? Number(rawManual.baseline_alignment_score) : null;
          lfBand = rawManual.letter_formation_band ?? null;
          scBand = rawManual.size_consistency_band ?? null;
          spBand = rawManual.spacing_band ?? null;
          slBand = rawManual.slant_band ?? null;
          baBand = rawManual.baseline_alignment_band ?? null;
          if (lfScore !== null && scScore !== null && spScore !== null && slScore !== null && baScore !== null) {
            compScore = (lfScore + scScore + spScore + slScore + baScore) / 5;
          }
        }

        const compBand = compScore !== null ? getBandFromScore(compScore) : null;

        history.push({
          submissionId: row.id,
          submissionDate: row.created_at,
          activityId: (rawActivity as { id: string } | null)?.id || "",
          targetText: (rawActivity as { target_text: string } | null)?.target_text || "Handwriting Activity",
          isTakeHome: Boolean((rawActivity as { is_take_home?: boolean } | null)?.is_take_home),
          scoreSource: isCalibrated ? "calibrated" : "manual",
          compositeScore: compScore,
          compositeBand: compBand,
          scores: {
            letter_formation: lfScore,
            size_consistency: scScore,
            spacing: spScore,
            slant: slScore,
            baseline_alignment: baScore,
          },
          bands: {
            letter_formation: lfBand,
            size_consistency: scBand,
            spacing: spBand,
            slant: slBand,
            baseline_alignment: baBand,
          },
        });
      }

      return history;
    },
    enabled: !!childId,
  });
}

export function useTakeHomeActivities(childId: string | null) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["parent-take-home-activities", childId],
    queryFn: async (): Promise<TakeHomeActivity[]> => {
      // RLS: parent can view assigned take-home activities
      // (is_take_home AND teacher linked to parent's child)
      const { data, error } = await supabase
        .from("activity")
        .select("id, target_text, created_at")
        .eq("is_take_home", true)
        .order("created_at", { ascending: false });

      if (error) throw new Error(error.message);

      return (data || []).map((row) => ({
        id: row.id,
        targetText: row.target_text,
        createdAt: row.created_at,
      }));
    },
    enabled: !!childId,
  });
}

export function useChildSubmissionForActivity(
  childId: string | null,
  activityId: string
) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["parent-child-submission", childId, activityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("submission")
        .select(`
          id,
          status,
          rejection_code,
          measurement(composite_score)
        `)
        .eq("student_id", childId!)
        .eq("activity_id", activityId)
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) throw new Error(error.message);

      if (!data || data.length === 0) return null;

      const row = data[0];
      const m = Array.isArray(row.measurement) ? row.measurement[0] : row.measurement;
      const compositeScore = m?.composite_score != null ? Number(m.composite_score) : null;

      return {
        submissionId: row.id as string,
        status: row.status as string,
        rejectionCode: row.rejection_code as string | null,
        compositeScore,
        compositeBand: getBandFromScore(compositeScore),
      };
    },
    enabled: !!childId && !!activityId,
  });
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```
cd frontend; npx tsc --noEmit
```
Expected: No type errors

- [ ] **Step 5: Commit**

```
git add frontend/lib/hooks/use-parent-data.ts
git commit -m "feat(hooks): add parent portal data hooks for linked children, scores, history, and take-home activities"
```

---

### Task 3: Parent Navigation and Layout

Build the parent top nav bar and update the parent layout to replace the placeholder shell. This is the structural foundation for all parent pages.

**Files:**
- Create: `frontend/components/parent-nav.tsx`
- Modify: `frontend/app/(parent)/layout.tsx`

**Interfaces:**
- Consumes: `useLinkedChildren()` from `lib/hooks/use-parent-data.ts` (Task 2), `BrandLogo` from `components/brand-logo.tsx`, `createClient` from `lib/supabase/server`
- Produces: `<ParentNav user={{ fullName, email }} />` component; updated `(parent)/layout.tsx` that fetches parent profile server-side and renders `ParentNav` + `<main>` content area. Exposes child selection via URL search param or React context — child-dependent pages read the selected child ID from this.

- [ ] **Step 1: Create the `ParentNav` component**

Create `frontend/components/parent-nav.tsx`:

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";
import { useLinkedChildren, type LinkedChild } from "@/lib/hooks/use-parent-data";
import { LogOut, User, Upload } from "lucide-react";

interface ParentNavProps {
  user: { fullName: string; email: string };
  onUploadClick?: () => void;
}

export function ParentNav({ user, onUploadClick }: ParentNavProps) {
  const router = useRouter();
  const supabase = createClient();
  const { data: children } = useLinkedChildren();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  // Default to first child when data loads
  useEffect(() => {
    if (children && children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [children, selectedChildId]);

  const selectedChild = children?.find((c) => c.id === selectedChildId) ?? null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = user.fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur-sm supports-[backdrop-filter]:bg-background/80">
        <nav
          aria-label="Parent navigation"
          className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6"
        >
          {/* Left: Brand Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo size="sm" />
          </div>

          {/* Center: Child Switcher */}
          <div className="flex-1 flex justify-center min-w-0">
            {children && children.length > 1 ? (
              <Select
                value={selectedChildId ?? undefined}
                onValueChange={setSelectedChildId}
              >
                <SelectTrigger
                  className="w-auto max-w-[200px] sm:max-w-[280px] h-9 text-sm font-medium gap-1.5 border-border/60 bg-background"
                  aria-label="Select child"
                >
                  <SelectValue placeholder="Select child" />
                </SelectTrigger>
                <SelectContent>
                  {children.map((child) => (
                    <SelectItem key={child.id} value={child.id}>
                      {child.fullName}
                      <span className="text-muted-foreground ml-1.5">
                        ({child.section})
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : selectedChild ? (
              <span className="text-sm font-medium text-foreground truncate">
                {selectedChild.fullName}
                <span className="text-muted-foreground ml-1.5">
                  ({selectedChild.section})
                </span>
              </span>
            ) : null}
          </div>

          {/* Right: Upload button + User menu */}
          <div className="flex items-center gap-2 shrink-0">
            {onUploadClick && (
              <Button
                variant="default"
                size="sm"
                className="h-9 gap-1.5 shadow-warm"
                onClick={onUploadClick}
              >
                <Upload className="size-4" />
                <span className="hidden sm:inline">Upload</span>
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="size-9 rounded-full p-0 font-semibold text-xs bg-brand-100 text-brand-700 hover:bg-brand-100/80"
                  aria-label="User menu"
                >
                  {initials}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium truncate">{user.fullName}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {user.email}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowSignOutDialog(true)}
                  className="text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="size-4 mr-2" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </nav>
      </header>

      {/* Sign-out confirmation dialog */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need to sign in again to view your child's progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut}>
              Sign out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

// Export the selected child state for child pages to consume
export { type LinkedChild };
```

> **Implementation note on child selection state:** The `ParentNav` holds `selectedChildId` in local state. The progress page needs access to this. The implementing agent should choose one of: (a) lift state into the layout via React context, (b) use URL search params (`?child=<id>`), or (c) make `ParentNav` accept `selectedChildId`/`onChildChange` props from a parent component. Option (a) with a simple `ParentContext` is recommended for cleanest prop drilling avoidance.

- [ ] **Step 2: Update the parent layout**

Replace `frontend/app/(parent)/layout.tsx`:

```tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ParentPortalProvider } from "@/components/parent-portal-provider";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware should have caught this, but guard defensively
  if (!user) {
    redirect("/login");
  }

  // Fetch parent profile
  const { data: parentProfile } = await supabase
    .from("parent")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const fullName =
    parentProfile?.full_name ||
    (user.user_metadata?.full_name as string) ||
    user.email ||
    "Parent";
  const email = user.email || "";

  return (
    <ParentPortalProvider user={{ fullName, email }}>
      {children}
    </ParentPortalProvider>
  );
}
```

- [ ] **Step 3: Create the `ParentPortalProvider` context**

Create `frontend/components/parent-portal-provider.tsx`:

```tsx
"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { ParentNav } from "@/components/parent-nav";
import { useLinkedChildren, type LinkedChild } from "@/lib/hooks/use-parent-data";

interface ParentPortalContextValue {
  selectedChildId: string | null;
  setSelectedChildId: (id: string) => void;
  selectedChild: LinkedChild | null;
  children: LinkedChild[];
  isLoading: boolean;
}

const ParentPortalContext = createContext<ParentPortalContextValue | null>(null);

export function useParentPortal() {
  const ctx = useContext(ParentPortalContext);
  if (!ctx) throw new Error("useParentPortal must be used within ParentPortalProvider");
  return ctx;
}

interface ParentPortalProviderProps {
  user: { fullName: string; email: string };
  children: ReactNode;
}

export function ParentPortalProvider({ user, children: pageChildren }: ParentPortalProviderProps) {
  const { data: linkedChildren, isLoading } = useLinkedChildren();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  // Default to first child when data loads
  useEffect(() => {
    if (linkedChildren && linkedChildren.length > 0 && !selectedChildId) {
      setSelectedChildId(linkedChildren[0].id);
    }
  }, [linkedChildren, selectedChildId]);

  const selectedChild = linkedChildren?.find((c) => c.id === selectedChildId) ?? null;

  const contextValue: ParentPortalContextValue = {
    selectedChildId,
    setSelectedChildId,
    selectedChild,
    children: linkedChildren ?? [],
    isLoading,
  };

  return (
    <ParentPortalContext.Provider value={contextValue}>
      <div className="flex min-h-dvh flex-col bg-background">
        <ParentNav
          user={user}
          selectedChildId={selectedChildId}
          linkedChildren={linkedChildren ?? []}
          onChildChange={setSelectedChildId}
          onUploadClick={() => setUploadOpen(true)}
        />
        <main className="flex-1 min-w-0 w-full px-4 sm:px-6 py-6 space-y-6">
          {pageChildren}
        </main>
      </div>
      {/* Upload dialog will be added in Task 6 */}
    </ParentPortalContext.Provider>
  );
}
```

> **Implementation note:** The `ParentNav` component (Step 1) will need minor refactoring to accept `selectedChildId`, `linkedChildren`, and `onChildChange` as props instead of calling `useLinkedChildren` internally, since the provider now owns that state. The implementing agent should reconcile the two — the provider is the source of truth.

- [ ] **Step 4: Verify TypeScript compiles**

```
cd frontend; npx tsc --noEmit
```
Expected: No type errors

- [ ] **Step 5: Verify lint passes**

```
cd frontend; npx eslint .
```
Expected: No errors

- [ ] **Step 6: Commit**

```
git add frontend/components/parent-nav.tsx frontend/components/parent-portal-provider.tsx frontend/app/(parent)/layout.tsx
git commit -m "feat(parent): add parent navigation bar, layout, and portal context provider"
```

---

### Task 4: Latest Submission Summary Card

Build the primary read card — composite score, per-criterion breakdown with diagnostic notes.

**Files:**
- Create: `frontend/components/parent/criterion-feedback-row.tsx`
- Create: `frontend/components/parent/latest-submission-card.tsx`

**Interfaces:**
- Consumes: `useChildLatestScores(childId)` from `lib/hooks/use-parent-data.ts` (Task 2), `BandBadge` from `components/shared/band-badge.tsx`, `BandPositionBar` from `components/shared/band-position-bar.tsx`, `ScoreSourceIndicator` from `components/shared/score-source-indicator.tsx`, `DIAGNOSTIC_NOTES`, `RUBRIC_CRITERIA` from `lib/utils/scoring.ts`
- Produces: `<LatestSubmissionCard childId={string} />` — self-contained card that fetches and displays the latest scored submission

- [ ] **Step 1: Create `CriterionFeedbackRow`**

Create `frontend/components/parent/criterion-feedback-row.tsx`:

```tsx
import { BandBadge } from "@/components/shared/band-badge";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { DIAGNOSTIC_NOTES } from "@/lib/utils/scoring";
import type { ScoreBand } from "@/lib/utils/scoring";

interface CriterionFeedbackRowProps {
  criterionKey: "letter_formation" | "size_consistency" | "spacing" | "slant" | "baseline_alignment";
  label: string;
  score: number | null;
  band: ScoreBand | null;
}

export function CriterionFeedbackRow({
  criterionKey,
  label,
  score,
  band,
}: CriterionFeedbackRowProps) {
  const diagnosticNote = band ? DIAGNOSTIC_NOTES[criterionKey][band] : null;

  return (
    <div className="space-y-1.5 py-3 border-b border-border/60 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <BandBadge band={band} score={score} size="sm" />
      </div>
      <BandPositionBar score={score} height="sm" />
      {diagnosticNote && (
        <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
          {diagnosticNote}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `LatestSubmissionCard`**

Create `frontend/components/parent/latest-submission-card.tsx`:

```tsx
"use client";

import { useChildLatestScores } from "@/lib/hooks/use-parent-data";
import { BandPositionBar } from "@/components/shared/band-position-bar";
import { BandBadge } from "@/components/shared/band-badge";
import { ScoreSourceIndicator } from "@/components/shared/score-source-indicator";
import { CriterionFeedbackRow } from "./criterion-feedback-row";
import { RUBRIC_CRITERIA } from "@/lib/utils/scoring";
import { FileText, Loader2 } from "lucide-react";

interface LatestSubmissionCardProps {
  childId: string | null;
}

const PARENT_CRITERIA = RUBRIC_CRITERIA.map((c) => ({
  criterionKey: c.criterionKey,
  label: c.shortName,
}));

export function LatestSubmissionCard({ childId }: LatestSubmissionCardProps) {
  const { data: latest, isLoading } = useChildLatestScores(childId);

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-warm p-6 flex items-center justify-center min-h-[200px]">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!latest) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-warm p-8 text-center space-y-3">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <FileText className="size-6" />
          </div>
        </div>
        <h3 className="font-heading text-base font-semibold text-foreground">
          No assessment results yet
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Once a worksheet is uploaded and scored, your child's progress will appear here.
        </p>
      </div>
    );
  }

  const formattedDate = new Date(latest.submissionDate).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="rounded-xl border border-border bg-card shadow-warm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">
              {latest.activityText}
            </p>
            <p className="text-xs text-muted-foreground">{formattedDate}</p>
          </div>
          {latest.scoreSource !== "none" && (
            <ScoreSourceIndicator source={latest.scoreSource} compact />
          )}
        </div>

        {/* Composite Score */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              Overall Score
            </span>
            <BandBadge score={latest.scores.composite} />
          </div>
          <BandPositionBar score={latest.scores.composite} showLabel />
        </div>
      </div>

      {/* Criterion Breakdown */}
      <div className="border-t border-border/60 px-5 pb-4 pt-1">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-3 pb-1">
          Per-Criterion Breakdown
        </h3>
        {PARENT_CRITERIA.map((criterion) => (
          <CriterionFeedbackRow
            key={criterion.criterionKey}
            criterionKey={criterion.criterionKey}
            label={criterion.label}
            score={latest.scores[criterion.criterionKey]}
            band={latest.bands[criterion.criterionKey]}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```
cd frontend; npx tsc --noEmit
```
Expected: No type errors

- [ ] **Step 4: Commit**

```
git add frontend/components/parent/criterion-feedback-row.tsx frontend/components/parent/latest-submission-card.tsx
git commit -m "feat(parent): add latest submission card with criterion breakdown and diagnostic notes"
```

---

### Task 5: Take-Home Activities List and Progress Page Assembly

Build the take-home activities card list and assemble the complete progress page with all four zones.

**Files:**
- Create: `frontend/components/parent/take-home-activities.tsx`
- Modify: `frontend/app/(parent)/progress/page.tsx`

**Interfaces:**
- Consumes:
  - `useParentPortal()` from `components/parent-portal-provider.tsx` (Task 3) — provides `selectedChildId`, `selectedChild`
  - `useChildScoreHistory(childId)` from `lib/hooks/use-parent-data.ts` (Task 2)
  - `useTakeHomeActivities(childId)` from `lib/hooks/use-parent-data.ts` (Task 2)
  - `useChildSubmissionForActivity(childId, activityId)` from `lib/hooks/use-parent-data.ts` (Task 2)
  - `LatestSubmissionCard` from `components/parent/latest-submission-card.tsx` (Task 4)
  - `CriterionTrendChart` from `components/dashboard/criterion-trend-chart.tsx` (existing)
  - `BandBadge` from `components/shared/band-badge.tsx` (existing)
- Produces: Complete `/progress` page with all four zones (child header, latest submission, trend chart, take-home activities)

- [ ] **Step 1: Create `TakeHomeActivities` component**

Create `frontend/components/parent/take-home-activities.tsx`:

```tsx
"use client";

import {
  useTakeHomeActivities,
  useChildSubmissionForActivity,
} from "@/lib/hooks/use-parent-data";
import { BandBadge } from "@/components/shared/band-badge";
import { Button } from "@/components/ui/button";
import { Upload, ClipboardList, Loader2, CheckCircle2, XCircle } from "lucide-react";

interface TakeHomeActivitiesProps {
  childId: string | null;
  onUploadClick: (activityId: string) => void;
}

export function TakeHomeActivities({
  childId,
  onUploadClick,
}: TakeHomeActivitiesProps) {
  const { data: activities, isLoading } = useTakeHomeActivities(childId);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card shadow-warm p-8 text-center space-y-3">
        <div className="flex justify-center">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
            <ClipboardList className="size-6" />
          </div>
        </div>
        <h3 className="font-heading text-base font-semibold text-foreground">
          No take-home activities assigned yet
        </h3>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Your child's teacher will assign activities here when ready.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {activities.map((activity) => (
        <TakeHomeActivityCard
          key={activity.id}
          activityId={activity.id}
          targetText={activity.targetText}
          createdAt={activity.createdAt}
          childId={childId}
          onUploadClick={() => onUploadClick(activity.id)}
        />
      ))}
    </div>
  );
}

function TakeHomeActivityCard({
  activityId,
  targetText,
  createdAt,
  childId,
  onUploadClick,
}: {
  activityId: string;
  targetText: string;
  createdAt: string;
  childId: string | null;
  onUploadClick: () => void;
}) {
  const { data: submission, isLoading } = useChildSubmissionForActivity(
    childId,
    activityId
  );

  const formattedDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="rounded-xl border border-border bg-card shadow-warm p-4 space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground line-clamp-2">
          {targetText}
        </p>
        <p className="text-xs text-muted-foreground">Assigned {formattedDate}</p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          <span>Checking...</span>
        </div>
      ) : submission ? (
        <div className="flex items-center gap-2">
          {submission.status === "completed" ? (
            <>
              <CheckCircle2 className="size-4 text-brand-600 shrink-0" />
              <span className="text-xs text-muted-foreground">Submitted</span>
              {submission.compositeScore != null && (
                <BandBadge score={submission.compositeScore} size="sm" />
              )}
            </>
          ) : (
            <>
              <XCircle className="size-4 text-destructive shrink-0" />
              <span className="text-xs text-muted-foreground">
                Photo rejected — retake needed
              </span>
            </>
          )}
        </div>
      ) : (
        <Button
          variant="default"
          size="sm"
          className="h-9 gap-1.5 shadow-warm w-full sm:w-auto"
          onClick={onUploadClick}
        >
          <Upload className="size-3.5" />
          Upload Worksheet
        </Button>
      )}

      {/* Allow re-upload even if rejected */}
      {submission?.status === "rejected" && (
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 w-full sm:w-auto"
          onClick={onUploadClick}
        >
          <Upload className="size-3.5" />
          Retake Photo
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Assemble the progress page**

Replace `frontend/app/(parent)/progress/page.tsx`:

```tsx
import type { Metadata } from "next";
import { ProgressPageContent } from "./progress-content";

export const metadata: Metadata = {
  title: "Progress — WriteWise",
  description:
    "View your child's handwriting progress, scores, and diagnostic feedback.",
};

export default function ProgressPage() {
  return <ProgressPageContent />;
}
```

Create `frontend/app/(parent)/progress/progress-content.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useParentPortal } from "@/components/parent-portal-provider";
import { LatestSubmissionCard } from "@/components/parent/latest-submission-card";
import { TakeHomeActivities } from "@/components/parent/take-home-activities";
import { CriterionTrendChart } from "@/components/dashboard/criterion-trend-chart";
import { useChildScoreHistory } from "@/lib/hooks/use-parent-data";
import { ParentUploadDialog } from "@/components/parent/parent-upload-dialog";
import { LineChart, Loader2 } from "lucide-react";

export function ProgressPageContent() {
  const { selectedChildId, selectedChild, isLoading: childrenLoading } = useParentPortal();
  const { data: history, isLoading: historyLoading } = useChildScoreHistory(selectedChildId);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [prefilledActivityId, setPrefilledActivityId] = useState<string | undefined>();

  const handleUploadClick = (activityId?: string) => {
    setPrefilledActivityId(activityId);
    setUploadOpen(true);
  };

  if (childrenLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!selectedChild) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-center">
        <p className="text-muted-foreground text-sm">
          No linked children found. Please contact your child's teacher.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Zone 1: Child Header */}
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          {selectedChild.fullName}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {selectedChild.section}
        </p>
      </div>

      {/* Zone 2: Latest Submission Summary */}
      <section aria-labelledby="latest-heading">
        <h2
          id="latest-heading"
          className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3"
        >
          Latest Assessment
        </h2>
        <LatestSubmissionCard childId={selectedChildId} />
      </section>

      {/* Zone 3: Trend Charts */}
      <section aria-labelledby="trends-heading">
        <h2
          id="trends-heading"
          className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3"
        >
          Progress Over Time
        </h2>
        {historyLoading ? (
          <div className="rounded-xl border border-border bg-card shadow-warm p-6 flex justify-center">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : history && history.length >= 2 ? (
          <div className="rounded-xl border border-border bg-card shadow-warm p-4 sm:p-5">
            <CriterionTrendChart history={history} />
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card shadow-warm p-8 text-center space-y-3">
            <div className="flex justify-center">
              <div className="flex size-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700">
                <LineChart className="size-6" />
              </div>
            </div>
            <h3 className="font-heading text-base font-semibold text-foreground">
              Trends coming soon
            </h3>
            <p className="text-sm text-muted-foreground max-w-sm mx-auto">
              Trend charts appear after two or more scored submissions.
            </p>
          </div>
        )}
      </section>

      {/* Zone 4: Take-Home Activities */}
      <section aria-labelledby="activities-heading">
        <h2
          id="activities-heading"
          className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3"
        >
          Take-Home Activities
        </h2>
        <TakeHomeActivities
          childId={selectedChildId}
          onUploadClick={handleUploadClick}
        />
      </section>

      {/* Upload Dialog — added in Task 6 */}
      {selectedChildId && (
        <ParentUploadDialog
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          childId={selectedChildId}
          childName={selectedChild.fullName}
          prefilledActivityId={prefilledActivityId}
        />
      )}
    </div>
  );
}
```

> **Note:** The `ParentUploadDialog` import will cause a type error until Task 6 creates it. The implementing agent can either: (a) comment out the import/usage and uncomment in Task 6, or (b) create a stub file for it now.

- [ ] **Step 3: Verify TypeScript compiles** (may need stub for `ParentUploadDialog`)

```
cd frontend; npx tsc --noEmit
```

- [ ] **Step 4: Manually verify the page renders** in the browser at `http://localhost:3000/progress` (logged in as a parent user)

- [ ] **Step 5: Commit**

```
git add frontend/components/parent/take-home-activities.tsx frontend/app/(parent)/progress/page.tsx frontend/app/(parent)/progress/progress-content.tsx
git commit -m "feat(parent): assemble progress page with latest submission card, trend chart, and take-home activities"
```

---

### Task 6: Parent Upload Dialog

Build the simplified 3-step upload dialog for parents submitting take-home worksheets.

**Files:**
- Create: `frontend/components/parent/parent-upload-dialog.tsx`
- Modify: `frontend/components/parent-portal-provider.tsx` (wire up upload dialog trigger from nav)

**Interfaces:**
- Consumes:
  - `useUploadSubmission()` from `lib/hooks/use-submissions.ts` (existing — same mutation, different caller role)
  - `useTakeHomeActivities(childId)` from `lib/hooks/use-parent-data.ts` (Task 2)
  - shadcn `Dialog`, `Button` components
- Produces: `<ParentUploadDialog open childId childName prefilledActivityId? onOpenChange />` — self-contained dialog with 3-step flow (select activity → capture → processing/result)

- [ ] **Step 1: Create the parent upload dialog**

Create `frontend/components/parent/parent-upload-dialog.tsx`:

```tsx
"use client";

import { useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useTakeHomeActivities } from "@/lib/hooks/use-parent-data";
import { useUploadSubmission } from "@/lib/hooks/use-submissions";
import { toast } from "sonner";
import {
  UploadCloudIcon,
  CameraIcon,
  FileImageIcon,
  CheckCircle2Icon,
  ArrowLeftIcon,
  Loader2Icon,
  AlertCircleIcon,
  RotateCcwIcon,
  ShieldCheckIcon,
  ChevronDownIcon,
  LightbulbIcon,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

interface ParentUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  childId: string;
  childName: string;
  prefilledActivityId?: string;
}

type Step = "select" | "capture" | "processing";

const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png"];
const MAX_FILE_SIZE = 15 * 1024 * 1024;

function errorMessageFor(code: string): string {
  switch (code) {
    case "UNSUPPORTED_FILE_TYPE":
      return "That file isn't a supported image. Please choose a JPEG or PNG.";
    case "FILE_TOO_LARGE":
      return "The image is too large. Please use a file 15 MB or smaller.";
    case "NOT_FOUND":
      return "The activity wasn't found. It may have been removed.";
    case "QUALITY_GATE_RESOLUTION":
      return "The photo needs more detail. Move a little closer and retake it.";
    case "QUALITY_GATE_BLUR":
      return "The photo is a bit blurry. Hold the camera steady and retake it.";
    case "QUALITY_GATE_BRIGHTNESS":
      return "The photo is too dark or washed out. Try adjusting the lighting and retake it.";
    case "QUALITY_GATE_CONTRAST":
      return "The pencil strokes are faint. Try adjusting the lighting or angle and retake it.";
    case "SEGMENTATION_COUNT_MISMATCH":
      return "The handwritten words couldn't be matched to the activity. Please check that your child followed the prompt and retake.";
    case "UNAUTHORIZED":
      return "Your session has expired. Please sign in again.";
    case "FORBIDDEN":
      return "You don't have permission to upload for this activity.";
    default:
      return "Upload failed. Please check your connection and try again.";
  }
}

// Touch detection helpers (same pattern as teacher dialog)
function subscribeTouch(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(pointer: coarse)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getTouchSnapshot() {
  if (typeof window === "undefined") return false;
  return (
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches
  );
}

export function ParentUploadDialog({
  open,
  onOpenChange,
  childId,
  childName,
  prefilledActivityId,
}: ParentUploadDialogProps) {
  const [isUploading, setIsUploading] = useState(false);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && isUploading) return;
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        showCloseButton={!isUploading}
        className="w-[calc(100%-1.5rem)] max-w-xl max-h-[min(92dvh,calc(100vh-2rem))] p-0 gap-0 overflow-hidden flex flex-col shadow-warm"
      >
        <ParentUploadFlow
          key={open ? "open" : "closed"}
          onClose={() => onOpenChange(false)}
          childId={childId}
          childName={childName}
          prefilledActivityId={prefilledActivityId}
          onUploadingChange={setIsUploading}
        />
      </DialogContent>
    </Dialog>
  );
}

function ParentUploadFlow({
  onClose,
  childId,
  childName,
  prefilledActivityId,
  onUploadingChange,
}: {
  onClose: () => void;
  childId: string;
  childName: string;
  prefilledActivityId?: string;
  onUploadingChange?: (uploading: boolean) => void;
}) {
  const photoTipsId = useId();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef<string | null>(null);

  const [step, setStep] = useState<Step>(prefilledActivityId ? "capture" : "select");
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(
    prefilledActivityId ?? null
  );
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [showTips, setShowTips] = useState(false);
  const [uploadError, setUploadError] = useState<{ code: string; message: string } | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const { data: activities } = useTakeHomeActivities(childId);
  const uploadMutation = useUploadSubmission();
  const queryClient = useQueryClient();

  const isMobile = useSyncExternalStore(subscribeTouch, getTouchSnapshot, () => false);

  const isUploading = step === "processing" && !uploadError && !uploadSuccess && uploadMutation.isPending;

  useEffect(() => {
    onUploadingChange?.(isUploading);
  }, [isUploading, onUploadingChange]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const selectedActivity = useMemo(() => {
    return activities?.find((a) => a.id === selectedActivityId) ?? null;
  }, [activities, selectedActivityId]);

  const handleFileChange = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      toast.error("Please select a JPEG or PNG image.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error("Image file size must be less than 15MB.");
      return;
    }
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    previewUrlRef.current = url;
    setPreviewUrl(url);
    setUploadError(null);
  };

  const handleRetake = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploadError(null);
    setUploadSuccess(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleSubmit = () => {
    if (!selectedFile || !selectedActivityId) return;
    setStep("processing");
    setUploadError(null);
    setUploadSuccess(false);

    uploadMutation.mutate(
      { image: selectedFile, activityId: selectedActivityId, studentId: childId },
      {
        onSuccess: () => {
          setUploadSuccess(true);
          toast.success("Worksheet uploaded successfully.");
          // Invalidate parent-specific queries so the progress page refreshes
          queryClient.invalidateQueries({ queryKey: ["parent-child-latest-scores"] });
          queryClient.invalidateQueries({ queryKey: ["parent-child-score-history"] });
          queryClient.invalidateQueries({ queryKey: ["parent-child-submission"] });
          queryClient.invalidateQueries({ queryKey: ["parent-take-home-activities"] });
        },
        onError: (err) => {
          const error =
            err && typeof err === "object" && "code" in err
              ? (err as { code: string; message: string })
              : { code: "INTERNAL_ERROR", message: "Upload failed." };
          setUploadError(error);
        },
      }
    );
  };

  // The implementing agent should render the full 3-step UI here,
  // following the patterns established by the teacher's QuickUploadDialog:
  //
  // Step "select": List of take-home activities as tappable cards
  // Step "capture": File input + dropzone + preview + confirm (Retake/Submit)
  // Step "processing": Staged spinner OR error banner OR success summary
  //
  // Key differences from teacher dialog:
  // - No student picker (childId is a prop)
  // - No step progress bar (only 3 steps, simpler flow)
  // - Activity list is flat cards, not a combobox
  // - Confirmation text: "Student: {childName} · Activity: {activityText}"
  //
  // The full JSX is omitted here for plan brevity — it follows the same
  // structural patterns as quick-upload-dialog.tsx steps 2-5 with the
  // simplifications noted in the spec §5.

  return (
    <>
      <DialogHeader className="px-4 sm:px-6 pt-4 sm:pt-5 pb-3 border-b border-border pr-12">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
            <UploadCloudIcon className="size-5" />
          </div>
          <div>
            <DialogTitle className="text-base sm:text-lg font-semibold">
              Upload Worksheet
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground mt-0.5">
              Upload a take-home worksheet for {childName}.
            </DialogDescription>
          </div>
        </div>
      </DialogHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-4">
        {/* Step rendering goes here — see implementation note above */}
        {/* The implementing agent builds the full step UI */}
      </div>
    </>
  );
}
```

> **Implementation note:** The step-by-step JSX follows the same structural patterns as `quick-upload-dialog.tsx` (capture dropzone, preview image, processing spinner, error banner, success result). The implementing agent should reference steps 2–5 of that file and adapt them for the parent context: no student picker, flat activity list instead of combobox, confirmation shows child name from props.

- [ ] **Step 2: Wire the upload dialog trigger from the nav**

In `frontend/components/parent-portal-provider.tsx`, add the `ParentUploadDialog` rendering and connect the nav's upload button to the dialog state. The provider already has `uploadOpen` state — import and render the dialog component.

- [ ] **Step 3: Verify TypeScript compiles**

```
cd frontend; npx tsc --noEmit
```
Expected: No type errors

- [ ] **Step 4: Verify lint passes**

```
cd frontend; npx eslint .
```
Expected: No errors

- [ ] **Step 5: Manually verify the upload flow** — log in as a parent user, navigate to `/progress`, click "Upload Worksheet" on a take-home activity card, go through the full flow

- [ ] **Step 6: Commit**

```
git add frontend/components/parent/parent-upload-dialog.tsx frontend/components/parent-portal-provider.tsx
git commit -m "feat(parent): add simplified parent upload dialog for take-home worksheets"
```

---

### Task 7: Update IMPLEMENTATION_STATUS and Final Verification

Update the implementation tracker and run full verification.

**Files:**
- Modify: `IMPLEMENTATION_STATUS.md`

**Interfaces:**
- Consumes: All previous tasks (1–6)
- Produces: Updated implementation tracker reflecting completed parent portal items

- [ ] **Step 1: Update IMPLEMENTATION_STATUS.md**

Mark the following items as "Done":

**Phase 2 → Parent Portal:**
- `Parent login & own-child-only view` → Done
- `Per-criterion trend chart + composite trend` → Done
- `Latest diagnostic feedback view` → Done (using template notes, not visual overlay)
- `Upload submission for teacher-assigned activity` → Done

**Phase 2 → Diagnostic Engine** (partial completion from shared components):
- `Numeric score → qualitative band conversion` → Done (already existed in `scoring.ts`, now used by parent portal)
- `Criterion-by-criterion text explanation` → Done (20 template notes in `scoring.ts`, rendered in `CriterionFeedbackRow`)

Update the summary table:
- Phase 2: change from `2 / 11` to reflect the new completions

- [ ] **Step 2: Run full frontend verification**

```
cd frontend; npx tsc --noEmit
cd frontend; npx eslint .
```
Expected: Both pass

- [ ] **Step 3: Run full backend verification**

```
cd backend; uv run ruff check .
cd backend; uv run pytest tests/ -v
```
Expected: Both pass (including new parent submission tests)

- [ ] **Step 4: Manual QA pass**

Test the following flows as a parent user:
1. Login → redirected to `/progress`
2. Progress page loads with child header, latest submission card, trend charts, take-home activities
3. Child switcher works (if multi-child parent)
4. Upload dialog opens from take-home activity card, completes successfully
5. Upload dialog opens from nav button, allows activity selection
6. Sign-out works from the nav dropdown
7. Teacher routes (`/dashboard`, `/roster`, etc.) redirect parent back to `/progress`

- [ ] **Step 5: Commit and push**

```
git add IMPLEMENTATION_STATUS.md
git commit -m "docs: update implementation status — parent portal complete"
```

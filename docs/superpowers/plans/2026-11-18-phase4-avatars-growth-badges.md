# Phase 4 — Student Avatars & Growth Badges Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Reddit-inspired cartoon avatars with evolving decorative borders and growth-event badges to both teacher and parent portals.

**Architecture:** A new `student_badge` table stores permanently earned badges, computed in the Python backend after submission release. A new `avatar_id` column on `student` stores the chosen avatar slug. The frontend renders SVG avatars with CSS/SVG border frames whose tier is derived from earned badges. Badge notifications reuse the existing Phase 3 Slice 3 bell infrastructure.

**Tech Stack:** Supabase (Postgres migration, RLS), FastAPI (Python badge engine, API), Next.js/React (avatar components, popover picker, badge UI), shadcn/ui (Popover, Avatar), SVG assets, tw-animate-css (celebration animation)

**Spec:** [`docs/superpowers/specs/2026-11-18-phase4-avatars-growth-badges-design.md`](file:///c:/Users/Admin/Documents/CODING%20PROJECTS/writewise/docs/superpowers/specs/2026-11-18-phase4-avatars-growth-badges-design.md)

## Global Constraints

- Postgres enum for badge types — `supabase gen types` must map them to TypeScript string-literal unions
- Avatars are SVG files committed to `frontend/public/avatars/`, not stored in Supabase Storage
- Badge rows are write-once, inserted via service-role key only — no client insert/update/delete policies
- Only released, counted submissions drive badge evaluation — consistent with Phase 3 Slice 2
- Badges are permanent — never deleted or revoked
- All animations respect `prefers-reduced-motion`
- Follow existing test patterns: ephemeral Supabase stack, `TestClient`, `cleanup_students` fixture
- Frontend has no automated test suite — manual QA only per TESTING.md §7
- Regenerate TypeScript types after migration in the same commit

---

### Task 1: Database Schema Migration

**Files:**
- Create: `supabase/migrations/<timestamp>_phase4_avatars_badges.sql`
- Modify: `frontend/src/types/database.ts` (regenerated, not hand-edited)

**Interfaces:**
- Produces: `badge_type` enum, `student.avatar_id` column, `student_badge` table, `badge_earned` notification type, TypeScript types reflecting all of the above

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/<timestamp>_phase4_avatars_badges.sql` (use `supabase migration new phase4_avatars_badges` to generate the timestamp prefix):

```sql
-- Phase 4: Student avatars and growth badges

-- 1. Avatar column on student
alter table public.student add column avatar_id text not null default 'auto';

-- 2. Badge type enum
create type public.badge_type as enum (
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

-- 3. Earned badges table (write-once, permanent)
create table public.student_badge (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.student(id) on delete cascade,
  badge_type public.badge_type not null,
  earned_at timestamptz not null default now(),
  triggered_by_submission_id uuid references public.submission(id) on delete set null,
  unique (student_id, badge_type)
);
create index student_badge_student on public.student_badge(student_id);
alter table public.student_badge enable row level security;

-- 4. RLS: read-only for authenticated callers, scoped to roster/parent links
revoke all on public.student_badge from public, anon, authenticated;
grant select on public.student_badge to authenticated;
grant select, insert, update, delete on public.student_badge to service_role;

create policy student_badge_teacher_select on public.student_badge
  for select to authenticated using (
    exists (
      select 1 from public.teacher_student ts
      where ts.student_id = student_badge.student_id
        and ts.teacher_id = (select auth.uid())
    )
  );

create policy student_badge_parent_select on public.student_badge
  for select to authenticated using (
    exists (
      select 1 from public.student_parent sp
      where sp.student_id = student_badge.student_id
        and sp.parent_id = (select auth.uid())
    )
  );

-- 5. Extend notification_type enum with badge_earned
alter type public.notification_type add value 'badge_earned';

-- 6. Relax the notification submission_id constraint to allow badge_earned
--    (badge notifications have no submission_id but are not in the original
--     submission-required set either, so the existing constraint already
--     permits null submission_id for new types not in the check list.
--    Verify: the check says submission_id is NOT NULL only when type is in
--    the original set. 'badge_earned' is not in that set, so submission_id
--    can be null. No constraint change needed.)
```

- [ ] **Step 2: Apply the migration and verify**

Run:
```bash
cd supabase
supabase db reset
```
Expected: migration applies without errors, `supabase db reset` completes cleanly.

- [ ] **Step 3: Regenerate TypeScript types**

Run:
```bash
supabase gen types typescript --project-id <dev-project-id> > frontend/src/types/database.ts
```
Expected: `database.ts` now contains `avatar_id` on the `student` row type, `badge_type` enum, and `student_badge` table type.

- [ ] **Step 4: Verify notification constraint compatibility**

The existing `notification_submission_kind` check constraint (from `20261108060218_phase3_gradebook_lifecycle.sql` L2-7) says:
```sql
(type='score_released') or ((submission_id is not null)=(type in (
  'submission_returned','submission_rejected','resubmitted_after_return')))
```
For `type='badge_earned'`: it's not `'score_released'`, so the second branch evaluates. `'badge_earned'` is NOT in the `('submission_returned','submission_rejected','resubmitted_after_return')` set, so the right side is `false`. With `submission_id = null`, the left side `(null is not null)` is also `false`. `false = false` is `true`. Constraint passes. No change needed.

Verify by inserting a test notification row via SQL in the Supabase SQL editor:
```sql
-- Quick manual check (delete after)
insert into public.notification (recipient_id, type, activity_id, student_id, submission_id, dedupe_key)
values (
  (select id from public.teacher limit 1),
  'badge_earned',
  (select id from public.activity limit 1),
  (select id from public.student limit 1),
  null,
  'test_badge_notification'
);
delete from public.notification where dedupe_key = 'test_badge_notification';
```
Expected: insert and delete succeed without constraint violation.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/*phase4* frontend/src/types/database.ts
git commit -m "feat: add Phase 4 avatars and badges schema migration"
```

---

### Task 2: Avatar Pool & Backend API

**Files:**
- Create: `frontend/public/avatars/` directory with placeholder SVGs
- Create: `backend/app/api/avatars.py`
- Modify: `backend/app/api/students.py:20-26` (extend `StudentUpdate`)
- Modify: `backend/app/api/students.py:254-349` (handle `avatar_id` in update)
- Modify: `backend/app/api/students.py:340-349` (include `avatar_id` in response)
- Modify: `backend/app/main.py` (register avatars router)
- Test: `backend/tests/api/test_avatars.py`
- Test: `backend/tests/api/test_students.py` (extend existing)

**Interfaces:**
- Consumes: `student.avatar_id` column from Task 1
- Produces:
  - `GET /api/avatars` → `list[AvatarInfo]` where `AvatarInfo = { slug: str, path: str }`
  - `PATCH /api/students/{id}` accepts `avatar_id: Optional[str]`
  - `AVATAR_POOL: list[str]` constant (the known slugs)

- [ ] **Step 1: Create placeholder avatar SVGs**

Create `frontend/public/avatars/` with 6 minimal placeholder SVGs (the full 15–20 illustrated set is an open item; these are functional placeholders):

```bash
mkdir -p frontend/public/avatars
```

Create each file as a simple colored circle with a letter (temporary — real illustrations replace these later). Create `frontend/public/avatars/pen.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <circle cx="32" cy="32" r="30" fill="#E4F1EF"/>
  <text x="32" y="38" text-anchor="middle" font-size="20" fill="#1B6B63" font-family="sans-serif">✏️</text>
</svg>
```

Repeat for `notebook.svg`, `inkdrop.svg`, `eraser.svg`, `pencil.svg`, `quill.svg` — same structure, different emoji/colors. These are throwaway placeholders.

- [ ] **Step 2: Write the failing test for GET /avatars**

Create `backend/tests/api/test_avatars.py`:

```python
def test_get_avatars(client):
    response = client.get("/api/avatars")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 6
    for avatar in data:
        assert "slug" in avatar
        assert "path" in avatar
        assert avatar["path"].startswith("/avatars/")
        assert avatar["path"].endswith(".svg")
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/api/test_avatars.py::test_get_avatars -v`
Expected: FAIL with 404 (route not found)

- [ ] **Step 4: Implement GET /avatars endpoint**

Create `backend/app/api/avatars.py`:

```python
"""Avatar pool — static SVG slugs committed to the frontend repo."""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

AVATAR_POOL = ["pen", "notebook", "inkdrop", "eraser", "pencil", "quill"]


class AvatarInfo(BaseModel):
    slug: str
    path: str


@router.get("", response_model=list[AvatarInfo])
def list_avatars():
    return [AvatarInfo(slug=s, path=f"/avatars/{s}.svg") for s in AVATAR_POOL]
```

- [ ] **Step 5: Register the avatars router in main.py**

In `backend/app/main.py`, add alongside the existing router includes:

```python
from app.api.avatars import router as avatars_router
# ...
app.include_router(avatars_router, prefix="/api/avatars", tags=["avatars"])
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd backend && uv run pytest tests/api/test_avatars.py::test_get_avatars -v`
Expected: PASS

- [ ] **Step 7: Write failing test for avatar_id on PATCH /students/{id}**

Add to `backend/tests/api/test_students.py`:

```python
def test_update_student_avatar(client, cleanup_students):
    # Create a student first
    create_res = client.post("/api/students", json={"full_name": "Avatar Test", "section": "Test"})
    assert create_res.status_code == 200
    student_id = create_res.json()["id"]
    cleanup_students.append(student_id)

    # Update avatar_id to a valid slug
    res = client.patch(f"/api/students/{student_id}", json={"avatar_id": "pen"})
    assert res.status_code == 200
    assert res.json()["avatar_id"] == "pen"


def test_update_student_avatar_invalid(client, cleanup_students):
    create_res = client.post("/api/students", json={"full_name": "Avatar Invalid", "section": "Test"})
    assert create_res.status_code == 200
    student_id = create_res.json()["id"]
    cleanup_students.append(student_id)

    res = client.patch(f"/api/students/{student_id}", json={"avatar_id": "nonexistent"})
    assert res.status_code == 400
    assert res.json()["detail"]["code"] == "INVALID_AVATAR"
```

- [ ] **Step 8: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/api/test_students.py::test_update_student_avatar tests/api/test_students.py::test_update_student_avatar_invalid -v`
Expected: FAIL (avatar_id not accepted or not returned)

- [ ] **Step 9: Extend StudentUpdate and update_student to handle avatar_id**

In `backend/app/api/students.py`, modify `StudentUpdate` (L20-26):

```python
class StudentUpdate(BaseModel):
    full_name: Optional[str] = None
    section: Optional[str] = None
    section_id: Optional[str] = None
    parent_email: Optional[str] = None
    avatar_id: Optional[str] = None

    model_config = ConfigDict(extra="ignore")
```

In the `update_student` function, after the existing field checks (around L301, before `if update_data:`), add avatar validation:

```python
    if student_in.avatar_id is not None:
        from app.api.avatars import AVATAR_POOL

        if student_in.avatar_id not in AVATAR_POOL and student_in.avatar_id != "auto":
            raise HTTPException(
                status_code=400,
                detail={
                    "code": "INVALID_AVATAR",
                    "message": "Avatar not found in the available pool.",
                    "details": {},
                },
            )
        update_data["avatar_id"] = student_in.avatar_id
```

In the response dict (L340-349), add `avatar_id`:

```python
    return {
        "id": student_id,
        "full_name": student["full_name"],
        "section": student["section"],
        "avatar_id": student.get("avatar_id", "auto"),
        "parent_email": student.get("parent_email"),
        "parent_status": student.get("parent_status"),
        "parent_invited": parent_invited,
        "parent_invite_error": parent_invite_error,
        "created_at": student["created_at"],
    }
```

Also update the `create_student` response (around L200-216) to include `avatar_id` in its return dict.

- [ ] **Step 10: Run tests to verify they pass**

Run: `cd backend && uv run pytest tests/api/test_students.py::test_update_student_avatar tests/api/test_students.py::test_update_student_avatar_invalid -v`
Expected: PASS

- [ ] **Step 11: Run full student + avatar test suites**

Run: `cd backend && uv run pytest tests/api/test_students.py tests/api/test_avatars.py -v`
Expected: all PASS

- [ ] **Step 12: Commit**

```bash
git add backend/app/api/avatars.py backend/app/api/students.py backend/app/main.py \
  backend/tests/api/test_avatars.py backend/tests/api/test_students.py \
  frontend/public/avatars/
git commit -m "feat: add avatar pool endpoint and avatar_id on student PATCH"
```

---

### Task 3: Badge Computation Engine & API

**Files:**
- Create: `backend/app/badges/__init__.py`
- Create: `backend/app/badges/engine.py`
- Create: `backend/app/badges/constants.py`
- Create: `backend/app/api/badges.py`
- Modify: `backend/app/main.py` (register badges router)
- Test: `backend/tests/badges/__init__.py`
- Test: `backend/tests/badges/test_engine.py`
- Test: `backend/tests/api/test_badges.py`

**Interfaces:**
- Consumes: `student_badge` table, `badge_type` enum, `measurement` table (for per-criterion scores), `submission` table (for composite scores and release status) from Task 1
- Produces:
  - `evaluate_badges(student_id: str) -> list[str]` — returns list of newly awarded badge_type strings
  - `BADGE_TIER_MAP: dict[str, int]` — maps badge_type to border tier (0–5)
  - `GET /api/students/{id}/badges` → `BadgeResponse = { badges: list[EarnedBadge], border_tier: int, border_tier_name: str }`

- [ ] **Step 1: Create badge constants**

Create `backend/app/badges/__init__.py` (empty).

Create `backend/app/badges/constants.py`:

```python
"""Badge definitions and tier mapping (spec §3, §4.1)."""

# Badge type → border tier
BADGE_TIER_MAP: dict[str, int] = {
    "first_steps": 1,
    "first_improvement": 2,
    "on_a_roll": 2,
    "well_rounded": 2,
    "clean_sweep": 3,
    "reached_developing": 3,
    "reached_satisfactory": 3,
    "reached_excellent": 4,
    "steady_hand": 4,
    "master_penman": 5,
}

TIER_NAMES: dict[int, str] = {
    0: "Default",
    1: "Starter",
    2: "Growing",
    3: "Strong",
    4: "Outstanding",
    5: "Mastery",
}

# Band thresholds (matches DESIGN.md §2.1 and score_band enum)
BAND_THRESHOLDS = {
    "needs_improvement": (0, 25),
    "developing": (25, 50),
    "satisfactory": (50, 75),
    "excellent": (75, 100),
}


def composite_to_band(score: float) -> str:
    if score >= 75:
        return "excellent"
    elif score >= 50:
        return "satisfactory"
    elif score >= 25:
        return "developing"
    return "needs_improvement"
```

- [ ] **Step 2: Write failing tests for the badge evaluation engine**

Create `backend/tests/badges/__init__.py` (empty).

Create `backend/tests/badges/test_engine.py`:

```python
"""Unit tests for badge evaluation logic.

These test the pure computation functions with mock submission histories,
not the database integration. Database integration is tested in test_badges.py.
"""

import pytest

from app.badges.engine import evaluate_from_history


def _sub(composite: float, criteria: dict | None = None) -> dict:
    """Build a mock released submission history entry."""
    default_criteria = {
        "letter_formation": composite,
        "spacing": composite,
        "slant": composite,
        "baseline_alignment": composite,
        "size_consistency": composite,
    }
    return {
        "composite": composite,
        "criteria": criteria or default_criteria,
    }


class TestFirstSteps:
    def test_no_submissions(self):
        assert "first_steps" not in evaluate_from_history([])

    def test_one_submission(self):
        assert "first_steps" in evaluate_from_history([_sub(30)])


class TestFirstImprovement:
    def test_no_improvement(self):
        result = evaluate_from_history([_sub(30), _sub(25)])
        assert "first_improvement" not in result

    def test_improved(self):
        result = evaluate_from_history([_sub(30), _sub(35)])
        assert "first_improvement" in result

    def test_equal_not_improvement(self):
        result = evaluate_from_history([_sub(30), _sub(30)])
        assert "first_improvement" not in result


class TestOnARoll:
    def test_three_consecutive(self):
        result = evaluate_from_history([_sub(30), _sub(35), _sub(40), _sub(45)])
        assert "on_a_roll" in result

    def test_two_consecutive_not_enough(self):
        result = evaluate_from_history([_sub(30), _sub(35), _sub(40)])
        assert "on_a_roll" not in result

    def test_broken_streak(self):
        result = evaluate_from_history([_sub(30), _sub(35), _sub(30), _sub(35)])
        assert "on_a_roll" not in result


class TestWellRounded:
    def test_three_criteria_improved(self):
        s1 = _sub(30, {"letter_formation": 30, "spacing": 30, "slant": 30,
                       "baseline_alignment": 30, "size_consistency": 30})
        s2 = _sub(40, {"letter_formation": 40, "spacing": 40, "slant": 40,
                       "baseline_alignment": 30, "size_consistency": 30})
        result = evaluate_from_history([s1, s2])
        assert "well_rounded" in result

    def test_two_criteria_not_enough(self):
        s1 = _sub(30, {"letter_formation": 30, "spacing": 30, "slant": 30,
                       "baseline_alignment": 30, "size_consistency": 30})
        s2 = _sub(35, {"letter_formation": 40, "spacing": 40, "slant": 30,
                       "baseline_alignment": 30, "size_consistency": 30})
        result = evaluate_from_history([s1, s2])
        assert "well_rounded" not in result


class TestCleanSweep:
    def test_all_five_improved(self):
        s1 = _sub(30, {"letter_formation": 30, "spacing": 30, "slant": 30,
                       "baseline_alignment": 30, "size_consistency": 30})
        s2 = _sub(50, {"letter_formation": 50, "spacing": 50, "slant": 50,
                       "baseline_alignment": 50, "size_consistency": 50})
        result = evaluate_from_history([s1, s2])
        assert "clean_sweep" in result


class TestBandMilestones:
    def test_reached_developing(self):
        result = evaluate_from_history([_sub(30)])
        assert "reached_developing" in result  # 30 >= 25

    def test_reached_satisfactory(self):
        result = evaluate_from_history([_sub(55)])
        assert "reached_satisfactory" in result

    def test_reached_excellent(self):
        result = evaluate_from_history([_sub(80)])
        assert "reached_excellent" in result

    def test_needs_improvement_no_band_badge(self):
        result = evaluate_from_history([_sub(10)])
        assert "reached_developing" not in result
        assert "reached_satisfactory" not in result
        assert "reached_excellent" not in result


class TestSteadyHand:
    def test_three_consecutive_satisfactory(self):
        result = evaluate_from_history([_sub(55), _sub(60), _sub(65)])
        assert "steady_hand" in result

    def test_two_not_enough(self):
        result = evaluate_from_history([_sub(55), _sub(60)])
        assert "steady_hand" not in result

    def test_broken_by_developing(self):
        result = evaluate_from_history([_sub(55), _sub(60), _sub(30), _sub(55)])
        assert "steady_hand" not in result


class TestMasterPenman:
    def test_three_consecutive_excellent(self):
        result = evaluate_from_history([_sub(80), _sub(85), _sub(90)])
        assert "master_penman" in result

    def test_satisfactory_breaks_streak(self):
        result = evaluate_from_history([_sub(80), _sub(85), _sub(60)])
        assert "master_penman" not in result
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/badges/test_engine.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.badges.engine'`

- [ ] **Step 4: Implement the badge evaluation engine**

Create `backend/app/badges/engine.py`:

```python
"""Badge evaluation engine — pure functions over submission histories.

Spec: docs/superpowers/specs/2026-11-18-phase4-avatars-growth-badges-design.md §3
"""

from app.badges.constants import composite_to_band

CRITERIA = [
    "letter_formation",
    "spacing",
    "slant",
    "baseline_alignment",
    "size_consistency",
]


def evaluate_from_history(history: list[dict]) -> set[str]:
    """Evaluate all badge conditions against a chronological submission history.

    Each entry in ``history`` must have:
      - ``composite``: float (0–100)
      - ``criteria``: dict mapping criterion name → float score

    Returns the set of badge_type strings the student has earned.
    """
    earned: set[str] = set()

    if not history:
        return earned

    # --- Participation ---
    earned.add("first_steps")

    # --- Band milestones (highest band ever reached) ---
    bands_seen: set[str] = set()
    for sub in history:
        band = composite_to_band(sub["composite"])
        bands_seen.add(band)

    if "developing" in bands_seen or "satisfactory" in bands_seen or "excellent" in bands_seen:
        earned.add("reached_developing")
    if "satisfactory" in bands_seen or "excellent" in bands_seen:
        earned.add("reached_satisfactory")
    if "excellent" in bands_seen:
        earned.add("reached_excellent")

    # --- Improvement tracking (pairwise comparisons) ---
    has_improved_ever = False
    consecutive_improvements = 0
    max_consecutive_improvements = 0

    for i in range(1, len(history)):
        prev = history[i - 1]
        curr = history[i]

        # Composite improvement
        improved = curr["composite"] > prev["composite"]
        if improved:
            has_improved_ever = True
            consecutive_improvements += 1
            max_consecutive_improvements = max(
                max_consecutive_improvements, consecutive_improvements
            )
        else:
            consecutive_improvements = 0

        # Criterion breadth (per-submission comparison with previous)
        criteria_improved = sum(
            1
            for c in CRITERIA
            if curr["criteria"].get(c, 0) > prev["criteria"].get(c, 0)
        )
        if criteria_improved >= 3:
            earned.add("well_rounded")
        if criteria_improved == 5:
            earned.add("clean_sweep")

    if has_improved_ever:
        earned.add("first_improvement")
    if max_consecutive_improvements >= 3:
        earned.add("on_a_roll")

    # --- Consistency (consecutive bands at or above threshold) ---
    consecutive_satisfactory = 0
    max_consecutive_satisfactory = 0
    consecutive_excellent = 0
    max_consecutive_excellent = 0

    for sub in history:
        band = composite_to_band(sub["composite"])

        if band in ("satisfactory", "excellent"):
            consecutive_satisfactory += 1
            max_consecutive_satisfactory = max(
                max_consecutive_satisfactory, consecutive_satisfactory
            )
        else:
            consecutive_satisfactory = 0

        if band == "excellent":
            consecutive_excellent += 1
            max_consecutive_excellent = max(
                max_consecutive_excellent, consecutive_excellent
            )
        else:
            consecutive_excellent = 0

    if max_consecutive_satisfactory >= 3:
        earned.add("steady_hand")
    if max_consecutive_excellent >= 3:
        earned.add("master_penman")

    return earned


def diff_badges(earned: set[str], already_stored: set[str]) -> list[str]:
    """Return badge types in ``earned`` that are not yet in ``already_stored``."""
    return sorted(earned - already_stored)
```

- [ ] **Step 5: Run engine tests to verify they pass**

Run: `cd backend && uv run pytest tests/badges/test_engine.py -v`
Expected: all PASS

- [ ] **Step 6: Write failing test for GET /students/{id}/badges**

Create `backend/tests/api/test_badges.py`:

```python
import uuid

import pytest

from app.core.supabase import supabase_client
from tests.conftest import TEST_TEACHER_ID


@pytest.fixture
def badge_student(cleanup_students):
    """Create a student linked to the test teacher."""
    student = (
        supabase_client.table("student")
        .insert({"full_name": "Badge Test Student", "section": "Test"})
        .execute()
        .data[0]
    )
    supabase_client.table("teacher_student").insert(
        {"teacher_id": TEST_TEACHER_ID, "student_id": student["id"]}
    ).execute()
    cleanup_students.append(student["id"])
    return student


@pytest.fixture
def cleanup_students():
    student_ids = []
    yield student_ids
    for sid in student_ids:
        supabase_client.table("student_badge").delete().eq("student_id", sid).execute()
        supabase_client.table("teacher_student").delete().eq("student_id", sid).execute()
        supabase_client.table("student").delete().eq("id", sid).execute()


def test_get_badges_empty(client, badge_student):
    res = client.get(f"/api/students/{badge_student['id']}/badges")
    assert res.status_code == 200
    data = res.json()
    assert data["badges"] == []
    assert data["border_tier"] == 0
    assert data["border_tier_name"] == "Default"


def test_get_badges_with_earned(client, badge_student):
    # Insert a badge directly for testing
    supabase_client.table("student_badge").insert(
        {
            "student_id": badge_student["id"],
            "badge_type": "first_steps",
        }
    ).execute()

    res = client.get(f"/api/students/{badge_student['id']}/badges")
    assert res.status_code == 200
    data = res.json()
    assert len(data["badges"]) == 1
    assert data["badges"][0]["badge_type"] == "first_steps"
    assert data["badges"][0]["earned_at"] is not None
    assert data["border_tier"] == 1
    assert data["border_tier_name"] == "Starter"


def test_get_badges_not_found(client):
    fake_id = str(uuid.uuid4())
    res = client.get(f"/api/students/{fake_id}/badges")
    assert res.status_code == 404
```

- [ ] **Step 7: Run test to verify it fails**

Run: `cd backend && uv run pytest tests/api/test_badges.py -v`
Expected: FAIL with 404 (route not found)

- [ ] **Step 8: Implement GET /students/{id}/badges**

Create `backend/app/api/badges.py`:

```python
"""Badge read endpoint — returns earned badges and derived border tier."""

from datetime import datetime
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.deps import get_current_user
from app.badges.constants import BADGE_TIER_MAP, TIER_NAMES
from app.core.supabase import supabase_client

router = APIRouter()


class EarnedBadge(BaseModel):
    badge_type: str
    earned_at: datetime
    triggered_by_submission_id: Optional[UUID] = None


class BadgeResponse(BaseModel):
    badges: list[EarnedBadge]
    border_tier: int
    border_tier_name: str


def _verify_student_access(user: dict, student_id: str) -> None:
    """Check that the caller has roster or parent access to this student."""
    role = user.get("role", "")
    uid = user["sub"]

    if role == "teacher":
        rows = (
            supabase_client.table("teacher_student")
            .select("student_id")
            .eq("teacher_id", uid)
            .eq("student_id", student_id)
            .execute()
            .data
        )
    elif role == "parent":
        rows = (
            supabase_client.table("student_parent")
            .select("student_id")
            .eq("parent_id", uid)
            .eq("student_id", student_id)
            .execute()
            .data
        )
    else:
        rows = []

    if not rows:
        raise HTTPException(
            status_code=404,
            detail={"code": "NOT_FOUND", "message": "Student not found.", "details": {}},
        )


@router.get("/{student_id}/badges", response_model=BadgeResponse)
def get_student_badges(student_id: UUID, user: dict = Depends(get_current_user)):
    _verify_student_access(user, str(student_id))

    badge_rows = (
        supabase_client.table("student_badge")
        .select("badge_type, earned_at, triggered_by_submission_id")
        .eq("student_id", str(student_id))
        .order("earned_at")
        .execute()
        .data
    )

    badges = [EarnedBadge(**row) for row in badge_rows]
    earned_types = {b.badge_type for b in badges}

    border_tier = max(
        (BADGE_TIER_MAP.get(bt, 0) for bt in earned_types),
        default=0,
    )

    return BadgeResponse(
        badges=badges,
        border_tier=border_tier,
        border_tier_name=TIER_NAMES.get(border_tier, "Default"),
    )
```

- [ ] **Step 9: Register the badges router in main.py**

In `backend/app/main.py`, add:

```python
from app.api.badges import router as badges_router
# ...
app.include_router(badges_router, prefix="/api/students", tags=["badges"])
```

- [ ] **Step 10: Run badge API tests to verify they pass**

Run: `cd backend && uv run pytest tests/api/test_badges.py -v`
Expected: all PASS

- [ ] **Step 11: Run lint**

Run: `cd backend && uv run ruff check .`
Expected: clean

- [ ] **Step 12: Commit**

```bash
git add backend/app/badges/ backend/app/api/badges.py backend/app/main.py \
  backend/tests/badges/ backend/tests/api/test_badges.py
git commit -m "feat: add badge evaluation engine and GET /students/{id}/badges"
```

---

### Task 4: Badge Computation on Release

**Files:**
- Create: `backend/app/badges/service.py`
- Modify: `backend/app/api/submission_lifecycle.py:175-179` (hook after single release)
- Modify: `backend/app/api/submission_lifecycle.py:182-192` (hook after bulk release)
- Modify: `backend/app/api/gradebook.py:28-51` (hook after grade release)
- Test: `backend/tests/badges/test_service.py`

**Interfaces:**
- Consumes:
  - `evaluate_from_history(history) -> set[str]` from Task 3
  - `diff_badges(earned, stored) -> list[str]` from Task 3
  - `writewise_internal.notify_work_parents()` SQL function (notification store)
  - `release_submission()`, `release_activity()`, `release_grade()` from submission_lifecycle/gradebook
- Produces:
  - `award_badges_for_student(student_id: str, submission_id: str | None = None) -> list[str]` — the service function called after release

- [ ] **Step 1: Write failing test for badge service**

Create `backend/tests/badges/test_service.py`:

```python
"""Integration tests for badge awarding on release.

Requires the ephemeral Supabase stack (supabase db reset).
"""

import uuid

import pytest

from app.badges.service import award_badges_for_student
from app.core.supabase import supabase_client
from tests.conftest import TEST_TEACHER_ID


@pytest.fixture
def test_activity():
    activity = (
        supabase_client.table("activity")
        .insert({"target_text": "badge test", "created_by": TEST_TEACHER_ID})
        .execute()
        .data[0]
    )
    yield activity
    supabase_client.table("activity").delete().eq("id", activity["id"]).execute()


@pytest.fixture
def test_student():
    student = (
        supabase_client.table("student")
        .insert({"full_name": "Badge Service Test", "section": "Test"})
        .execute()
        .data[0]
    )
    supabase_client.table("teacher_student").insert(
        {"teacher_id": TEST_TEACHER_ID, "student_id": student["id"]}
    ).execute()
    yield student
    supabase_client.table("student_badge").delete().eq(
        "student_id", student["id"]
    ).execute()
    supabase_client.table("teacher_student").delete().eq(
        "student_id", student["id"]
    ).execute()
    supabase_client.table("student").delete().eq("id", student["id"]).execute()


def _create_released_submission(activity_id: str, student_id: str, composite: float):
    """Create a completed, released submission with a measurement row."""
    sub = (
        supabase_client.table("submission")
        .insert(
            {
                "activity_id": activity_id,
                "student_id": student_id,
                "image_path": f"test/{uuid.uuid4()}.jpg",
                "status": "completed",
                "released_at": "now()",
                "uploaded_by": TEST_TEACHER_ID,
            }
        )
        .execute()
        .data[0]
    )
    supabase_client.table("measurement").insert(
        {
            "submission_id": sub["id"],
            "letter_formation_score": composite,
            "spacing_score": composite,
            "slant_score": composite,
            "baseline_alignment_score": composite,
            "size_consistency_score": composite,
            "composite_score": composite,
        }
    ).execute()
    return sub


def test_first_submission_earns_first_steps(test_activity, test_student):
    sub = _create_released_submission(
        test_activity["id"], test_student["id"], 30.0
    )
    new_badges = award_badges_for_student(test_student["id"], sub["id"])
    assert "first_steps" in new_badges
    assert "reached_developing" in new_badges  # 30 >= 25


def test_improvement_earns_badge(test_activity, test_student):
    _create_released_submission(test_activity["id"], test_student["id"], 30.0)
    award_badges_for_student(test_student["id"])
    sub2 = _create_released_submission(
        test_activity["id"], test_student["id"], 50.0
    )
    new_badges = award_badges_for_student(test_student["id"], sub2["id"])
    assert "first_improvement" in new_badges


def test_idempotent_no_duplicate(test_activity, test_student):
    sub = _create_released_submission(
        test_activity["id"], test_student["id"], 30.0
    )
    first_run = award_badges_for_student(test_student["id"], sub["id"])
    second_run = award_badges_for_student(test_student["id"], sub["id"])
    assert len(first_run) > 0
    assert len(second_run) == 0  # Already awarded, no new badges
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && uv run pytest tests/badges/test_service.py -v`
Expected: FAIL with `ModuleNotFoundError: No module named 'app.badges.service'`

- [ ] **Step 3: Implement the badge service**

Create `backend/app/badges/service.py`:

```python
"""Badge service — queries submission history, evaluates, awards, notifies.

Called from release endpoints after the release RPC succeeds.
"""

import logging

from app.badges.constants import BADGE_TIER_MAP
from app.badges.engine import diff_badges, evaluate_from_history
from app.core.supabase import supabase_client

logger = logging.getLogger(__name__)

CRITERIA_COLUMNS = [
    "letter_formation_score",
    "spacing_score",
    "slant_score",
    "baseline_alignment_score",
    "size_consistency_score",
]

CRITERIA_NAMES = [
    "letter_formation",
    "spacing",
    "slant",
    "baseline_alignment",
    "size_consistency",
]


def _build_history(student_id: str) -> list[dict]:
    """Fetch released, counted submissions with their measurements."""
    rows = (
        supabase_client.rpc(
            "student_released_history",
            {"target_student_id": student_id},
        )
        .execute()
        .data
    )

    # Fallback: direct query if the RPC doesn't exist yet
    if rows is None:
        rows = (
            supabase_client.table("submission")
            .select("id, activity_id, created_at, measurement(*)")
            .eq("student_id", student_id)
            .eq("status", "completed")
            .not_.is_("released_at", "null")
            .order("created_at")
            .execute()
            .data
        )

    history = []
    for row in rows or []:
        m = row.get("measurement")
        if isinstance(m, list):
            m = m[0] if m else None
        if not m:
            continue
        composite = m.get("composite_score")
        if composite is None:
            continue
        criteria = {}
        for col, name in zip(CRITERIA_COLUMNS, CRITERIA_NAMES):
            criteria[name] = m.get(col, 0) or 0
        history.append({"composite": composite, "criteria": criteria})

    return history


def _get_stored_badges(student_id: str) -> set[str]:
    rows = (
        supabase_client.table("student_badge")
        .select("badge_type")
        .eq("student_id", student_id)
        .execute()
        .data
    )
    return {r["badge_type"] for r in (rows or [])}


def _notify_parents(student_id: str, badge_type: str, activity_id: str | None) -> None:
    """Enqueue a badge_earned notification for linked parents.

    Uses a direct insert since the existing notify_work_parents RPC requires
    an activity_id. For badge notifications we use the most recent activity
    or skip if none.
    """
    if not activity_id:
        return

    try:
        supabase_client.rpc(
            "notify_work_parents_badge",
            {
                "work_student": student_id,
                "work_activity": activity_id,
                "badge_name": badge_type,
            },
        ).execute()
    except Exception:
        # Badge notification failure must not break the release flow.
        # The badge is still persisted; notification is best-effort.
        logger.warning(
            "Failed to send badge notification for student=%s badge=%s",
            student_id,
            badge_type,
            exc_info=True,
        )


def award_badges_for_student(
    student_id: str,
    submission_id: str | None = None,
    activity_id: str | None = None,
) -> list[str]:
    """Evaluate and award any new badges for a student.

    Returns the list of newly awarded badge_type strings.
    """
    history = _build_history(student_id)
    earned = evaluate_from_history(history)
    stored = _get_stored_badges(student_id)
    new_badges = diff_badges(earned, stored)

    if not new_badges:
        return []

    # Insert new badge rows
    rows_to_insert = [
        {
            "student_id": student_id,
            "badge_type": bt,
            "triggered_by_submission_id": submission_id,
        }
        for bt in new_badges
    ]
    supabase_client.table("student_badge").insert(rows_to_insert).execute()

    # Best-effort notifications
    for bt in new_badges:
        _notify_parents(student_id, bt, activity_id)

    logger.info(
        "Awarded badges student=%s new=%s",
        student_id,
        new_badges,
    )
    return new_badges
```

- [ ] **Step 4: Run service tests to verify they pass**

Run: `cd backend && uv run pytest tests/badges/test_service.py -v`

Note: some tests may need adjustment depending on exact column names in the test database. The `_build_history` fallback query uses the submission + measurement join directly, which should work against the ephemeral stack.

Expected: all PASS

- [ ] **Step 5: Hook badge evaluation into release_submission**

In `backend/app/api/submission_lifecycle.py`, modify `release_submission` (L175-179):

```python
@router.post("/submissions/{submission_id}/release", response_model=ReleaseSubmissionResponse)
def release_submission(submission_id: UUID, teacher: dict = Depends(get_current_teacher)):
    actor = teacher["sub"]
    row = _owned_submission(actor, str(submission_id))
    result = _mutate(actor, row, "release", {"submission_id": str(submission_id)})

    # Phase 4: evaluate badges after successful release
    from app.badges.service import award_badges_for_student

    try:
        award_badges_for_student(
            student_id=row["student_id"],
            submission_id=str(submission_id),
            activity_id=row["activity_id"],
        )
    except Exception:
        import logging

        logging.getLogger(__name__).warning(
            "Badge evaluation failed for submission=%s", submission_id, exc_info=True
        )

    return result
```

- [ ] **Step 6: Hook badge evaluation into release_activity (bulk)**

In `backend/app/api/submission_lifecycle.py`, modify `release_activity` (L182-192):

```python
@router.post("/activities/{activity_id}/release", response_model=ReleaseActivityResponse)
def release_activity(activity_id: UUID, teacher: dict = Depends(get_current_teacher)):
    actor = teacher["sub"]
    _owned_activity(actor, str(activity_id))
    result = lifecycle_rpc(
        "release_activity_results",
        {
            "actor_id": actor,
            "target_activity_id": str(activity_id),
        },
    )

    # Phase 4: evaluate badges for each released student
    from app.badges.service import award_badges_for_student

    released_ids = result.get("submission_ids", [])
    if released_ids:
        # Look up student_ids for the released submissions
        sub_rows = (
            supabase_client.table("submission")
            .select("id, student_id")
            .in_("id", [str(sid) for sid in released_ids])
            .execute()
            .data
        )
        seen_students: set[str] = set()
        for sub_row in sub_rows or []:
            sid = sub_row["student_id"]
            if sid not in seen_students:
                seen_students.add(sid)
                try:
                    award_badges_for_student(
                        student_id=sid,
                        submission_id=sub_row["id"],
                        activity_id=str(activity_id),
                    )
                except Exception:
                    import logging

                    logging.getLogger(__name__).warning(
                        "Badge evaluation failed for student=%s", sid, exc_info=True
                    )

    return result
```

- [ ] **Step 7: Hook badge evaluation into release_grade**

In `backend/app/api/gradebook.py`, modify `release_grade` (L28-51):

```python
@router.post(
    "/activities/{activity_id}/students/{student_id}/release-grade",
    response_model=GradeReleaseResponse,
)
def release_grade(
    activity_id: UUID,
    student_id: UUID,
    body: GradeReleaseRequest,
    response: Response,
    teacher: dict = Depends(get_current_teacher),
):
    actor = teacher["sub"]
    _owned_work(actor, str(activity_id), str(student_id))
    result = lifecycle_rpc(
        "release_student_work_grade",
        {
            "actor_id": actor,
            "target_activity_id": str(activity_id),
            "target_student_id": str(student_id),
            "expected_revision": body.expected_revision,
        },
    )

    # Phase 4: evaluate badges after grade release
    from app.badges.service import award_badges_for_student

    if result.get("rubric_released") or result.get("grade_released"):
        try:
            award_badges_for_student(
                student_id=str(student_id),
                submission_id=str(result.get("submission_id")) if result.get("submission_id") else None,
                activity_id=str(activity_id),
            )
        except Exception:
            import logging

            logging.getLogger(__name__).warning(
                "Badge evaluation failed for student=%s", student_id, exc_info=True
            )

    response.headers["Cache-Control"] = "no-store"
    return result
```

- [ ] **Step 8: Run all badge tests**

Run: `cd backend && uv run pytest tests/badges/ -v`
Expected: all PASS

- [ ] **Step 9: Run lint**

Run: `cd backend && uv run ruff check .`
Expected: clean

- [ ] **Step 10: Commit**

```bash
git add backend/app/badges/service.py backend/app/api/submission_lifecycle.py \
  backend/app/api/gradebook.py backend/tests/badges/test_service.py
git commit -m "feat: award badges on submission release with parent notifications"
```

---

### Task 5: Badge Notification SQL Support

**Files:**
- Create: `supabase/migrations/<timestamp>_phase4_badge_notification.sql`

**Interfaces:**
- Consumes: `notification_type` with `badge_earned`, `notify_work_parents()` function pattern
- Produces: `notify_work_parents_badge(work_student, work_activity, badge_name)` SQL function

- [ ] **Step 1: Create the notification helper migration**

Create `supabase/migrations/<timestamp>_phase4_badge_notification.sql`:

```sql
-- Badge notification helper.
-- Uses the existing put_notification infrastructure but with badge-specific
-- dedupe keys and no submission_id.

create function writewise_internal.notify_work_parents_badge(
  work_student uuid, work_activity uuid, badge_name text
) returns integer language plpgsql security invoker set search_path = '' as $$
declare recipient uuid; inserted integer := 0;
begin
  for recipient in select distinct sp.parent_id from public.student_parent sp
    where sp.student_id = work_student order by sp.parent_id
  loop
    if writewise_internal.put_notification(
      recipient, 'badge_earned'::public.notification_type, work_activity, work_student,
      null,  -- no submission_id for badge notifications
      'badge_earned:' || work_student::text || ':' || badge_name || ':' || recipient::text
    ) is not null then
      inserted := inserted + 1;
    end if;
  end loop;
  return inserted;
end;
$$;

revoke all on function writewise_internal.notify_work_parents_badge(uuid,uuid,text)
  from public, anon, authenticated;
grant execute on function writewise_internal.notify_work_parents_badge(uuid,uuid,text)
  to service_role;
```

- [ ] **Step 2: Apply and verify**

Run:
```bash
cd supabase
supabase db reset
```
Expected: all migrations apply cleanly.

- [ ] **Step 3: Regenerate types**

Run:
```bash
supabase gen types typescript --project-id <dev-project-id> > frontend/src/types/database.ts
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/*phase4_badge_notification* frontend/src/types/database.ts
git commit -m "feat: add badge notification SQL helper"
```

---

### Task 6: Frontend Avatar Component & Picker

**Files:**
- Create: `frontend/components/student-avatar.tsx`
- Create: `frontend/components/avatar-picker-popover.tsx`
- Create: `frontend/lib/hooks/use-avatars.ts`
- Create: `frontend/lib/hooks/use-badges.ts`
- Create: `frontend/lib/avatar-utils.ts`

**Interfaces:**
- Consumes:
  - `GET /api/avatars` → `AvatarInfo[]`
  - `GET /api/students/{id}/badges` → `BadgeResponse`
  - `PATCH /api/students/{id}` with `avatar_id`
  - `Student` interface from `use-students.ts`
- Produces:
  - `<StudentAvatar studentId={string} avatarId={string} size="sm"|"default"|"lg" />` — renders the SVG avatar with the correct border tier
  - `<AvatarPickerPopover studentId={string} currentAvatarId={string} onSelect={(slug) => void} />` — popover grid of avatar options
  - `useAvatars()` hook — fetches avatar pool
  - `useBadges(studentId)` hook — fetches earned badges and border tier
  - `resolveAvatarSrc(avatarId: string, studentId: string, pool: string[]) -> string` — resolves `'auto'` to deterministic slug

- [ ] **Step 1: Create avatar utility function**

Create `frontend/lib/avatar-utils.ts`:

```typescript
/**
 * Resolve an avatar_id to a concrete SVG path.
 * When avatar_id is 'auto', deterministically pick from the pool using
 * a simple hash of the student ID.
 */
export function resolveAvatarSlug(
  avatarId: string,
  studentId: string,
  pool: string[]
): string {
  if (avatarId !== "auto" && pool.includes(avatarId)) {
    return avatarId;
  }
  // Deterministic hash: sum char codes of studentId, mod pool size
  let hash = 0;
  for (let i = 0; i < studentId.length; i++) {
    hash = (hash * 31 + studentId.charCodeAt(i)) | 0;
  }
  return pool[Math.abs(hash) % pool.length];
}

export function avatarSrc(slug: string): string {
  return `/avatars/${slug}.svg`;
}

/** Border tier visual config (spec §4.1). */
export const BORDER_TIERS = [
  { tier: 0, name: "Default", ringClass: "ring-1 ring-border", glowClass: "" },
  { tier: 1, name: "Starter", ringClass: "ring-2 ring-brand-600", glowClass: "" },
  { tier: 2, name: "Growing", ringClass: "ring-2 ring-band-2", glowClass: "" },
  { tier: 3, name: "Strong", ringClass: "ring-[3px] ring-band-3", glowClass: "" },
  { tier: 4, name: "Outstanding", ringClass: "ring-[3px] ring-band-4", glowClass: "shadow-[0_0_8px_theme(colors.band-4/0.4)]" },
  { tier: 5, name: "Mastery", ringClass: "ring-[3px] ring-band-4", glowClass: "shadow-[0_0_12px_theme(colors.band-2/0.5)] animate-pulse" },
] as const;

export function getBorderConfig(tier: number) {
  return BORDER_TIERS[Math.min(tier, 5)] ?? BORDER_TIERS[0];
}
```

- [ ] **Step 2: Create avatar and badge hooks**

Create `frontend/lib/hooks/use-avatars.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "../supabase/auth-helper";
import { handleApiResponse } from "../utils/api-error";

export interface AvatarInfo {
  slug: string;
  path: string;
}

export function useAvatars() {
  return useQuery<AvatarInfo[]>({
    queryKey: ["avatars"],
    queryFn: async () => {
      const token = await getAuthToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/avatars`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return handleApiResponse(res);
    },
    staleTime: Infinity, // Static pool, never changes
  });
}
```

Create `frontend/lib/hooks/use-badges.ts`:

```typescript
import { useQuery } from "@tanstack/react-query";
import { getAuthToken } from "../supabase/auth-helper";
import { handleApiResponse } from "../utils/api-error";

export interface EarnedBadge {
  badge_type: string;
  earned_at: string;
  triggered_by_submission_id: string | null;
}

export interface BadgeResponse {
  badges: EarnedBadge[];
  border_tier: number;
  border_tier_name: string;
}

export function useBadges(studentId: string | undefined) {
  return useQuery<BadgeResponse>({
    queryKey: ["badges", studentId],
    queryFn: async () => {
      const token = await getAuthToken();
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/api/students/${studentId}/badges`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      return handleApiResponse(res);
    },
    enabled: !!studentId,
  });
}
```

- [ ] **Step 3: Create the StudentAvatar component**

Create `frontend/components/student-avatar.tsx`:

```tsx
"use client";

import { cn } from "@/lib/utils";
import { avatarSrc, getBorderConfig, resolveAvatarSlug } from "@/lib/avatar-utils";
import { useAvatars } from "@/lib/hooks/use-avatars";
import { useBadges } from "@/lib/hooks/use-badges";

interface StudentAvatarProps {
  studentId: string;
  avatarId?: string;
  size?: "sm" | "default" | "lg";
  className?: string;
  /** Override border tier (skip the badges query). */
  borderTier?: number;
  onClick?: () => void;
}

const SIZE_CLASSES = {
  sm: "size-6",
  default: "size-8",
  lg: "size-10",
} as const;

export function StudentAvatar({
  studentId,
  avatarId = "auto",
  size = "default",
  className,
  borderTier: overrideTier,
  onClick,
}: StudentAvatarProps) {
  const { data: avatars } = useAvatars();
  const { data: badgeData } = useBadges(
    overrideTier === undefined ? studentId : undefined
  );

  const pool = avatars?.map((a) => a.slug) ?? [];
  const slug = pool.length > 0 ? resolveAvatarSlug(avatarId, studentId, pool) : null;
  const tier = overrideTier ?? badgeData?.border_tier ?? 0;
  const border = getBorderConfig(tier);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative flex shrink-0 items-center justify-center rounded-full overflow-hidden select-none",
        SIZE_CLASSES[size],
        border.ringClass,
        border.glowClass,
        "motion-reduce:animate-none",
        onClick ? "cursor-pointer" : "cursor-default",
        className
      )}
      aria-label={`Student avatar, border tier: ${border.ringClass ? getBorderConfig(tier).name : "Default"}`}
    >
      {slug ? (
        <img
          src={avatarSrc(slug)}
          alt=""
          className="size-full rounded-full object-cover"
          draggable={false}
        />
      ) : (
        <span className="bg-muted text-muted-foreground flex size-full items-center justify-center rounded-full text-xs">
          ?
        </span>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Create the AvatarPickerPopover component**

Create `frontend/components/avatar-picker-popover.tsx`:

```tsx
"use client";

import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAvatars } from "@/lib/hooks/use-avatars";
import { avatarSrc } from "@/lib/avatar-utils";
import { cn } from "@/lib/utils";

interface AvatarPickerPopoverProps {
  currentSlug: string;
  onSelect: (slug: string) => void;
  children: React.ReactNode;
}

export function AvatarPickerPopover({
  currentSlug,
  onSelect,
  children,
}: AvatarPickerPopoverProps) {
  const [open, setOpen] = useState(false);
  const { data: avatars, isLoading } = useAvatars();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <p className="text-sm font-medium mb-2">Choose an avatar</p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : (
          <div className="grid grid-cols-5 gap-2">
            {avatars?.map((avatar) => (
              <button
                key={avatar.slug}
                type="button"
                onClick={() => {
                  onSelect(avatar.slug);
                  setOpen(false);
                }}
                className={cn(
                  "flex size-10 items-center justify-center rounded-full border-2 p-0.5 transition-colors",
                  currentSlug === avatar.slug
                    ? "border-brand-600 bg-brand-100"
                    : "border-transparent hover:border-border"
                )}
                aria-label={`Select ${avatar.slug} avatar`}
                aria-pressed={currentSlug === avatar.slug}
              >
                <img
                  src={avatarSrc(avatar.slug)}
                  alt={avatar.slug}
                  className="size-full rounded-full"
                  draggable={false}
                />
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 5: Extend Student interface with avatar_id**

In `frontend/lib/hooks/use-students.ts`, add `avatar_id` to the `Student` interface (L7-16):

```typescript
export interface Student {
  id: string;
  full_name: string;
  section: string;
  section_id?: string | null;
  avatar_id?: string;
  created_at: string;
  parent_email?: string | null;
  parent_status?: "pending" | "active" | null;
  status?: string;
}
```

- [ ] **Step 6: Run lint and type check**

Run:
```bash
cd frontend
npx eslint .
npx tsc --noEmit
```
Expected: clean (or only pre-existing warnings)

- [ ] **Step 7: Commit**

```bash
git add frontend/components/student-avatar.tsx frontend/components/avatar-picker-popover.tsx \
  frontend/lib/avatar-utils.ts frontend/lib/hooks/use-avatars.ts \
  frontend/lib/hooks/use-badges.ts frontend/lib/hooks/use-students.ts
git commit -m "feat: add StudentAvatar component, picker popover, and badge hooks"
```

---

### Task 7: Frontend Avatar & Badge Integration

**Files:**
- Modify: `frontend/app/(teacher)/roster/page.tsx` (add avatar to student rows)
- Modify: `frontend/components/roster/student-dialog.tsx` (add avatar picker to Add/Edit)
- Modify: `frontend/components/dashboard/class-table.tsx` (add avatar to table rows)
- Modify: `frontend/components/dashboard/student-drill-down.tsx` (add avatar + badge section)
- Modify: `frontend/app/(parent)/progress/page.tsx` or `progress-content.tsx` (add avatar + badge section)
- Create: `frontend/components/badge-section.tsx` (persistent badge card)
- Create: `frontend/components/badge-popover.tsx` (tap-avatar badge detail)

**Interfaces:**
- Consumes:
  - `<StudentAvatar>` from Task 6
  - `<AvatarPickerPopover>` from Task 6
  - `useBadges(studentId)` from Task 6
  - `useUpdateStudent()` from `use-students.ts`
- Produces: Fully integrated avatar and badge display across both portals

This task is frontend integration — no automated tests (TESTING.md §7). Manual QA against the DESIGN.md flows, noted in the commit message.

- [ ] **Step 1: Create the BadgeSection component**

Create `frontend/components/badge-section.tsx`:

```tsx
"use client";

import { useBadges } from "@/lib/hooks/use-badges";
import { getBorderConfig } from "@/lib/avatar-utils";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Human-readable badge metadata. */
const BADGE_INFO: Record<string, { emoji: string; label: string; description: string }> = {
  first_steps: { emoji: "📝", label: "First Steps", description: "First handwriting assessment!" },
  first_improvement: { emoji: "📈", label: "First Improvement", description: "Handwriting is getting better!" },
  on_a_roll: { emoji: "📈", label: "On a Roll", description: "Three improvements in a row!" },
  well_rounded: { emoji: "🎯", label: "Well-Rounded", description: "Growing across multiple skills!" },
  clean_sweep: { emoji: "🌟", label: "Clean Sweep", description: "Every skill improved!" },
  reached_developing: { emoji: "🏅", label: "Reached Developing", description: "Handwriting is taking shape!" },
  reached_satisfactory: { emoji: "🏅", label: "Reached Satisfactory", description: "Strong, consistent handwriting!" },
  reached_excellent: { emoji: "🏅", label: "Reached Excellent", description: "Exceptional handwriting quality!" },
  steady_hand: { emoji: "🔒", label: "Steady Hand", description: "Consistently strong work!" },
  master_penman: { emoji: "🔒", label: "Master Penman", description: "True mastery of cursive handwriting!" },
};

interface BadgeSectionProps {
  studentId: string;
}

export function BadgeSection({ studentId }: BadgeSectionProps) {
  const { data, isLoading } = useBadges(studentId);

  if (isLoading || !data) return null;
  if (data.badges.length === 0) return null;

  const border = getBorderConfig(data.border_tier);

  return (
    <Card className="rounded-xl shadow-warm">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Badges earned · {border.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {data.badges.map((badge) => {
          const info = BADGE_INFO[badge.badge_type];
          if (!info) return null;
          return (
            <div
              key={badge.badge_type}
              className="flex items-center gap-1.5 rounded-full bg-brand-100 px-2.5 py-1 text-xs"
              title={`${info.label}: ${info.description}\nEarned: ${new Date(badge.earned_at).toLocaleDateString()}`}
            >
              <span>{info.emoji}</span>
              <span className="font-medium text-brand-700">{info.label}</span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export { BADGE_INFO };
```

- [ ] **Step 2: Create the BadgePopover component**

Create `frontend/components/badge-popover.tsx`:

```tsx
"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useBadges } from "@/lib/hooks/use-badges";
import { getBorderConfig } from "@/lib/avatar-utils";
import { BADGE_INFO } from "@/components/badge-section";
import { cn } from "@/lib/utils";

const ALL_BADGE_TYPES = [
  "first_steps", "first_improvement", "on_a_roll", "well_rounded",
  "clean_sweep", "reached_developing", "reached_satisfactory",
  "reached_excellent", "steady_hand", "master_penman",
] as const;

interface BadgePopoverProps {
  studentId: string;
  children: React.ReactNode;
}

export function BadgePopover({ studentId, children }: BadgePopoverProps) {
  const { data } = useBadges(studentId);
  const earnedTypes = new Set(data?.badges.map((b) => b.badge_type) ?? []);
  const border = getBorderConfig(data?.border_tier ?? 0);

  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="start">
        <p className="text-sm font-medium mb-1">
          Growth Badges · <span className="text-muted-foreground">{border.name}</span>
        </p>
        <div className="space-y-1.5 mt-2">
          {ALL_BADGE_TYPES.map((bt) => {
            const info = BADGE_INFO[bt];
            const earned = earnedTypes.has(bt);
            const badge = data?.badges.find((b) => b.badge_type === bt);
            return (
              <div
                key={bt}
                className={cn(
                  "flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs",
                  earned ? "bg-brand-100" : "opacity-50"
                )}
              >
                <span className="text-base leading-none mt-0.5">{info?.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className={cn("font-medium", earned ? "text-brand-700" : "text-muted-foreground")}>
                    {info?.label}
                  </p>
                  <p className="text-muted-foreground">{info?.description}</p>
                  {earned && badge && (
                    <p className="text-muted-foreground mt-0.5">
                      Earned {new Date(badge.earned_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 3: Integrate avatar into the roster page**

In `frontend/app/(teacher)/roster/page.tsx`, import `StudentAvatar` and add it next to each student name in the table rows and mobile cards. Find the student name rendering and prepend:

```tsx
import { StudentAvatar } from "@/components/student-avatar";
// ...
// In each student row (desktop table cell and mobile card):
<div className="flex items-center gap-2">
  <StudentAvatar studentId={student.id} avatarId={student.avatar_id} size="sm" />
  <span>{student.full_name}</span>
</div>
```

- [ ] **Step 4: Integrate avatar picker into student dialog**

In `frontend/components/roster/student-dialog.tsx`, add the `AvatarPickerPopover` to the Add/Edit Student form. Import and add above the name field:

```tsx
import { AvatarPickerPopover } from "@/components/avatar-picker-popover";
import { StudentAvatar } from "@/components/student-avatar";
// ...
// Inside the form, above the name input:
<div className="flex items-center gap-3">
  <AvatarPickerPopover
    currentSlug={avatarId}
    onSelect={(slug) => setAvatarId(slug)}
  >
    <StudentAvatar
      studentId={studentId ?? "new"}
      avatarId={avatarId}
      size="lg"
      className="cursor-pointer"
    />
  </AvatarPickerPopover>
  <p className="text-xs text-muted-foreground">Click to change avatar</p>
</div>
```

Include `avatar_id` in the form submission payload.

- [ ] **Step 5: Integrate avatar into dashboard class table**

In `frontend/components/dashboard/class-table.tsx`, import `StudentAvatar` and add to the student name column:

```tsx
import { StudentAvatar } from "@/components/student-avatar";
// ...
// In the student name cell:
<div className="flex items-center gap-2">
  <StudentAvatar studentId={row.student_id} size="sm" />
  <span>{row.full_name}</span>
</div>
```

- [ ] **Step 6: Integrate avatar and badge section into student drill-down**

In `frontend/components/dashboard/student-drill-down.tsx`, add the avatar and badge section to the header:

```tsx
import { StudentAvatar } from "@/components/student-avatar";
import { BadgePopover } from "@/components/badge-popover";
import { BadgeSection } from "@/components/badge-section";
// ...
// In the drawer/sheet header:
<div className="flex items-center gap-3">
  <BadgePopover studentId={studentId}>
    <StudentAvatar studentId={studentId} size="lg" />
  </BadgePopover>
  <div>
    <h3 className="font-heading font-semibold">{studentName}</h3>
    <p className="text-sm text-muted-foreground">{section}</p>
  </div>
</div>
// Below the header, before criterion trends:
<BadgeSection studentId={studentId} />
```

- [ ] **Step 7: Integrate avatar and badge section into parent progress view**

In `frontend/app/(parent)/progress/page.tsx` or `progress-content.tsx`, add the avatar and badge section:

```tsx
import { StudentAvatar } from "@/components/student-avatar";
import { BadgePopover } from "@/components/badge-popover";
import { BadgeSection } from "@/components/badge-section";
import { AvatarPickerPopover } from "@/components/avatar-picker-popover";
// ...
// In the child header area:
<div className="flex items-center gap-3">
  <AvatarPickerPopover
    currentSlug={child.avatar_id ?? "auto"}
    onSelect={handleAvatarChange}
  >
    <BadgePopover studentId={child.id}>
      <StudentAvatar studentId={child.id} avatarId={child.avatar_id} size="lg" />
    </BadgePopover>
  </AvatarPickerPopover>
  <div>
    <h2 className="font-heading font-semibold text-lg">{child.full_name}</h2>
  </div>
</div>
// Below the header tabs:
<BadgeSection studentId={child.id} />
```

Note: the parent avatar picker needs the `useUpdateStudent` mutation to persist the change via `PATCH /students/{id}`. Wire `handleAvatarChange` to call it with `{ avatar_id: slug }`.

- [ ] **Step 8: Run lint and type check**

Run:
```bash
cd frontend
npx eslint .
npx tsc --noEmit
```
Expected: clean

- [ ] **Step 9: Manual QA**

Test the following flows manually:
1. Teacher: Add a student → verify avatar appears (auto-assigned) → edit student → change avatar via picker → verify persistence
2. Teacher: View roster → verify avatars appear on all rows
3. Teacher: Dashboard class table → verify avatars appear
4. Teacher: Student drill-down → verify avatar, border tier, and badge section
5. Parent: Progress view → verify avatar, border tier, badge section, avatar picker
6. Both: Tap avatar → verify badge popover shows earned and unearned badges
7. Responsive: Check mobile and desktop viewports

- [ ] **Step 10: Commit**

```bash
git add frontend/components/badge-section.tsx frontend/components/badge-popover.tsx \
  frontend/app/ frontend/components/roster/ frontend/components/dashboard/ \
  frontend/components/student-avatar.tsx
git commit -m "feat: integrate avatars and badges across teacher and parent portals

Manual QA: avatar display on roster, dashboard, drill-down, parent progress;
avatar picker on student dialog and parent progress; badge popover and section
on drill-down and progress views; responsive check on mobile and desktop."
```

---

## Post-Plan: Open Items Not Covered

These are explicitly deferred per the spec §12 and are NOT part of this plan:

1. **Real avatar illustrations** — the placeholder SVGs need to be replaced with 15–20 handwriting/stationery-themed illustrations (design work, not engineering).
2. **Badge icon illustrations** — the emoji placeholders in `BADGE_INFO` need to be replaced with custom SVG icons.
3. **Decorative border frame SVGs** — Tiers 2–5 currently use CSS rings; the spec calls for ornamental SVG frames. This is a design → engineering follow-up.
4. **Badge celebration animation** — the inline reveal on the submission result screen (spec §5.1). This requires integration with the submission result view and motion design. Recommended as a separate follow-up task.
5. **Copy review** — badge names and descriptions need a tone pass against DESIGN.md §8.1.
6. **Email integration** — whether `badge_earned` notifications trigger optional email is deferred.

# WriteWise — TESTING.md

**Software Testing Strategy — Build Guide**

- **Document type:** Internal engineering build guide (companion to PRD.md, ARCHITECTURE.md, DESIGN.md, CV_PIPELINE.md, ML_PIPELINE.md, DATABASE.md, API_SPEC.md, TECH_STACK.md, SECURITY.md, DEPLOYMENT.md)
- **Scope:** the single source of truth for how this system's *code* is verified to work correctly — unit tests, integration tests, security tests, manual QA, and the milestone checklists that gate Phase 1 launch and the October defense. Absorbs the testing-strategy content previously scattered across ARCHITECTURE.md §13, CV_PIPELINE.md §11, ML_PIPELINE.md §10, and SECURITY.md §10 — those sections now point here rather than repeating it, the same "one place to update" move DATABASE.md already made on ARCHITECTURE.md §6.
- **Explicitly out of scope:** the statistical/research validation — Spearman's Rho correlation against teacher scores, CNN Stage 1 accuracy/precision/recall/F1. That's a different question ("is the system's *judgment* accurate") than this document answers ("does the *code* do what it claims"), and it's already correctly owned by PRD.md §5/§11 and ML_PIPELINE.md §5 — see §1 below for why the line is drawn there.
- **Status:** Draft v1

---

## 1. Testing Philosophy & Scope Boundary

**Targeted, not exhaustive.** Testing effort is concentrated on the parts of the system whose *correctness* the thesis's own statistics depend on — the OpenCV feature-extraction math and the scoring layer, where a silent bug (e.g. a slant-angle formula off by a systematic factor) wouldn't just break a feature, it would quietly invalidate the Spearman's Rho correlation study and the CNN accuracy/precision/recall/F1 figures the defense depends on. This isn't a new principle — it's ARCHITECTURE.md §13's original framing, carried forward here as the organizing idea for the whole document.

**Two different questions, two different owners.** "Does the code behave correctly" (this document) and "is the system's judgment accurate against real teachers" (PRD.md §5, ML_PIPELINE.md §5) sound similar but need different evidence: the first is answered by deterministic, ground-truth-asserting tests that can run today, against synthetic data, in CI, on every PR. The second can only be answered offline, later, against real Phase 1 submissions and real teacher scores — it's inherently a statistics question, not a software-correctness one. Collapsing them into one document would blur exactly the distinction a thesis panel is most likely to probe. This document stays in the first lane.

> **Why this matters enough to say explicitly:** CV_PIPELINE.md §11 and ML_PIPELINE.md §10 both already drew this line correctly (synthetic-ground-truth unit tests vs. offline real-data evaluation) — but neither said so as a stated scope rule, just as a fact about their own document. Stating it once, here, means a future contributor doesn't accidentally try to make this document "prove the model is good," which is a different, offline, PRD-owned deliverable.

---

## 2. Testing Overview

| Test type | Verifies | Environment | Trigger | Detail |
|---|---|---|---|---|
| CV unit tests | OpenCV feature-extraction functions (`app/cv/`) | Local / CI, synthetic images, no DB | Every PR | §4.1 |
| ML unit tests (Stage 2 plumbing) | Inference wrapper shape/plumbing (`app/ml/inference.py`) | Local / CI, no DB, no real model | Every PR | §4.2 |
| ML Stage 1 evaluation | CNN classifier accuracy/precision/recall/F1 | Offline (Colab, CCC test split) | Once, after fine-tuning | **Out of scope** — see ML_PIPELINE.md §5 |
| Scoring layer unit tests | `ManualScoreProvider` / `CalibratedScoreProvider` | Local / CI, no DB | Every PR | §4.3 |
| Integration tests | Full submission pipeline: upload → gates → CV → CNN → score → response | CI, ephemeral local Supabase stack, mocked CNN | Every PR | §5 |
| Security tests (automated) | Negative-auth paths (cross-role, cross-family access) | CI, ephemeral local Supabase stack | Every PR | §6.1 |
| Security tests (manual) | RLS-gated direct-read paths FastAPI never touches | Manual, against dev data | Pre-defense | §6.2 |
| Manual QA checklist | Every DESIGN.md §6 screen against its spec | Manual, dev/preview deploy | Pre-launch & pre-defense | §7 |
| Dependency audit | Known CVEs in current dependencies | Manual (`pip-audit`, `npm audit`) | Pre-launch & pre-defense | §8, §9 |
| Backup/restore test | Weekly backup script actually restores | Manual, against realistic data | Pre-launch | §8 |
| Spearman's Rho / diagnostic correlation | System scores vs. teacher scores | Offline, real Phase 1 data | "Between Phases" (PRD §5) | **Out of scope** — see PRD.md §5, ARCHITECTURE.md §16 |

---

## 3. Test Environment & CI Mechanics

### 3.1 Backend Test Environment — Ephemeral Local Supabase Stack

Integration and security tests need a real Postgres + Auth + Storage to run against — but not the shared `writewise-dev` project. Running CI against the same hosted dev project every teammate also does manual testing against risks two failure modes: CI runs colliding with a teammate's manual click-through session, and test-inserted rows accumulating in a project meant to stay a clean sandbox.

**Decision:** every CI run spins up its own disposable Postgres/Auth/Storage stack via the Supabase CLI (`supabase start`), applies `supabase/migrations/*.sql` (the same migration files DATABASE.md treats as the schema's source of truth — no second schema definition to maintain), runs the full pytest suite against it, then tears it down. Nothing persists between runs.

> **Why not the shared `writewise-dev` project, and why not a fourth environment either:** ARCHITECTURE.md §3 is explicit that there is no third staging environment, on purpose — adding a persistent `writewise-test` project would contradict that. An ephemeral, CI-only stack that exists for the duration of one workflow run and is discarded immediately after isn't a *persistent* environment in the sense ARCHITECTURE §3 means, so it doesn't reopen that decision. It also keeps TECH_STACK.md §9's "no Docker required" promise intact for local dev — the Docker dependency this introduces is confined entirely to the GitHub Actions runner, never something a teammate needs installed on their own machine.

### 3.2 CNN Mocking in Tests

ML_PIPELINE.md §8 has the deployed container **fail startup entirely** if the model artifact can't load — correct behavior in production, but a blocker for testing: no fine-tuned model exists until Stage 1/2 training finishes (targeted late September), and PRD.md §5 explicitly wants Phase 2 built *in parallel* with that, not gated behind it.

**Decision:** `app.ml.inference.run_letter_formation_inference` is swapped for a deterministic stub in every test run — returns a fixed, in-range score per word crop, no real forward pass, no real artifact required. The app's startup lifespan event (which downloads and loads the real model) is skipped entirely in test mode via a new `ENVIRONMENT=test` value — see §10, this is one line of new scope on top of TECH_STACK.md §8.3's existing `dev`/`prod` values.

> **Why mock rather than require a real model in CI:** this unblocks integration-test writing from day one instead of gating it behind a September milestone, keeps CI fast and deterministic, and correctly stays in this document's lane (§1) — integration tests verify the pipeline is *wired together correctly*, not that the model's judgment is *good*, which is ML_PIPELINE §5/§10's separate, offline job. The real model gets exercised for real for the first time in an actual Railway deployment, exactly where ML_PIPELINE §8's fail-loud behavior is designed to catch a genuine problem.

### 3.3 CI Job Steps

Extends ARCHITECTURE.md §14's existing "why" (CI is a required merge-gate; Vercel/Railway's own integrations handle deploy, not Actions) with the "how":

1. Checkout, set up Node 24 + Python 3.13/`uv` (TECH_STACK §1).
2. Install deps: `npm ci` (frontend), `uv sync` (backend).
3. Lint/type-check: `ruff check .`, `eslint`, `tsc --noEmit`.
4. `supabase start` — spins up the ephemeral stack (§3.1).
5. Apply migrations: `supabase db reset` (or equivalent CLI migrate command).
6. `uv run pytest` — full backend suite (§4, §5, §6.1) against the ephemeral stack, with the CNN mock (§3.2) active via `ENVIRONMENT=test`.
7. `supabase stop` — tear down. Nothing persists to the next run.

No frontend automated test step exists (§7 explains why), so the frontend side of this job is lint/type-check only.

---

## 4. Backend Unit Tests

**No numeric coverage target.** A line-coverage percentage measures code *executed*, not correctness *verified* — it's possible to hit high coverage on a feature-extraction function while never actually asserting its math is right. Instead, coverage is tracked as a **named checklist**: every function listed below needs at least one test that asserts a known ground-truth result, not just that the function runs without error.

### 4.1 CV Feature-Extraction Tests (`backend/app/cv/`)

Per CV_PIPELINE.md §11: unit tests use **synthetic, programmatically-generated images with known ground truth** — not real handwriting samples, which don't exist yet and are inherently messy even once they do.

Synthetic images are generated **at test-run time**, not committed as fixture files — a shared helper module (`backend/tests/synthetic.py`, see §10) holds the generator functions (`draw_line_at_angle()`, `draw_guide_lines()`, `draw_shapes_at_distance()`, etc.), and each test calls them directly so the ground truth is visible right next to the assertion, not in a separate file a reader has to cross-reference.

| Module | Function(s) | Ground-truth test |
|---|---|---|
| `quality_gate.py` | blur / brightness / contrast / resolution checks | Synthetic images crossing each threshold in both directions — asserts pass/reject matches CV_PIPELINE §2's table |
| `preprocessing.py` | grayscale, denoise, Otsu threshold | Known input → expected pixel-level output shape/range |
| `guide_lines.py` | baseline/midline/topline detection | Guide lines drawn at known y-positions → detected within tolerance |
| `segmentation.py` | line segmentation, word segmentation, post-segmentation gate | Known word/line layout → correct count and boundaries; word-count mismatch → correct rejection |
| `features/slant.py` | `compute_slant()` | Line drawn at a precise angle → returned angle within tolerance |
| `features/spacing.py` | word/letter gap classification | Shapes a known pixel distance apart → returned spacing matches |
| `features/baseline.py` | baseline deviation ratio | Known ink-to-baseline distance → expected ratio |
| `features/size.py` | size-consistency ratio | Known ink height vs. known baseline-to-midline distance → expected ratio |

### 4.2 ML Stage 2 Plumbing Tests (`backend/app/ml/`)

Per ML_PIPELINE.md §10: Stage 2 has no equivalent ground truth the way CV_PIPELINE faked known angles — "how good is this handwriting" isn't fakeable the way "what angle is this line" is. So `inference.py` gets **shape/plumbing tests only**, verifying the code doesn't break, not that the model is good:

- `run_letter_formation_inference()` accepts a word crop and returns a float in `[0, 100]`.
- Handles an empty word-crop list without crashing.
- Output clamping (ML_PIPELINE §8's failure-handling decision) actually clamps out-of-range values.

Stage 1's real evaluation (CCC held-out test set, Accuracy/Precision/Recall/F1) stays exactly where ML_PIPELINE.md §5 puts it — offline, in `training/`, run once after fine-tuning, not a CI check. It answers a different question than this section does (§1).

### 4.3 Scoring Layer Tests (`backend/app/scoring/`)

- **`ManualScoreProvider`:** trivial by design (ARCHITECTURE §10) — test that it returns exactly the `manual_score` values it was given, unmodified.
- **`CalibratedScoreProvider`:** test that a known raw measurement, run through a known threshold formula, produces the expected score — deterministic formula-application testing, **not** a test that the thresholds themselves are *correct* (that's the Spearman's Rho validation, §1's out-of-scope line). Until PRD §5's "Between Phases" calibration step actually derives real thresholds, this provider's tests necessarily use placeholder formulas — see §11.

---

## 5. Integration Tests

Covers ARCHITECTURE.md §8's synchronous pipeline end-to-end: upload → quality gate → preprocessing → segmentation → post-segmentation gate → CV feature extraction → CNN inference (mocked, §3.2) → score computation → response — the single most-hit critical path during the live pilot.

**Fixtures:** dedicated, minimal, per-test — a test that needs one teacher, one student, and one activity inserts exactly those rows in its own setup, rather than depending on `supabase/seed.sql` (DATABASE §13). Seed data is designed for a developer poking around the UI (varied, realistic, spread across the full score range); reusing it here would mean every test implicitly depends on its exact current contents, and editing seed data for a UI reason would silently break tests elsewhere.

| Test case | Expected result |
|---|---|
| Valid submission, `SCORING_ENGINE=manual` | `201`, `scores.*` and `overlay` all `null` (API_SPEC §3.3) |
| Valid submission, `SCORING_ENGINE=calibrated` | `201`, `scores.*` populated via mocked-formula `CalibratedScoreProvider` |
| Blurry / dark / low-contrast / low-resolution image | `422`, matching `QUALITY_GATE_*` code, `submission` row persisted with `status = 'rejected'` |
| Word count wildly off from `activity.target_text` | `422 SEGMENTATION_COUNT_MISMATCH` |
| Wrong MIME type | `400 UNSUPPORTED_FILE_TYPE` |
| File over 15 MB | `400 FILE_TOO_LARGE` |
| `PATCH /submissions/{id}/manual-score`, first call | `200`, scores match band-anchor values (DATABASE §9) |
| `PATCH /submissions/{id}/manual-score`, called twice on same submission | `409 MANUAL_SCORE_ALREADY_EXISTS` |
| `PATCH /submissions/{id}/manual-score` while `SCORING_ENGINE=calibrated` | `403 MANUAL_SCORING_DISABLED` |

> The last two rows close API_SPEC.md §8's own flagged gap ("`MANUAL_SCORING_DISABLED` has no automated end-to-end test yet"). Both are testable today by setting the config flag in the test environment — neither depends on real calibration thresholds existing yet, so there's no reason to wait for PRD §5's "Between Phases" step to close this.

---

## 6. Security Tests

Extends SECURITY.md §10's two-part plan, run as a permanent part of CI (§6.1) plus a manual pre-defense pass (§6.2) — not something invented here, just given a concrete home and test list.

### 6.1 Automated Negative-Auth Tests (every PR)

Each test case is written against, and cited back to, the specific SECURITY.md §1 threat it closes — so the "we tested our threat model" narrative survives being moved into this document intact:

| Test | Closes threat (SECURITY §1) |
|---|---|
| A parent cannot fetch another family's submission/measurement | #1 Horizontal privilege escalation |
| A teacher cannot fetch another teacher's roster/submissions | #1 Horizontal privilege escalation |
| Unauthenticated request to any protected route → `401` | #3 Account takeover (verifies the boundary exists) |
| A parent hitting a teacher-only route (e.g. `POST /activities`) → `403` | #1 (role-level mismatch) |
| A teacher referencing a real-but-not-theirs `student_id` → `404`, not `403` | #1 + API_SPEC §2.2's info-leak reasoning, actually verified rather than assumed |
| Malformed/corrupt image upload doesn't crash the process | #4 Malicious/malformed file upload |

### 6.2 Manual RLS Checklist (pre-defense only)

For the RLS-gated direct-read paths FastAPI never touches (ARCHITECTURE §4) — can't be exercised through the FastAPI test client, since these bypass FastAPI entirely:

- Log in as Parent A, confirm Parent B's child and their data are invisible on every direct-read screen (dashboard, roster, trend charts).
- Attempt to navigate directly to a teacher-only screen URL as a parent — confirm the middleware (ARCHITECTURE §11) actually redirects, not just hides UI elements.
- Confirm a teacher only ever sees their own roster's students, activities, and submissions via direct Supabase reads.

---

## 7. Frontend Manual QA Checklist

ARCHITECTURE.md §13's call stands: **no automated frontend test suite** — not worth the setup/maintenance cost for a 4-person team on a compressed runway relative to what manual click-through testing already catches at this scale. What was missing was a *checklist* to make "QA'd manually" actually mean something consistent, rather than depending on whoever happens to look at a screen that week remembering what to check.

One row per DESIGN.md §6 screen, run pre-launch (Phase 1 rows) and pre-defense (full inventory):

| Screen | Pass conditions |
|---|---|
| Login | Role-aware redirect lands teacher/parent on the correct portal |
| Parent invite/accept | Invite link → set password → lands in parent portal, correctly linked to child |
| Settings | Profile/password/sign-out work for both roles |
| Class roster | Add/edit student works; empty state matches DESIGN §8.3 |
| Create activity | Target text saves; no way to submit an empty target |
| Activity list | Empty state matches DESIGN §8.3 |
| Submission upload | Native picker opens; confirm step names correct student + activity (DESIGN §7.1); Submit button disables on tap (API_SPEC §5) |
| Processing state | Staged progress text advances; doesn't outlast or undershoot real backend timing |
| Phase 1 result view | Raw measurements display; manual rubric segmented-button-group submits all five bands together |
| Phase 2 result view | Calibrated score, band, and overlay render; replaces (not duplicates) the Phase 1 view |
| Class-wide dashboard | Sortable by weakest criterion; band-color indicators pair with text labels (DESIGN §9) |
| Per-student drill-down | Per-criterion trend history renders correctly |
| Child progress dashboard (parent) | Per-criterion + composite trend renders; multi-child switcher works if applicable |
| Latest diagnostic feedback (parent) | Overlay + text breakdown render at correct visual weight (DESIGN §7.4) |
| Parent submission upload | Same pass conditions as teacher upload, scoped to assigned take-home activity |

Every row also gets a quick pass against DESIGN.md's token system generally: no red anywhere in the diagnostic band system, role-based routing actually blocks the wrong role (not just hides nav), keyboard focus visible.

---

## 8. Pre-Phase-1-Launch Checklist

Consolidates scattered "needs to happen before real student data flows" items from SECURITY.md §8/§11 into one place to check off, targeted for early September per PRD.md §5's roadmap:

- [ ] Full backend test suite green in CI (§4, §5, §6.1)
- [ ] Manual QA checklist (§7) run against the Phase 1 screen set (roster, activity creation, upload, processing, Phase 1 result view)
- [ ] Weekly backup script exercised at least once, with an actual restore test performed — not just "the script ran without erroring" (SECURITY §11)
- [ ] Health-ping GitHub Action exercised and confirmed working
- [ ] `pip-audit` and `npm audit` run, any serious findings triaged (SECURITY §8)
- [ ] Second prod-key holder (SECURITY §2.1/§11) named and access confirmed working

---

## 9. Pre-Defense Checklist

Targeted for October, ahead of the technical defense:

- [ ] Full backend test suite green in CI (§4, §5, §6.1)
- [ ] Manual RLS checklist (§6.2) run
- [ ] Manual QA checklist (§7) run against the **full** screen inventory (Phase 1 + Phase 2 + parent screens)
- [ ] `pip-audit` and `npm audit` run again, findings triaged (SECURITY §8)
- [ ] Dependency versions confirmed still inside their supported window (TECH_STACK §1's "actively supported through defense season" table)

---

## 10. Module Structure

Mirrors `backend/app/`'s structure (CV_PIPELINE §9, ML_PIPELINE §9, API_SPEC §6), which ARCHITECTURE §2 already reserves `backend/tests/` for:

```
backend/tests/
├── conftest.py             # shared pytest fixtures: ephemeral Supabase client,
│                             auth-token factories, ENVIRONMENT=test wiring
├── synthetic.py             # CV synthetic-image generator functions (§4.1) —
│                             not fixture files, generator functions
├── cv/
│   ├── test_quality_gate.py
│   ├── test_preprocessing.py
│   ├── test_guide_lines.py
│   ├── test_segmentation.py
│   └── features/
│       ├── test_slant.py
│       ├── test_spacing.py
│       ├── test_baseline.py
│       └── test_size.py
├── ml/
│   └── test_inference.py    # Stage 2 plumbing tests only (§4.2)
├── scoring/
│   └── test_score_providers.py
├── integration/
│   └── test_submissions.py  # §5's full table
└── security/
    └── test_auth_negative_paths.py   # §6.1's table
```

---

## 11. Dependencies on Other Documents

This document assumes one small addition to TECH_STACK.md that hasn't been made yet:

- **`ENVIRONMENT` (TECH_STACK §8.3) needs a third value, `test`**, alongside the existing `dev`/`prod`. §3.2 depends on this value existing so the app's startup lifespan event knows to skip the real CNN model download/load and use the mocked inference function instead. Today TECH_STACK §8.3 only documents `dev` and `prod`.

---

## 12. Known Risks & Open Items

- **The ephemeral CI Supabase stack (§3.1) is new infrastructure, unexercised until the first real CI run using it.** The PR that introduces this workflow deserves closer review than a typical change — if `supabase start` proves flaky or slow in GitHub Actions, this needs a fallback plan before it becomes a merge-blocking bottleneck for a 4-person team.
- **Mocked CNN inference (§3.2) means integration tests never catch a real model-loading regression.** That's an accepted trade — it's caught instead by ML_PIPELINE §8's fail-loud startup behavior in an actual Railway deployment — but it does mean a broken model artifact could theoretically reach a Railway deploy attempt before anyone notices, rather than being caught in CI.
- **`CalibratedScoreProvider` tests (§4.3) can't be meaningful until real thresholds exist.** Until PRD §5's "Between Phases" calibration step runs, these tests necessarily exercise placeholder/example formulas, not the real ones — revisit and rewrite once calibration lands, don't treat early green checkmarks here as validating the real thing.
- **The TECH_STACK.md §8.3 dependency (§11) is not yet implemented there.** Needs to land before `ENVIRONMENT=test` can actually be relied on in CI.
- **Manual QA and the milestone checklists (§7, §8, §9) are process, not automation** — they depend on someone actually running them, the same category of risk SECURITY §11 already flags for the backup/restore test. A checklist that exists but never gets executed provides zero actual assurance.
- **No numeric coverage target (§4) is a deliberate choice, not an oversight** — if it ever proves too loose in practice (real bugs slipping through untested code paths), the fallback is introducing a coverage tool as a *visibility* aid, not a gate, without changing the underlying "named checklist over percentage" philosophy.

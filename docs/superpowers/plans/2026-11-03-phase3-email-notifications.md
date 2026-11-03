# Phase 3 Slice 4 â€” Email notifications implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Read the approved spec and this entire plan before execution. Execute inline unless the user selects delegation; this planning pass does not dispatch agents.

**Goal:** Deliver optional, privacy-minimal Return and due-soon emails without making coursework requests depend on the email provider.

**Architecture:** Extend the existing transactional notification helper to enqueue a service-only SQL outbox. Short PostgREST RPCs claim, revalidate, authorize, and finalize deliveries; a bounded asynchronous FastAPI endpoint sends through Resend between those transactions. A private Vault-backed pg_net helper invokes the endpoint every five minutes; existing profile RLS protects the global preference in both portals.

**Tech Stack:** Existing Python 3.13, FastAPI/Pydantic v2, Supabase Postgres 17/PostgREST/pg_cron, Next.js 16/React 19, Base UI shadcn primitives, pytest/asyncpg, Ruff/ESLint/TypeScript. Declare the already-locked HTTPX `0.28.1` as a direct dependency through uv. No new worker, queue service, email SDK, or frontend test framework.

**Spec:** [Approved Slice 4 email design](../specs/2026-11-03-phase3-email-notifications-design.md). On 2026-11-03 the user accepted the current spec, including its bounded retry/quota behavior, and requested this implementation plan. A verified Resend domain is user-confirmed; sender details will follow later. No spending cap, additional email event, or quota-replay feature is added.

**Planning baseline:** `e29b006` on `docs/phase3-email-design`, based on local `main` merge `c3369cd`. This pass changes planning/status documents only. All execution checkboxes start unchecked; no application implementation, migrated stack, provider delivery, publication, or deployment is claimed.

**Execution start (2026-11-03):** The user selected inline execution. Work is isolated in `.worktrees/phase3-email-notifications` on `feat/phase3-email-notifications`, starting at `11e23e7`. A separate worktree-root `.venv` was synchronized from the frozen lockfile after the original environment lacked pytest. Two baseline calibration-loader cases require the TensorFlow library even in test mode; the full locked dependency set is now installed. Fresh database-free baseline: **73 passed**, one upstream Starlette/TestClient deprecation warning. Ruff, ESLint and TypeScript passed. Supabase CLI 2.115.0 was loaded through npm; local startup failed with `LegacyDockerLifecycleInspectError` because neither Docker nor Podman is available. Task 1 event/RLS/fault tests and a feature-branch CI trigger are prepared; their database red run is pending an authorized ephemeral runner. Tasks 4â€“5 may proceed independently under this plan; 25 new template/config tests first failed on absent delivery modules/settings. No migration or application implementation is claimed at this checkpoint.

**Independent delivery work (2026-11-03):** The user explicitly authorized pushing this feature branch and subsequent checkpoints to `ryanestoque/writewise` for GitHub's disposable SQL runner. Initial test commit `0c987b1` is published as [CI run 41630758560](https://github.com/ryanestoque/writewise/actions/runs/41630758560). Template/configuration implementation `10fda14` passed its 25 new cases and the 98-case database-free suite. Provider/retry work first failed 29 missing-feature cases; inline review added five boundary cases and reproduced two failures where an oversized response hid quota/credential status. Classification now checks those HTTP statuses before body parsing. All **132 database-free tests** pass with the same upstream warning. HTTPX was declared directly at its existing `0.28.1` lock version without other dependency upgrades. The SQL runner and later API/UI/manual/operational gates remain separate; no email was sent.

**Database red proof and storage checkpoint (2026-11-03):** The initial disposable CI run completed: **481 existing tests passed; all 23 new queue cases failed on the absent `email_outbox`/`email_notifications` schema**. The missing preference column also caused expected fixture-cleanup errors. CLI-generated migration `20261103120102_phase3_email_store.sql` now adds preferences, isolated queue storage and atomic insertion; its implementation awaits migrated-stack verification. Preparation/eligibility tests are included in the next checkpoint to prove the next missing SQL boundary while storage cases are checked. CI must produce the real generated database artifact before schema verification can close; no hand-maintained type approximation or hosted migration is used.

**Storage green / next boundary (2026-11-03):** [CI run 41632492888](https://github.com/ryanestoque/writewise/actions/runs/41632492888) on `3ae8440` passed **563 tests**, including all 23 storage cases. Only the ten intentionally unimplemented preparation cases failed on the absent private helper. Its real migrated-schema database contract was retrieved with an exact commit check and copied into `frontend/types/database.ts`. CLI-generated `20261103121522_phase3_email_context.sql` implements narrow Auth lookup and post-lock revalidation; the matrix now includes unavailable Auth accounts, historical reassignment, in-class work, and three observed-lock races. Twelve new lease/reservation tests specify the next SQL boundary.

**Local API checkpoint (2026-11-03):** The real async queue/dispatcher first failed eight cases; the mounted internal route first failed ten authentication/schema/envelope cases. Both now pass, and the full database-free suite is **150 passed**, one upstream warning; Ruff, ESLint and TypeScript pass. API types were regenerated from the real updated app using the CI-pinned generator. Transport tests live with the real dispatcher/route cases rather than a separate forwarding-only test module. SQL integration remains pending. Inline state-machine review found that a reclaimed retry must reserve its own send before finalization: Task 3 will capture `claim_attempts` at claim time, in addition to rotating the token on authorization, to enforce that existing authorization boundary and pre-reservation release. This is lease metadata, not a new product behavior or PII field.

## Global Constraints

- â€œNo historical notification is converted to an email during migration.â€
- â€œOne global account preference defaults on; in-app notifications remain enabled.â€
- â€œFixed generic wording and a login link; no child name or activity title.â€
- â€œOff at event time or at dispatch means terminal `skipped`; enabling later never replays skipped emails.â€
- â€œFailure of any outbox insert rolls back the new notification, its receipt, and its originating coursework change.â€ Provider availability does not participate in that transaction.
- â€œNo business or outbox lock remains held during provider I/O.â€
- â€œAt most 10 claimed rows and 20 seconds of total dispatcher work per invocation.â€
- â€œAt most three durable send reservations.â€ â€œAt or beyond one hour from the first reservation, make no additional external send.â€
- Retry transient failures after five minutes following reservation 1 and fifteen minutes following reservation 2. The lease is two minutes; the provider attempt budget is five seconds; pg_net's timeout is 30 seconds.
- Use `Idempotency-Key: writewise-email/<outbox UUID>` unchanged across retries. Compare the canonical request digest and never invent a new key for a terminal delivery.
- â€œ`sent` means Resend acknowledged acceptance; it is not proof of inbox delivery.â€
- â€œA preference/link/work change after authorization may race with an email already in flight; it cannot recall an accepted message.â€
- Only `submission_returned` and `due_soon` enqueue email. Preserve the seven existing notification types, their identities, read state, retained delivery receipts, and the 15-minute deadline job.
- Add no app-level rate limiter. Per-invocation bounds and retry scheduling implement the approved dispatcher contract, not a new rate-limiting subsystem.
- SQL-first migrations only; keep applied migration files untouched. Regenerate actual `frontend/types/database.ts` and `frontend/types/api.ts`, never hand-edit generated types. Pair schema/API delivery commits with their generated contracts.
- Use an ephemeral localhost Supabase stack for resets/tests. Never reset hosted dev/prod or use a service-role call as proof of browser RLS.
- Browser preferences use owner RLS. The Resend key and service-role key remain backend-only. Vault/network/private schemas remain unexposed.
- Logs contain opaque IDs and fixed outcome codes only. No recipient, names, notes, scores, request/response bodies, provider exceptions, or headers.
- Preserve image hardening, persisted rejections, ScoreProvider, research exports, in-process CV/CNN, and the single Uvicorn worker.
- Apply relevant Supabase/Postgres, TDD, React/shadcn, review, and verification skills during execution. No real email is sent by automated tests.

## File map and dependency order

Migration names below are logical names passed to `supabase migration new`; the CLI allocates their actual timestamped paths during execution. Record each returned path in the execution record before editing it. This avoids fabricated timestamps or creating migrations during a planning-only task.

| Unit | Files | Responsibility |
|---|---|---|
| Transactional queue | New `phase3_email_store` migration in `supabase/migrations/`; `backend/tests/rls/test_email_outbox.py`, `email_support.py` | Preferences, outbox, indexes/grants, atomic enqueue; retain existing emitter signatures |
| Current eligibility | New `phase3_email_context` migration; `backend/tests/rls/test_email_eligibility.py` | Narrow canonical Auth lookup, current event predicates, preparation |
| Leased delivery | New `phase3_email_queue` migration; `backend/tests/rls/test_email_queue.py` | Recover/claim, single-use send authorization, token-checked outcomes |
| Rendering/config | New `backend/app/email/__init__.py`, `contracts.py`, `templates.py`; modify `backend/app/core/config.py`, `backend/.env.example`; new unit tests | Typed payloads/states, fixed v1 templates/digest, disabled-by-default configuration |
| Provider/retry policy | New `backend/app/email/provider.py`, `retry.py`; modify `backend/pyproject.toml`, `backend/uv.lock`; new unit tests | Bounded async HTTP, sanitized outcomes, deterministic retry scheduling |
| Orchestration/API | New `backend/app/email/queue.py`, `dispatcher.py`; `backend/app/api/internal_emails.py`; modify `backend/app/main.py`; new unit tests | Async PostgREST transport, bounded send sequence, authenticated aggregate endpoint |
| Scheduling/upgrade | New `phase3_email_dispatch` migration; `backend/tests/rls/test_email_scheduler.py`; modify `backend/tests/conftest.py`, `.github/workflows/ci.yml`; new `backend/tests/migrations/email_upgrade_check.py` | Private Vault/pg_net invocation, job isolation, fourth synthetic upgrade proof |
| Preference UI | New `frontend/components/settings/notification-settings-card.tsx`, `frontend/lib/notifications/preferences.ts`; modify both settings pages | Actual stored value, RLS update, exact-token/account-switch protection |
| Generated contracts/docs | `frontend/types/database.ts`, `frontend/types/api.ts`; existing companion docs, proposal, tracker, ADR 0005 | Executable/generated contracts, operations, acceptance evidence |

Dependency order: Task 1 â†’ Task 2 â†’ Task 3 for SQL; Task 4 â†’ Task 5 for database-free delivery code; both chains â†’ Task 6; Task 7 follows Tasks 1â€“6; Task 8 follows generated schema from Task 1; Task 9 closes all gates. Tasks 4â€“5 can progress while an ephemeral SQL runner is being established, without claiming SQL verification.

## Shared interfaces

The names and JSON shapes here are the contract between tasks. Public SQL functions are service-only; no function accepts caller-selected clock time. Implement deterministic private `_at` variants for owner-session tests. Their nullable `as_of` parameter uses a fixed supplied test time, or samples `clock_timestamp()` after required locks when null in production. Do not use a transaction-start clock sampled before a long lock wait for final eligibility.

| SQL RPC | Parameters | Result |
|---|---|---|
| `claim_email_delivery` | None | Null, or `{outbox_id, notification_id, event_type, claim_token, lease_expires_at, attempts}` |
| `prepare_email_delivery` | `target_outbox_id uuid`, `expected_claim_token uuid` | `{state: ready, recipient, event_type}`, `{state: skipped, code}`, or `{state: lost}` |
| `authorize_email_delivery` | Above IDs, `payload_recipient text`, `payload_sha256 text` | `{state: authorized, claim_token, attempts, first_attempt_at, authorized_at}`, `{state: skipped, code}`, or `{state: lost}` |
| `finish_email_delivery` | IDs, `delivery_outcome text`, `provider_id text`, `error_code text`, `retry_at timestamptz`; last three nullable | Boolean: transition acknowledged under current token/lease |

`delivery_outcome` is `sent`, `retry`, `failed`, or `released`; `retry`/`released` map to pending. `released` means a claim abandoned before its new send reservation, preserving earlier attempts/digest if present. `prepare`/`authorize` perform terminal skips themselves. Successful authorization rotates the claim token without extending the lease, so the old token cannot authorize twice; subsequent finalization uses the returned token. A lost authorization response leads to recovery, not a guessed provider send.

Private SQL contracts: `email_recipient_address(recipient uuid, as_of timestamptz) -> text | null` returns only the current eligible Auth address; `email_eligibility(target_outbox_id uuid, as_of timestamptz) -> jsonb` returns the same ready/skipped shape as preparation without mutating the queue. Each of `prepare_email_delivery_at`, `claim_email_delivery_at`, `authorize_email_delivery_at`, and `finish_email_delivery_at` takes its public function's parameters followed by `as_of timestamptz` and returns the same type; the public functions return jsonb except finish's boolean. `request_email_dispatch() -> bigint | null` is job-owner-only. Give all signatures explicit grants/revokes when created. Only the recipient-address and Vault helpers may need narrowly scoped SECURITY DEFINER; all references are qualified and search paths empty.

Backend interfaces:

| Module | Contract |
|---|---|
| `contracts.py` | Pydantic models `DeliveryClaim`, `PreparationResult`, `AuthorizationResult`, `DispatchCounts`; dataclasses `RenderedEmail`, `ProviderResult` |
| `templates.py` | `render_email(event_type: EmailType, recipient: str, sender: str, app_origin: str) -> RenderedEmail`; `payload_digest(body: dict[str, object]) -> str` |
| `provider.py` | `ResendSender(client: httpx.AsyncClient, api_key: str)`; `async send(mail: RenderedEmail, outbox_id: UUID) -> ProviderResult` |
| `retry.py` | `retry_at(attempts: int, authorized_at: datetime, first_attempt_at: datetime, provider_retry_at: datetime | None) -> datetime | None`; null means no permitted retry |
| `queue.py` | `EmailQueue(client: httpx.AsyncClient)` with async `claim()`, `prepare(claim)`, `authorize(claim, mail)`, `finish(outbox_id, token, outcome, provider_id=None, error_code=None, retry_at=None)` using the SQL shapes above |
| `dispatcher.py` | `async dispatch_emails(queue: EmailQueue, sender: ResendSender, *, sender_address: str, app_origin: str) -> DispatchCounts` |
| `internal_emails.py` | `require_dispatch_secret`; async resource dependency `get_email_delivery_resources`; `POST /api/internal/dispatch-emails` |

The queue client uses the existing `/rest/v1/rpc/` service-only protocol through HTTPX asynchronously. This deliberately avoids running the current synchronous global Supabase SDK on the event loop, adding a raw database pool, or relying on unverified async SDK constructor options. An owned client supplies the backend service headers once; the internal HTTP caller cannot choose its URL or credentials.

## Execution prerequisite â€” isolation and a real SQL runner

- [x] Read applicable skills and `AGENTS.md`; inspect `git status`, `git rev-parse --git-dir`, `git rev-parse --git-common-dir`, and `git rev-parse --show-superproject-working-tree`. Use using-git-worktrees at execution time. Keep this planning branch and the user's previous env/worktrees intact; proposed implementation branch: `feat/phase3-email-notifications`.
- [x] Discover tools without changing global configuration:

```powershell
Get-Command uv,node,npm,supabase,docker,podman -ErrorAction SilentlyContinue
git status --short --branch
```

  If needed on this host, use per-command `git -c safe.directory='C:/Users/Admin/Documents/CODING PROJECTS/writewise'` rather than modifying global safe-directory settings. Discover installed Supabase CLI commands using `--help`, then `migration new --help`, `start --help`, `db reset --help`, `gen types typescript --help`, and `db advisors --help`. Do not invoke the CLI from an uninspected download or guess its flags.
- [x] With the ephemeral stack available, use the checked-in `supabase/config.toml`, `supabase start`, and the discovered local-only reset command. Obtain ephemeral credentials without printing them and verify both URL hostnames are localhost before tests. Keep `ENVIRONMENT=test`; preserve the root conftest guard.
- [x] If no local container runner is available, record that precise prerequisite and establish an authorized CI verification path before SQL work needs migration/type proof. Existing historical CI authorization is not a new instruction to publish this branch. Do not weaken the tests, reset hosted dev, or hand-generate types. A schema delivery commit waits for actual migrated-schema generated output; temporary verification artifacts do not establish a verified feature.
- [x] Run fresh baseline Ruff, ESLint, TypeScript, database-free unit tests, and (with the runner) full existing pytest. Distinguish existing failures from regressions before proceeding. For database-free checks set process-local dummy localhost settings, never load hosted `.env` defaults:

```powershell
$env:ENVIRONMENT = 'test'
$env:SUPABASE_URL = 'http://127.0.0.1:54321'
$env:SUPABASE_SERVICE_ROLE_KEY = 'test-service-key'
$env:SUPABASE_JWT_SECRET = 'test-jwt-secret'
$env:SUPABASE_DB_URL = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres'
$env:CORS_ALLOWED_ORIGINS = 'http://localhost:3000'
$env:MODEL_ARTIFACT_PATH = ''
$env:HTR_MODEL_ARTIFACT_PATH = ''
$env:EMAIL_DISPATCH_ENABLED = 'false'
uv run pytest --confcutdir=tests/unit tests/unit -q
```

  Run these from `backend/` in a disposable shell process so dummy keys cannot replace actual ephemeral-stack credentials for later SQL tests. Installed-tool fallback commands for lint/types appear in Task 9. No real Resend configuration is necessary for execution tests.

### Task 1: Atomic outbox and account preferences

**Files:** Create CLI-named `phase3_email_store` migration, `backend/tests/rls/email_support.py`, `backend/tests/rls/test_email_outbox.py`. Modify `frontend/types/database.ts` through generation; extend existing event tests where their established fixtures already cover Return/rollback.

**Interfaces:** Preserve `put_notification(uuid, notification_type, uuid, uuid, uuid, text) -> uuid` and `notify_work_parents(notification_type, uuid, uuid, uuid, text) -> integer`. Produce the exact outbox columns/constraints in spec Â§4.2 and `email_notifications` on teacher/parent. No delivery RPC is needed yet.

- [x] Add `seed_due_email(family, activity, as_of)` in `email_support.py` using the real fixed-time sweep and existing module fixtures:

```python
from datetime import timedelta

from app.core.supabase import supabase_client as admin
from tests.rls.notification_support import db_value


def seed_due_email(family, activity, as_of):
    admin.table('activity').update({
        'due_at': (as_of + timedelta(hours=2)).isoformat(),
    }).eq('id', activity).execute()
    db_value('select writewise_internal.enqueue_time_based_notifications_at($1)', as_of)
    notice = admin.table('notification').select('id').eq('activity_id', activity).eq(
        'student_id', family['students'][0]
    ).eq('recipient_id', family['parent']).eq('type', 'due_soon').execute().data[0]
    return admin.table('email_outbox').select('*').eq(
        'notification_id', notice['id']
    ).execute().data[0]
```

  Existing `family`, `assigned_activity`, and `second_parent` fixtures are in `tests/rls/conftest.py`. Tests restore modified preferences/links in `finally` blocks and delete seeded attempts before activity/Auth teardown. For single-row queue tests, explicitly mark the other newly seeded sibling/parent outbox rows skipped as fixture setup; do not change production claim APIs to select a test row.
- [x] Add red tests through the actual event and owner-RLS paths:

```python
from datetime import datetime, timezone

from app.core.supabase import supabase_client as admin
from tests.rls.email_support import seed_due_email

NOW = datetime(2030, 1, 1, 12, tzinfo=timezone.utc)


def test_due_event_has_one_typed_outbox_row(family, assigned_activity):
    first = seed_due_email(family, assigned_activity['id'], NOW)
    second = seed_due_email(family, assigned_activity['id'], NOW)
    assert first['id'] == second['id']
    assert first['status'] == 'pending'
    assert first['attempts'] == 0
    assert first['due_at'] is not None
    assert first['claim_token'] is None


def test_parent_can_save_only_own_preference(family):
    try:
        own = family['parent_client'].table('parent').update({
            'email_notifications': False,
        }).eq('id', family['parent']).execute()
        assert [row['email_notifications'] for row in own.data] == [False]
        foreign = family['parent_client'].table('parent').update({
            'email_notifications': False,
        }).eq('id', family['other_parent']).execute()
        assert foreign.data == []
    finally:
        admin.table('parent').update({'email_notifications': True}).eq(
            'id', family['parent']
        ).execute()
```

  Add real signed-in anon/parent/teacher denial tests for SELECT/INSERT/UPDATE/DELETE on `email_outbox`; teacher preference ownership; second linked parent fan-out; off-at-enqueue terminal skip; no enqueue for the other five event types; read state independence; deleted-notice cascade without receipt re-arming; retained historical notifications not backfilled. Add outbox fault injection to both the real Return transaction and deadline sweep; assert no originating state/notification/receipt survives its failed transaction. Use transaction-local service claims for raw owner calls that invoke JWT-aware lifecycle helpers, following `test_notification_events.py`.
- [x] Run `uv run pytest tests/rls/test_email_outbox.py -q` on the ephemeral stack. Record missing-column/relation failures before implementation. Create the migration using `supabase migration new phase3_email_store`, then implement all spec Â§4.2 columns. SQL must include explicit queue isolation and partial indexes:

```sql
alter table public.email_outbox enable row level security;
revoke all on public.email_outbox from public, anon, authenticated;
grant select, insert, update, delete on public.email_outbox to service_role;
create index email_outbox_ready on public.email_outbox
  (next_attempt_at, created_at, id) where status = 'pending';
create index email_outbox_expired on public.email_outbox
  (lease_expires_at, id) where status = 'processing';
```

  Use UUID PK, unique cascading notification FK, five allowed statuses, attempts 0â€“3, paired digest/first-attempt fields, processing-token/lease equivalence, sent/provider-ID/time equivalence, valid SHA-256 encoding, and bounded allowlisted error/provider-ID strings. Defaults are database timestamps and pending/zero attempts. Do not copy PII or rendered payloads into SQL.
- [x] Replace the existing private insertion helper in this new migration. Resolve the typed effective due from activity/work inside the originating activity lock for `due_soon`; verify the existing complete dedupe key matches that same timestamp via `notification_epoch_us`. Preserve the six-argument signature and all seven event identities. After an actual notification insert, enqueue only the two eligible kinds:

```sql
insert into public.email_outbox(notification_id, status, due_at, last_error)
select notice_id,
       case when p.email_notifications then 'pending' else 'skipped' end,
       event_due_at,
       case when p.email_notifications then null else 'preference_off' end
from public.parent p
where p.id = recipient;
```

  `notice_id`, `recipient`, and typed `event_due_at` are helper locals; fail with a fixed integrity error if an email-eligible notification has no parent profile or due metadata is invalid. Keep dedupe receipt claim, notification, and outbox insertion in the same function transaction. Do not enqueue by a generic table trigger, scan historical notifications, modify release semantics, or contact Resend.
- [x] Reset/replay the ephemeral migrations; run the new module plus existing notification event/deadline tests, then the full suite because migrations changed. Generate database types from this actual stack, review security advisors, and commit migration/tests/types together with `feat: queue classroom email events atomically`. Record red/green evidence and generated migration path.

### Task 2: Current recipient and event eligibility

**Files:** Create CLI-named `phase3_email_context` migration and `backend/tests/rls/test_email_eligibility.py`; extend `email_support.py`; regenerate `frontend/types/database.ts`.

**Interfaces:** Produce `email_recipient_address`, shared `email_eligibility`, private `prepare_email_delivery_at`, and public service-only `prepare_email_delivery` with the shared shapes. Consume Task 1's rows and existing `assigned_activity_students`, `active_submission`, teacher roster, parent linkage, and Return metadata.

- [x] Add a fixture helper that turns only the selected seeded outbox row into processing with a UUID token/two-minute lease for fixed-time preparation tests. This is owner-only fixture setup while claim RPCs are still absent. Add red tests that prove the canonical Auth address is used and an edited public profile address is ignored:

```python
import json
from uuid import uuid4

from tests.rls.notification_support import db_value


def prepare_at(row_id, token, as_of):
    raw = db_value(
        'select writewise_internal.prepare_email_delivery_at($1,$2,$3)',
        row_id, token, as_of,
    )
    return json.loads(raw) if isinstance(raw, str) else raw


def test_foreign_token_never_reveals_recipient(family, assigned_activity):
    row = seed_due_email(family, assigned_activity['id'], NOW)
    result = prepare_at(row['id'], uuid4(), NOW)
    assert result == {'state': 'lost'}
    assert 'recipient' not in result
```

  Import `seed_due_email` from `tests.rls.email_support` and define the same UTC `NOW` constant locally. For the ready-path test, use the fixture token and compare against `admin.auth.admin.get_user_by_id(family['parent']).user.email`; restore any edited profile email after the case.
- [ ] Cover the spec Â§5 matrix before implementing: opt-out/re-enable, revoked parent link/teacher roster, archive, missing/unconfirmed/banned Auth account, edited profile email, exact due/24-hour boundaries, changed effective due/override, equivalent offsets, current assignment removal, both activity modes, completed ungraded/draft/released/pinned work, processing/rejected retries, historical Return, later completed attempt, and later Return supersession. Seed ban/confirmation changes through ephemeral Auth admin operations and restore them. Do not change shared confirmed-user fixtures permanently.
- [x] Run `uv run pytest tests/rls/test_email_eligibility.py -q` and observe the absent helper failure. Create the context migration. Implement the private canonical Auth lookup with only required email/confirmation/deletion/ban fields; fixed search path; revoked browser execution; narrow returned result. Keep the rest of the eligibility code invoker-based. Due predicates include:

```sql
effective_due = queued_due
and effective_due >= check_time
and effective_due <= check_time + interval '24 hours'
and not exists (
  select 1 from public.active_submission s
  where s.activity_id = work_activity and s.student_id = work_student
)
```

  `effective_due`, `queued_due`, `check_time`, `work_activity`, and `work_student` are typed helper locals. Current assignment comes from the private service-side helper, not JWT-scoped `public.is_assigned`. Return relevance requires the target still returned, latest by `(returned_at,id)`, no active attempt, and no later completed attempt by `(created_at,id)`; retain historical visibility when current assignment alone changed. Do not read measurements or rubric fields.
- [x] Implement prepare: locate the activity ID without locking outbox first, acquire the activity lock, then lock/recheck the outbox token/status/lease, sample actual time after locks in production, and run a fresh eligibility statement. Invalid events update to skipped with a finite code and clear lease/token; valid events return only `ready`, canonical recipient, and event type. Wrong/missing/expired claims return `lost` without PII. Revoke public/anon/authenticated execution and grant the service entry point only to service_role.
- [ ] Add lock-observed race tests with `wait_for_database_lock`: commit completion, due/override edit, preference change, or link removal before a waiting preparation eligibility query and assert suppression. Prove a preparation response carries no score/note/name/title. Replay, run focused and full ephemeral tests/advisors, regenerate types, and commit `feat: revalidate classroom email recipients and events`.

### Task 3: Leases, send reservations, and durable outcomes

**Files:** Create CLI-named `phase3_email_queue` migration and `backend/tests/rls/test_email_queue.py`; extend `email_support.py`; regenerate `frontend/types/database.ts`.

**Interfaces:** Produce the remaining three public RPCs and private `_at` functions with the shared signatures. Consume preparation/eligibility from Task 2. Successful authorize returns a fresh `claim_token`, attempts, first-attempt time, and authorization time; it does not extend the two-minute lease.

- [ ] Add red fixed-time tests for disjoint concurrent claims, ordered ready selection, expired-lease recovery, wrong/stale tokens, three-attempt and one-hour boundaries, digest/recipient changes, and terminal-state immutability. A concrete reservation regression is:

```python
def test_authorization_token_is_single_use(prepared_email):
    row, token, address, now = prepared_email
    first = authorize_at(row['id'], token, address, 'a' * 64, now)
    assert first['state'] == 'authorized'
    assert first['attempts'] == 1
    assert first['claim_token'] != str(token)
    repeated = authorize_at(row['id'], token, address, 'a' * 64, now)
    assert repeated == {'state': 'lost'}
    assert outbox_row(row['id'])['attempts'] == 1
```

  Define `prepared_email` in this test module using `seed_due_email`, fixed-time claim/preparation, and the canonical address. Add `authorize_at(row_id, token, address, digest, as_of)` and `outbox_row(row_id)` to `email_support.py`; the former calls `writewise_internal.authorize_email_delivery_at` and normalizes JSON like `prepare_at`, the latter SELECTs the actual service-only row. The fixture excludes other pending rows as described in Task 1.
- [x] Run `uv run pytest tests/rls/test_email_queue.py -q` for missing-RPC failures, then create the queue migration. Claim at most one row with a bounded expired-lease recovery scan (10 rows per claim RPC, at most 100 across a ten-claim HTTP invocation, also bounded by the 20-second budget) and `FOR UPDATE SKIP LOCKED`. The atomic claim core is:

```sql
with candidate as (
  select q.id from public.email_outbox q
  where q.status = 'pending' and q.next_attempt_at <= check_time
  order by q.next_attempt_at, q.created_at, q.id
  for update skip locked limit 1
)
update public.email_outbox q
set status = 'processing', claim_token = gen_random_uuid(),
    lease_expires_at = check_time + interval '2 minutes'
from candidate c where q.id = c.id
returning q.*;
```

  Recover expired processing rows in a separate short locked batch: pending when attempts are below 3 and the window is open; failed `delivery_unknown` at three reservations or an expired unknown send window. A never-reserved claim has no one-hour cutoff yet. Pending rows whose known retry window expired become failed `retry_window_expired` without being sent. No enqueue/assignment/lifecycle lock is held by claim/recovery.
- [x] Implement authorize with activity-before-outbox locking and fresh eligibility/address validation. Reject a changed recipient or mismatched existing digest as skipped `payload_changed`. Reserve before returning permission:

```sql
update public.email_outbox
set attempts = attempts + 1,
    first_attempt_at = coalesce(first_attempt_at, check_time),
    payload_sha256 = coalesce(payload_sha256, requested_digest),
    claim_token = gen_random_uuid()
where id = target_outbox_id
  and status = 'processing' and claim_token = expected_claim_token
  and lease_expires_at > check_time and attempts < 3
  and (first_attempt_at is null or check_time < first_attempt_at + interval '1 hour')
returning claim_token, attempts, first_attempt_at;
```

  Validate a 64-character lowercase hex digest and exact address before this statement. Wrap all checks/update in one transaction. The new token prevents replay of the same reservation request; unknown RPC outcome must not cause the backend to guess it was authorized. All rejected paths either safely skip/fail the row or return `lost`, never return a recipient to a foreign token.
- [x] Implement finish as a compare-and-set on ID, processing status, current token, and unexpired lease. `sent` requires a bounded provider ID; `retry` requires an allowed error and a future retry strictly within the first-attempt hour with attempts below 3; `failed` needs a known code; `released` clears only an unused current claim and does not consume an attempt or erase retry evidence. Clear lease/token on all acknowledged transitions. Return false for stale/deleted/expired owners. Enforce the same allowlisted categories in SQL and backend contracts.
- [ ] Prove actual rollback/concurrency behavior: two sessions claim disjoint rows; a held claim does not block the second claim; obsolete token cannot authorize/finalize; database disconnect after reservation leaves bounded recoverable evidence; finalization loss can replay the identical key/payload later; attempts=3 and first-attempt+one-hour never authorize again. Use observed barriers and two real connections, not an in-memory queue simulation. Run replay/full suite/advisors, regenerate types, and commit `feat: add recoverable email delivery leases`.

### Task 4: Fixed templates, typed contracts, and safe configuration

**Files:** Create `backend/app/email/__init__.py`, `contracts.py`, `templates.py`, `backend/tests/unit/test_email_templates.py`, `test_email_config.py`; modify `backend/app/core/config.py`, `backend/.env.example`.

**Interfaces:** Produce the rendering/configuration contracts from the shared interface table. `EmailType` is exactly `Literal['submission_returned', 'due_soon']`. `RenderedEmail` owns the actual request body and its canonical digest; it hides the body from repr. `ProviderResult` contains only safe classifications/opaque IDs.

- [x] Add database-free red tests for exact v1 text/HTML/links, deterministic digest, template input allowlist, sender/origin validation, secret redaction, disabled defaults, and enabled incomplete configuration. The renderer test must assert actual copy and prohibited fields, not just a snapshot of its own implementation:

```python
from app.email.templates import render_email


def test_due_template_is_generic_and_has_only_normal_portal_links():
    mail = render_email(
        'due_soon', 'parent@example.com', 'WriteWise <classroom@example.com>',
        'https://writewise.example',
    )
    assert mail.body['subject'] == 'WriteWise: an activity is due soon'
    assert "Your child has a handwriting activity due within 24 hours." in mail.body['text']
    assert 'https://writewise.example/login' in mail.body['text']
    assert 'https://writewise.example/parent-settings' in mail.body['text']
    assert set(mail.body) == {'from', 'to', 'subject', 'text', 'html'}
    assert '<img' not in mail.body['html']
    assert '?' not in mail.body['html']
    assert 'parent@example.com' not in repr(mail)
```

  Return template must match the approved separate subject/body. Tests inject malicious sender/origin values, both event kinds, unknown event input, and altered body fields for fingerprint comparisons. Configuration tests instantiate `Settings(_env_file=None, **explicit_dummy_settings)` so a developer's hosted `.env` cannot influence results. Supply the six required existing Supabase/CORS settings in that test helper.
- [x] Run `uv run pytest --confcutdir=tests/unit tests/unit/test_email_templates.py tests/unit/test_email_config.py -q` and record absent-module/setting failures. Define the shared models with these fields:

```python
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, SecretStr

EmailType = Literal['submission_returned', 'due_soon']


class DeliveryClaim(BaseModel):
    outbox_id: UUID
    notification_id: UUID
    event_type: EmailType
    claim_token: UUID
    lease_expires_at: datetime
    attempts: int = Field(ge=0, le=3)


class PreparationResult(BaseModel):
    state: Literal['ready', 'skipped', 'lost']
    recipient: SecretStr | None = None
    event_type: EmailType | None = None
    code: str | None = None


class AuthorizationResult(BaseModel):
    state: Literal['authorized', 'skipped', 'lost']
    claim_token: UUID | None = None
    attempts: int | None = Field(default=None, ge=1, le=3)
    first_attempt_at: datetime | None = None
    authorized_at: datetime | None = None
    code: str | None = None


class DispatchCounts(BaseModel):
    claimed: int = Field(default=0, ge=0)
    sent: int = Field(default=0, ge=0)
    retried: int = Field(default=0, ge=0)
    failed: int = Field(default=0, ge=0)
    skipped: int = Field(default=0, ge=0)


@dataclass(frozen=True)
class RenderedEmail:
    body: dict[str, object] = field(repr=False)
    recipient: str = field(repr=False)
    digest: str


@dataclass(frozen=True)
class ProviderResult:
    disposition: Literal['sent', 'retry', 'failed']
    code: str | None = None
    message_id: str | None = None
    retry_not_before: datetime | None = None
    stop_batch: bool = False
```

  Add model validation for state/field combinations: ready requires recipient/type; authorized requires current token/attempt/timestamps; skipped requires one allowed skip code; lost carries no recipient/token. Keep the finite error/skip catalog shared with Task 3's SQL constraints. Reject malformed backend RPC responses as sanitized infrastructure failures rather than trusting optional fields.
- [x] Implement `payload_digest` and the two fixed v1 templates. Use only fixed copy, escaped configured links, canonical `/login` and `/parent-settings`, and sender/recipient required by Resend. No name/title parameter is accepted. Digest the complete body exactly:

```python
import hashlib
import json


def payload_digest(body: dict[str, object]) -> str:
    encoded = json.dumps(
        body, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
    ).encode('utf-8')
    return hashlib.sha256(encoded).hexdigest()
```

  Build `to` consistently as a one-element list. Text/HTML use the approved Â§9.1 wording and footer. Keep body generation stable across retries; do not include timestamps, random IDs, request-specific signatures, or unsaved account labels. Reject unsupported event types before rendering. Validate sender/origin before interpolating escaped links into HTML.
- [x] Add settings with `EMAIL_DISPATCH_ENABLED=False`, blank `SecretStr` dispatch/Resend keys, and blank sender/origin. Extend existing `SettingsConfigDict` with `hide_input_in_errors=True` while preserving `.env` support. When enabled, require a dispatch secret at least 32 characters, nonblank API key/sender/origin, no header control characters, and a plain canonical origin: HTTPS, or HTTP only for literal localhost/127.0.0.1/::1 development; no credentials, query, fragment, or path beyond `/`. A cross-field validator raises only a fixed diagnostic naming missing/invalid setting names. Test `str(ValidationError)` and application log capture for secret absence. Add commented example env values without real keys/domain details. Disabled mode must keep existing application startup working.
- [x] Rerun the new modules and the entire database-free suite; Ruff; API schema generation if model imports affect routes later. Commit `feat: define minimal classroom email templates and settings`. These tests prove rendering/configuration, not SQL/RLS or actual email delivery.

### Task 5: Resend adapter and deterministic retry policy

**Files:** Create `backend/app/email/provider.py`, `retry.py`, `backend/tests/unit/test_email_provider.py`, `test_email_retry.py`; modify `backend/pyproject.toml`, `backend/uv.lock` using `uv add 'httpx==0.28.1'` during execution.

**Interfaces:** Consume Task 4's `RenderedEmail`/`ProviderResult`; produce the exact `ResendSender.send` and `retry_at` contracts. The sender receives its own owned async HTTPX client, never the queue client's service headers.

- [x] Write red adapter tests with `httpx.MockTransport` and `asyncio.run`, without adding pytest-asyncio. A concrete real-request assertion is:

```python
import asyncio
import json
from uuid import UUID

import httpx

from app.email.provider import ResendSender
from app.email.templates import render_email


def test_sender_reuses_exact_body_and_stable_key():
    identifier = UUID('44444444-4444-4444-4444-444444444444')
    mail = render_email('due_soon', 'parent@example.com', 'sender@example.com',
                        'https://writewise.example')
    calls = []

    def respond(request):
        calls.append(request)
        assert str(request.url) == 'https://api.resend.com/emails'
        assert request.headers['Idempotency-Key'] == f'writewise-email/{identifier}'
        assert json.loads(request.content) == mail.body
        assert 'apikey' not in request.headers
        return httpx.Response(200, json={'id': str(identifier)})

    async def exercise():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as client:
            result = await ResendSender(client, 'synthetic-api-key').send(mail, identifier)
            assert result.disposition == 'sent'
            assert result.message_id == str(identifier)

    asyncio.run(exercise())
    assert len(calls) == 1
```

  Additional cases: connect/read/overall timeout, malformed/oversized success, 5xx, unknown error JSON, non-JSON error, HTTP 429 and both quota names, integer/date/invalid `Retry-After`, both documented idempotency 409 names, permanent 400/401/403/422, redirect rejection, and a raw exception/response containing sentinel PII that must not appear in result repr/logs. Provider success must return a valid bounded opaque ID, not an arbitrary reflected string.
- [x] Write red pure retry tests using fixed UTC datetimes:

```python
from datetime import datetime, timedelta, timezone

from app.email.retry import retry_at


def test_retry_delay_and_strict_hour_limit():
    first = datetime(2030, 1, 1, tzinfo=timezone.utc)
    assert retry_at(1, first, first, None) == first + timedelta(minutes=5)
    assert retry_at(2, first, first, None) == first + timedelta(minutes=15)
    assert retry_at(3, first, first, None) is None
    assert retry_at(1, first, first, first + timedelta(hours=1)) is None
```

  Also prove a provider hint can postpone but never accelerate the local delay, an already-expired window cannot retry, and all inputs are timezone-aware. Run both new modules before implementation and record red failures.
- [x] Declare the already-locked HTTPX version directly with uv and inspect the lock diff for unrelated upgrades. Implement a single request using a fixed URL, no automatic retries/redirect following, component timeouts plus an actual overall five-second budget:

```python
async with asyncio.timeout(5.0):
    response = await self.client.post(
        'https://api.resend.com/emails',
        headers={
            'Authorization': f'Bearer {self.api_key}',
            'Idempotency-Key': f'writewise-email/{outbox_id}',
        },
        json=mail.body,
        timeout=httpx.Timeout(5.0, connect=2.0),
        follow_redirects=False,
    )
```

  This block belongs inside `ResendSender.send`; normalize all timeout/request/JSON failures into the approved finite results without logging raw objects. Set `stop_batch=True` for 429/quota and credentials/domain-wide rejection; permanent recipient/request rejection fails only that row. `concurrent_idempotent_requests` retries the same key; `invalid_idempotent_request` fails without changing it. Do not poll Resend, add webhooks, or inspect billing settings in the app.
- [x] Implement retry scheduling with `(authorized_at + 5 minutes)` for attempt 1, `(authorized_at + 15 minutes)` for attempt 2, max with a valid provider hint, and return null when attempts=3 or the resulting time is at/beyond first-attempt+one-hour. Never sleep or retry inside `send`. When retry is disallowed, preserve a known failure category; unknown lost-delivery recovery is classified by Task 3, not falsely called sent.
- [x] Run the new modules and full database-free suite; Ruff; review dependency/lock changes and log-capture assertions. Commit `feat: add bounded Resend delivery and retry policy`.

### Task 6: Async queue orchestration and authenticated internal endpoint

**Files:** Create `backend/app/email/queue.py`, `dispatcher.py`, `backend/app/api/internal_emails.py`, `backend/tests/unit/test_email_dispatcher.py`, `test_email_routes.py`, `test_email_queue_transport.py`; modify `backend/app/main.py`, generated `frontend/types/api.ts`, `docs/API_SPEC.md` Â§2.4.

**Interfaces:** Consume Tasks 1â€“5; produce `dispatch_emails`, `require_dispatch_secret`, `get_email_delivery_resources`, and the typed aggregate route. `EmailQueue` is an async, non-retrying HTTP adapter over the four service-only RPCs, with a two-second total budget for each operation. Route/resource construction has no synchronous database call.

- [x] Add red tests driving actual HTTPX requests and real FastAPI handlers. Mock only external HTTP: RPC transport returns the shared JSON shapes and provider transport returns acknowledgements/errors. Assert sequence `claim â†’ prepare â†’ authorize â†’ provider â†’ finish`, the rotated authorization token used in finish, no provider before acknowledged authorization, no provider after skip/lost/disabled, and no recipient/row/limit/URL forwarded from spoofed request JSON/query. The missing-header route test must exercise the final mounted path:

```python
from fastapi.testclient import TestClient

from app.main import app


def test_missing_dispatch_secret_is_unauthorized():
    with TestClient(app) as client:
        response = client.post('/api/internal/dispatch-emails')
    assert response.status_code == 401
    assert response.json()['error']['code'] == 'UNAUTHORIZED'
```

  Use `monkeypatch` for synthetic settings/resources and restore dependency overrides in fixture cleanup. Add correct-secret/disabled 503, browser-bearer-only 401, empty-secret rejection, aggregate empty/sent/retry/fail/skip counts, malformed RPC results, failed finish after provider acceptance, connection/cancellation errors, and safe 500 handling. Do not replace SQL proof with these transport tests.
- [x] Run the three new modules for absent-route/module failures. Implement queue RPC mapping with service-only headers supplied on the owned queue client; convert known results to models and catch/replace exceptions with a fixed infrastructure error before they can reach general request logging:

```python
async def _rpc(self, name: str, payload: dict[str, object]) -> object:
    try:
        async with asyncio.timeout(2.0):
            response = await self.client.post(f'rpc/{name}', json=payload)
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, TimeoutError, ValueError):
        raise RuntimeError('Email queue operation failed.') from None
```

  `_rpc` is private to `EmailQueue`; public methods allow only the four fixed function names, encode UUID/time arguments, validate shapes, and never expose arbitrary RPC execution through the route. Configure a dedicated `httpx.AsyncClient` base URL ending in `/rest/v1/`, timeout two seconds, `apikey`/Bearer service headers, redirects disabled, and `AsyncHTTPTransport(retries=0)`. Use a separate client for Resend. Close both in the async resource dependency.
- [x] Implement orchestration with a monotonic 20-second outer budget, max 10 one-at-a-time claims, and the exact per-row state machine:

```text
claim null             -> return counts
claim exists           -> increment claimed
prepare skipped        -> increment skipped; next row
prepare lost           -> stop; no provider request
insufficient budget    -> finish released under original token; stop
authorize skipped      -> increment skipped; next row
authorize lost         -> stop; no provider request
authorize acknowledged -> send once using stored body and stable outbox key
provider sent          -> finish sent using rotated token; increment sent
provider retry allowed -> finish retry; increment retried
provider failure/limit -> finish failed; increment failed
provider stop_batch    -> return after acknowledged outcome
database failure       -> abort; preserve already committed outcomes/lease evidence
```

  Before authorize require at least 9.5 seconds remaining (2 seconds authorization, 5 provider, 2 finalization, 0.5 margin). Before starting another claim require enough time for its DB call and safe unused-claim release. A timeout after reservation follows lease recovery and never increments sent. Finalization false is an infrastructure failure, not an acknowledged delivery count. Returned counts can exclude an unused released or lost claim; `claimed` is not required to equal the four outcome counters. Fixed-clock/fake monotonic tests prove the budget without long sleeps; an async transport gate proves normal app requests can continue while a provider request is pending.
- [x] Implement `APIKeyHeader(name='X-Dispatch-Secret', auto_error=False)` authentication and fixed envelopes. Compare encoded secrets in constant time only when the configured secret is nonblank. Check authentication before disabled status or resource/queue access. Make the resource dependency itself depend on `require_dispatch_secret` so ordering cannot accidentally open clients before authorization. Valid auth with disabled dispatch returns 503 `EMAIL_DISPATCH_UNAVAILABLE`; invalid/missing auth returns 401 `UNAUTHORIZED`; sanitized infrastructure failure returns 500 `INTERNAL_ERROR`. Register under `/api/internal` with typed `DispatchCounts`, documented header security, and no user-selectable body schema. No general logger.exception of delivery/provider objects.
- [x] Add the new 503 code and route/aggregate/partial-failure semantics to API_SPEC. Generate OpenAPI from the actual FastAPI app with dummy localhost test settings and regenerate `frontend/types/api.ts` using the CI-pinned `openapi-typescript@7.13.0`; do not hand-edit it. Run all unit/transport checks, Ruff/ESLint/TypeScript, full ephemeral suite for API changes, and commit `feat: dispatch classroom emails through the internal API` with generated API types.

### Task 7: Private scheduling, network permissions, and upgrade proof

**Files:** Create CLI-named `phase3_email_dispatch` migration, `backend/tests/rls/test_email_scheduler.py`, `backend/tests/migrations/email_upgrade_check.py`, `backend/tests/support/email_callback.py`; modify `backend/tests/conftest.py`, `.github/workflows/ci.yml`, generated `frontend/types/database.ts`.

**Interfaces:** Produce private job-owner-only `request_email_dispatch() -> bigint | null`; one named `writewise-email-dispatch` job at `*/5 * * * *`; preserve the existing deadline job. The callback is a synthetic test listener, not a deployed app service.

- [ ] Add red tests for job registration, no-op absent Vault entries, duplicate/invalid configuration, denied browser/private/network access, and actual post-commit callback path/header/body. Extend the root autouse fixture to save/pause/restore both job names individually. Preserve a job's original active state; do not disable/drop the extension or silently ignore a required missing job after migration. Add a synthetic pre-Slice-4 upgrade manifest with actual work, released/unreleased scores, both email-eligible historical notifications, receipts, teacher/parent accounts, and read states. Assert these snapshots survive unchanged, preferences default true, and historical outbox count stays zero.

```python
from tests.rls.notification_support import db_value


def test_one_private_email_job_without_embedded_configuration():
    assert db_value(
        "select count(*) from cron.job where jobname='writewise-email-dispatch' "
        "and schedule='*/5 * * * *' "
        "and command='select writewise_internal.request_email_dispatch();'"
    ) == 1
    assert not db_value(
        "select has_function_privilege('authenticated', "
        "'writewise_internal.request_email_dispatch()', 'EXECUTE')"
    )
```
- [x] Run the new scheduler module and upgrade check in red before migration implementation. Create the migration through `supabase migration new phase3_email_dispatch`. Discover actual pg_net/Vault extension names and installed permissions on the disposable stack, then create only absent supported extensions. Do not drop/recreate an existing extension. The private helper reads exactly one nonblank value for each of `writewise_backend_url` and `writewise_email_dispatch_secret`; absent/blank means null/no HTTP; duplicates/invalid URL mean fixed value-free error. Validate a plain HTTPS backend origin or literal localhost test origin, append the fixed route, and send:

```sql
select net.http_post(
  url := backend_origin || '/api/internal/dispatch-emails',
  headers := jsonb_build_object(
    'Content-Type', 'application/json',
    'X-Dispatch-Secret', dispatch_secret
  ),
  body := '{}'::jsonb,
  timeout_milliseconds := 30000
);
```

  `backend_origin` and `dispatch_secret` are private local variables populated from Vault, never migration literals. Restrict helper execution to the job owner; revoke PUBLIC/anon/authenticated access to Vault decrypted views and pg_net queue/response data and direct network functions, while preserving required worker/owner access. Keep all these schemas outside config.toml's exposed schemas.
- [x] Register the named job with command text containing only the private function call:

```sql
select cron.schedule('writewise-email-dispatch', '*/5 * * * *',
  'select writewise_internal.request_email_dispatch();');
```

  Test name replacement yields one job, no configured values appear in `cron.job.command`, and no helper response exposes headers/secrets. Current job existence is schema evidence; successful `net.http_post` enqueue is not delivery evidence. Verify actual role grants rather than relying only on Data API schema exclusion.
- [x] Implement the callback using Python's standard `HTTPServer`, bound to `127.0.0.1:8765` inside the disposable database container's network namespace. It accepts only the fixed POST path, checks a synthetic 32+ character header secret and `{}` body, and returns the normal zero-count JSON. A GET `/state` returns only `{calls, authenticated, path_ok, body_ok}`; override access logging so headers/bodies are never printed. In CI run it in a short-lived `python:3.13-slim` sidecar sharing `container:supabase_db_writewise-test`; mount the tracked callback file read-only, expose no host port, and teardown it with `if: always()`. A host-bound listener would not be loopback from pg_net's container, so do not use host networking assumptions.

  The required CI setup command, after verifying the database container name from the configured project, is:

```bash
docker run --detach --rm --name writewise-email-callback \
  --network container:supabase_db_writewise-test \
  --mount type=bind,src="$PWD/backend/tests/support/email_callback.py",dst=/callback.py,readonly \
  python:3.13-slim python /callback.py
```

  Tests install only synthetic Vault values, commit the private helper invocation, and poll boundedly for the matching response/callback counters. An aborted enqueue transaction must produce no callback. Sidecar image availability is part of the ephemeral runner prerequisite, not an optional skip in required CI. No Resend endpoint is contacted by this test.

  Use the shared synthetic value `synthetic-email-dispatch-secret-00000001` in this listener and its Vault fixture, never backend credentials. The workflow cleanup is a separate always-run step before Supabase teardown:

```yaml
- name: Stop synthetic email callback
  if: always()
  run: |
    if docker container inspect writewise-email-callback >/dev/null 2>&1; then
      docker container rm --force writewise-email-callback
    fi
```
- [x] Add the fourth upgrade stage to CI: local reset to `20261103010004`, prepare the email manifest, migrate up locally, verify preservation/no replay, and reset locally again. Retain all prior three upgrade stages. Add the callback setup/teardown around the full pytest stage and a temporary feature-branch trigger only if an authorized CI execution path requires it. Keep dispatch disabled and no real Vault keys in normal tests. Never print generated ephemeral credentials or manifest passwords.

```yaml
- name: Verify legacy email upgrade
  env:
    ENVIRONMENT: test
  run: |
    supabase db reset --local --version 20261103010004
    cd backend
    uv run python tests/migrations/email_upgrade_check.py prepare --manifest /tmp/email-upgrade.json
    cd ..
    supabase migration up --local
    cd backend
    uv run python tests/migrations/email_upgrade_check.py verify --manifest /tmp/email-upgrade.json
    cd ..
    supabase db reset --local
```
- [ ] Replay migrations, run scheduler/upgrade/queue tests and the full suite, inspect advisors and generated DB drift, generate types from the migrated stack, and commit `feat: schedule private email dispatch and verify upgrades` with types. Record that tested callback delivery is synthetic, not a user inbox or hosted provisioning proof.

### Task 8: Parent and teacher email preference controls

**Files:** Create `frontend/lib/notifications/preferences.ts`, `frontend/components/settings/notification-settings-card.tsx`; modify `frontend/app/(parent)/parent-settings/page.tsx`, `frontend/app/(teacher)/settings/page.tsx`. Consume generated `frontend/types/database.ts`; do not modify generated types manually.

**Interfaces:** `readEmailPreference(client, accountId, role, signal?) -> Promise<boolean>` and `saveEmailPreference(client, accountId, role, enabled, signal?) -> Promise<boolean>`, where role is exactly `'parent' | 'teacher'`. Card props: `{accountId: string; role: 'parent' | 'teacher'; initialEnabled: boolean | null}`. Null means unavailable, not default true.

- [ ] Before editing, record a manual/controlled reproduction checklist: current settings lack the control; an account with false must retain false after refresh; a profile read failure must not become true; saving with an account switch must never patch the new account. This is the frontend's required behavior check; do not install a test framework or add implementation-mirroring component tests.
- [x] Extend each existing verified server profile query with `email_notifications`, preserve its error, and pass actual account ID/role plus boolean or null into the shared card. Keep profile/security components functioning. The card uses existing Card/Label/Switch/Button primitives and design tokens; parent copy is exactly the approved helper. Teacher copy explicitly says current classroom emails go to parents. Place it as a normal Notifications settings section, not an implementation/dispatcher status panel.
- [x] Implement the preference transport using an exact verified access token for the direct RLS REST request. Reuse `getAuthToken` and `ApiError`; the SDK's mutable shared session must not substitute a different token between verification and write:

```typescript
const token = await getAuthToken(client);
signal?.throwIfAborted();
const { data, error } = await client.auth.getUser(token);
signal?.throwIfAborted();
if (error || data.user?.id !== accountId) {
  throw new ApiError({ code: "UNAUTHORIZED", message: "Sign in again to save settings." });
}
const table = role === "teacher" ? "teacher" : "parent";
const endpoint = new URL(`/rest/v1/${table}`, process.env.NEXT_PUBLIC_SUPABASE_URL);
endpoint.searchParams.set("id", `eq.${accountId}`);
endpoint.searchParams.set("select", "id,email_notifications");
const response = await fetch(endpoint, {
  method: "PATCH",
  headers: {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
  },
  body: JSON.stringify({ email_notifications: enabled }),
  signal,
});
```

  This is the core of `saveEmailPreference`; validate required public configuration before creating the URL, constrain `role` at the TypeScript boundary, and never use a service key. Read uses the same token/URL/account predicate with GET. After response parse, require exactly one row with matching ID and boolean value; empty/malformed results raise a fixed `ApiError`, never a success toast. Check abort again before returning. Do not branch on or display arbitrary database error messages.

  A ready-state switch uses the actual loaded boolean, normal form submission, and associated copy; loading/unavailable states render their own retry UI before this ready branch:

```tsx
<Label htmlFor="email-notifications">Email me</Label>
<Switch
  id="email-notifications"
  checked={draftEnabled}
  onCheckedChange={setDraftEnabled}
  aria-describedby="email-notifications-description"
  disabled={isSaving}
/>
<p id="email-notifications-description">
  {role === "parent"
    ? "Get email when work needs another attempt or an activity is due soon. In-app notifications stay on."
    : "Classroom emails currently go to parents. Your in-app notifications stay on."}
</p>
```
- [x] Implement explicit load/unavailable/retry/save states. Null initial value triggers an account-bound RLS read and disables saving until a confirmed boolean exists. Track saved versus draft value; keep the saved value on failure; disable duplicate saves. On unmount/account change/sign-out, abort requests and invalidate the local request generation so stale promises cannot update a new account's UI. A request already sent with the old pinned token can only affect the old account under RLS; it must never acquire the new account's token. After success refresh the server profile, preserving focus and announcing fixed feedback. The switch uses a real associated label and helper text; no in-app toggle is added.
- [ ] Run ESLint/TypeScript and production webpack build. Manually verify both roles, true/false refresh persistence, read/save failures, zero-row update, rapid double save, account switching during token verification and during PATCH, mobile layout, keyboard operation, focus, and fixed feedback. Use a temporary controlled HTTP/SDK harness for these account races if needed; do not claim it as a signed-in walkthrough. Keep the existing bell working and prove one linked parent's preference does not change another's. Commit `feat: add classroom email account preferences` and record manual evidence separately.

### Task 9: Full verification, documentation, and handoff

**Files:** Update `docs/API_SPEC.md`, `docs/DATABASE.md`, `docs/PRD.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/DEPLOYMENT.md`, `docs/DESIGN.md`, `docs/TESTING.md`, `docs/adr/0005-transactional-notifications-and-scheduling.md`, `docs/next_steps/PHASE_3_CLASSROOM_ACTIVITIES.md`, `IMPLEMENTATION_STATUS.md`, this plan's execution record; regenerate both actual type files as required.

**Interfaces:** Promote only implemented and verified contracts. Preserve the distinction between implemented, verified, merged, hosted-configured, provider-accepted, and inbox-delivered. Slice 4 remains unverified while any required automated or manual gate is open.

- [ ] Map each spec acceptance item to real test names and recorded results. Close the matrix below with actual evidence, including queue faults/locks, canonical recipient lookup, browser role denials, provider quota isolation, exact token/lease recovery, scheduler callback, and four upgrade proofs. Resolve material review findings; do not mark a row covered solely because a model/fixture reproduces implementation declarations.
- [ ] Run required checks once the implementation stabilizes, from their correct directories. Supported installed-tool Windows fallbacks are shown; they do not bypass lint/type rules:

```powershell
# backend/
uv run ruff check .
.\.venv\Scripts\ruff.exe check .

# frontend/
node node_modules/eslint/bin/eslint.js .
node node_modules/typescript/bin/tsc --noEmit --incremental false
npm.cmd run build -- --webpack
```

  Use Ruff's installed executable only when the uv wrapper is unavailable; do not needlessly run both equivalents. Use `npm.cmd` when PowerShell blocks `npm.ps1`. For build-only local verification use dummy localhost public settings rather than exposing local env files. A worktree's existing dependency junction may require webpack, as previous slices documented. Build and type checks do not replace manual portal QA.
- [ ] On the ephemeral stack, replay migrations, run all four prepare/upgrade/verify proofs, full `uv run pytest`, generated OpenAPI/database comparison, and security advisors. Pause/restore wall-clock jobs during deterministic tests, keep the synthetic callback available, and teardown the stack/callback even after failure. Use discovered local-only CLI flags. Regenerate types with the pinned tools and inspect diffs; never suppress drift. For API output the existing CI generation is:

```python
import json
from pathlib import Path

from app.main import app

Path('/tmp/writewise-openapi.json').write_text(json.dumps(app.openapi()), encoding='utf-8')
```

```bash
npx --yes openapi-typescript@7.13.0 /tmp/writewise-openapi.json -o types/api.ts
supabase gen types typescript --local > frontend/types/database.ts
git diff --check
```

  Run the first command from `frontend/`, database generation from the repository root, and use a real OS temporary path on Windows instead of assuming `/tmp`. The Python export runs from backend with explicit localhost test settings. At final verification rerunning both generators must leave no uncommitted generated drift.
- [x] Promote API error/header/count semantics; DATABASE queue state/indexes/grants/RPCs; PRD's two optional email events; ARCHITECTURE/ADR's outbox/provider separation; SECURITY's canonical address and private Vault/network boundary; DESIGN's saved preference behavior; TESTING's race/upgrade/loopback/QA gates. DEPLOYMENT documents all five new settings, two Vault entry names, verified sender and tracking checks, secret rotation without echoing values, opt-out/no replay, bounded retries, and that paid Resend overages are provider billing behavior rather than an app spending cap. Source the provider facts from the design's primary references rather than inventing account settings.
- [x] Keep deployment steps reviewable but unexecuted unless separately authorized: actual `EMAIL_FROM`, Resend key, canonical frontend/backend origins, matching dispatch secret/Vault entries, dispatch initially off, domain/tracking confirmation, and an explicitly designated synthetic recipient for any live smoke test. Use only `writewise-dev` under established authorization; no prod operation, DNS publication, secret capture in chat, or real email to an unspecified person. A user-confirmed verified domain alone is not evidence that these application settings are configured.
- [ ] Apply requesting-code-review and verification-before-completion before integration. Review SQL authorization/locks, adapter/retry/orchestration failure handling, and settings account races; use inline review unless delegation is selected or otherwise explicitly required. Publish/PR/merge only under current authorization and the repository workflow. Commit documentation closeout with `docs: document classroom email delivery and verification`, report exact automated/manual results, and preserve useful worktree/env files.

## Coverage matrix for self-review and execution

| Spec requirement | Implemented/proved by |
|---|---|
| Â§1 scope; no historical sends; two events; default-on preference | Tasks 1, 4, 7 upgrade, 8; Task 9 product/operations docs |
| Â§4 queue constraints/indexes/RLS and transactional rollback | Task 1 real SQL/RLS/event/fault tests; Task 3 durable state invariants |
| Â§5 canonical address/current relationships/deadline/Return relevance | Task 2 complete fixed-time matrix and lock-observed races; Task 3 authorize recheck |
| Â§6 claims/attempts/digest/stable key/crash recovery/no lock across network | Tasks 3, 5, 6; real SQL versus controlled HTTP proofs remain distinct |
| Â§6 three attempts/hour, 20 seconds/10 rows, 5-second send | Tasks 3 SQL boundaries, 5 retry/overall timeout, 6 monotonic invocation tests |
| Â§6.2 permanent/transient/quota/unknown failures and safe logs | Task 5 provider matrix, Task 6 full orchestration; Task 9 privacy evidence |
| Â§7 authentication/configuration/typed API/error catalog | Tasks 4 and 6; generated OpenAPI/API types and safe config tests |
| Â§8 secrets/network permissions/named scheduler/post-commit invocation | Task 7 actual role queries, private helper/job assertions, loopback callback and rollback test |
| Â§9 generic templates/no tracking/body leak | Task 4 exact copy and prohibited-field checks; Task 9 sender tracking activation checklist |
| Â§9 owner preference, false/error/zero rows/account switches | Task 1 RLS; Task 8 actual pinned-token transport and manual portal evidence |
| Â§10 generated contracts, existing events/upgrade proofs, no unrelated refactor | Types in schema/API task commits; Task 7 fourth upgrade; Task 9 drift/review |
| Â§11 all required automated/manual/operational evidence | Task 9 closeout; tracker does not infer deployment from CI or user QA |

## Plan review and execution record

**Planning self-review (2026-11-03):** Checked spec coverage, file boundaries, task dependencies, shared SQL/JSON/Python/TypeScript names, typed deadline preservation, single-use reservation token rotation, bounded time/retry behavior, secret exposure, container-local callback networking, and generated-contract prerequisites. No implementation checkbox is complete. The approved design's generic wording, opt-out/no replay, three-attempt/one-hour retry limit, and lack of an app spending cap are preserved.

Execution records must identify the actual implementation workspace/branch and generated migration paths, fresh baseline, each red/green result, full ephemeral/upgrade/advisor/type gates, manual QA provenance, and any separately authorized publication or operational action. Do not replace missing evidence with a completion claim.

## Documentation and provider references

- [Approved spec and primary references](../specs/2026-11-03-phase3-email-notifications-design.md#12-sources-checked-during-design): Resend send/error/idempotency/domain and Supabase grants/Cron/Vault/pg_net contracts were checked during design on 2026-11-03.
- [HTTPX timeouts](https://www.python-httpx.org/advanced/timeouts/): component/inactivity timeouts are distinct from the enclosing total attempt deadline. Task 5 uses both.
- Existing executable patterns: `backend/tests/rls/notification_support.py`, `tests/rls/conftest.py`, `tests/rls/test_notification_events.py`, `tests/migrations/notification_upgrade_check.py`, `frontend/lib/notifications/read.ts`, and `.github/workflows/ci.yml`. Consult these actual files, not outdated setup paths in the repository overview.

Execution checkpoint: CI run 41635818291 passed 600 tests, including all recipient and lock-race tests; 12 new queue tests failed only because claim/authorize/finalize functions were absent. The queue migration now adds lease recovery, a per-claim attempt snapshot, single-use authorization, token rotation and bounded finalization. The snapshot prevents a reclaimed retry from finalizing without reserving its own send. Generated database types were retrieved from that exact CI head; the next run will regenerate the queue contract.

Execution checkpoint: run 41638422162 passed all 612 tests, three upgrade proofs and security advisors. It failed only expected generated database drift; actual queue types were downloaded from exact head 306c6c9. Scheduler red run 41638675417 passed those same 612 and failed nine new tests because pg_net/schema and the private helper/job were absent. Vault fixture creation succeeded, establishing the installed Vault API. Migration 20261103125051_phase3_email_dispatch.sql installs only absent extensions, restricts network/Vault grants, validates private config and registers the five-minute named job. The callback response field was corrected from retry to the real retried API contract during inline review. Frontend ESLint/TypeScript and the webpack production build passed; 150 local unit tests passed. No signed-in portal QA or hosted/provider operation is claimed.

## Inline review and acceptance evidence (2026-11-03)

Reviewed the implementation against the approved design, shared interfaces, AGENTS.md boundaries and code-review rubric inline, as requested by the user. No agents were delegated. The pass covered SQL grants/lock order/state transitions, canonical Auth lookup, HTTP/time/retry isolation, account-token races, generated contracts and operational wording. Corrected the callback aggregate key to `retried`. CI run 41639989748 identified a blanket Vault function revoke against Supabase-owned `_crypto_aead_det_encrypt`; the migration had not applied successfully. Commit `e80765d` narrows that revoke to network functions while preserving denied Vault schema/data access and internal crypto grants. The next review checkpoint adds a null-outcome regression before its SQL correction; it must fail then pass on the real stack before closing that finding.

| Acceptance | Concrete evidence |
|---|---|
| Store/RLS, atomicity and rollback | `test_email_outbox.py`: owner-scoped preferences, browser CRUD/anonymous denial, due dedupe, Return fan-out, other-five-event exclusion, cascade/no re-arm and `test_outbox_failure_rolls_back_origin_notice_and_receipt` for both origins. All original 23 passed by run 41632492888. |
| Canonical address and current relevance | `test_email_eligibility.py`: canonical Auth/profile distinction, unavailable Auth, link/roster/archive/assignment changes, due/24-hour boundaries, equivalent overrides, grading/pin/processing/rejected states, historical Return and supersession. The first 19 passed in run 41635818291; later boundary cases await their branch CI. |
| Observed commit-before-check races | `test_change_committed_before_waiting_preparation_is_observed` synchronizes on PostgreSQL lock observation for completion/deadline/preference changes; all three passed in run 41635818291. |
| Durable queue | Original 12 `test_email_queue.py` cases passed in run 41638422162: lease recovery, single-use rotation, current-token finalization, payload changes, third-send/hour cutoffs, foreign token, SKIP LOCKED, recheck and canonical recipient. Later tests add ordered disjoint claims, terminal immutability, known pending expiry, browser RPC denial, retry boundaries and null-outcome rejection. |
| No SQL lock across external send | `test_real_rpc_transactions_release_locks_before_async_provider` uses actual public PostgREST RPCs and NOWAIT activity/outbox locks from a separate connection during controlled provider I/O; branch CI is required. |
| Fixed provider request and retry idempotency | `test_email_templates.py`, `test_email_provider.py`, `test_email_retry.py`: full-body deterministic hash, fixed links/copy, stable outbox key, safe result codes, malformed/oversized bodies, both conflicts, quota/auth stop, Retry-After and one-hour cutoffs. Tests use controlled HTTP only. |
| Async API/time/count/privacy | Route/dispatcher tests cover mounted auth/503/envelopes, spoofed body ignored, dependency access denied, acknowledgment/token ordering, max ten, budget release, safe errors and real five-second send/two-second RPC/twenty-second invocation deadlines. Local full suite reached 152 passing; the added actual-health responsiveness case passed with all 11 dispatcher cases. |
| Scheduler and upgrade | `test_email_scheduler.py`, `email_callback.py`, `email_upgrade_check.py` and CI retain the prior three proofs, add the fourth, pause/restore both jobs, validate private grants, test unique/invalid Vault config and named job replacement, and exercise post-commit/rollback loopback callbacks. Scheduler red run 41638675417: 612 passed, nine expected absent-helper/pg_net failures. Fourth upgrade progressed successfully to pytest in run 41638873555. Final migrated scheduler green is still required. |
| Preference transport/UI | Eight controlled checks in ignored `.tmp/preference-check.cjs` execute actual production transport/auth/error modules with synthetic auth/HTTP: false value, exact PATCH token, foreign account, abort, session switch, zero rows, malformed boolean and fixed errors. RLS tests separately prove storage ownership and linked-parent isolation. This is not a signed-in browser walkthrough. |
| Local checks | Ruff, whole-frontend ESLint and TypeScript passed. Webpack production build passed after allowing existing font downloads; pre-existing middleware deprecation and webpack cache notices remain. No new dependency/framework was installed for UI testing. |

### Remaining manual/operational evidence

Both available computer-use entry points reported that the Windows native pipe is unavailable; browser inventory is empty. Signed-in portal QA could not be performed. Keep these manual checks open: parent/teacher true/false refresh persistence, read/save failure feedback, repeated Save, account switching during verification/PATCH, mobile layout, keyboard/focus announcements, and unchanged bells/read state. Controlled transport/RLS evidence supports but does not replace that walkthrough.

No hosted migrations/configuration, sender credentials, real provider request, tracking inspection, inbox delivery, merge or deployment occurred. The verified domain is user-reported and sender details remain deferred. The branch/worktree and useful ignored verification artifacts are preserved. Slice 4 remains unverified and Phase 3 stays 3/6 until applicable gates close.

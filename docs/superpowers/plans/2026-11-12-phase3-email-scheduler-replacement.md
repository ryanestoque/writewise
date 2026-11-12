# External Email Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execute inline in the existing email worktree; use requesting-code-review for focused review. Do not start hosted provisioning.

**Goal:** Replace the unsupported database HTTP timer with a bounded, dependency-free Node 24 caller for the existing email dispatch endpoint.

**Architecture:** A Railway scheduled process POSTs once to FastAPI and exits. A new SQL migration retires only the old email cron job/helper. Existing transactional outbox, authorization, provider and recovery code remain authoritative; the database deadline sweep stays.

**Tech Stack:** Node 24 built-in fetch/node:test, existing Python/FastAPI/HTTPX, SQL migrations, Supabase CLI 2.115.0 and existing GitHub Actions. No npm dependencies, SDK, additional Uvicorn worker or CNN runtime in the caller.

**Spec:** [Approved replacement design](../specs/2026-11-12-phase3-email-scheduler-replacement-design.md). Read it before execution.

## Global constraints

- One request per invocation, no automatic HTTP retries, redirect following, background loop or caller-selected event/recipient/body fields.
- A single 30-second AbortSignal covers fetch and bounded response reading.
- Read at most 16 KiB, cancelling an oversized response stream.
- The caller reads process environment only; it does not load the backend's .env or receive Supabase keys, Resend keys, model configuration or user-selected recipients.
- Never print configuration values, request headers, response bodies, exception messages, URLs, addresses, provider IDs or secrets. Do not trace requests.
- Do not add application-level rate limiting or a spending cap.
- Never edit the six applied email migrations or invent a timestamp.
- Do not delete historical queue rows, replay terminal messages, drop shared extensions, or attempt owner-role escalation.
- Preserve all business RLS, service-only RPC grants and existing outbox/provider/lease/route tests.
- Current authorization covers development and the previously designated inbox, not live delivery to the other recipients in shared dev.
- No platform provisioning or production change is authorized by this design alone.
- Fresh due-soon delivery remains explicitly skipped, not passed. Slice 4 stays Partial until its remaining gates close or requirements are explicitly revised.

## Execution context and file map

Existing workspace: `.worktrees/phase3-email-notifications`, branch
`feat/phase3-email-notifications`, base specification commit `b439f24`, PR #9.
The main checkout contains unrelated user changes: leave it alone. Preserve all
ignored env files, QA helpers/results and worktrees. Docker/Podman were absent
locally; the user authorized this branch's pushes to `ryanestoque/writewise` and
its disposable CI stack. Never reset hosted dev/prod or run tests against them.

| Boundary | Files |
|---|---|
| Caller | Create `ops/email-dispatch/dispatch.mjs`, `dispatch.test.mjs`, `.env.example`, `README.md`, `Dockerfile`, `railway.toml` |
| Retirement | CLI-generated `retire_database_email_dispatch` migration; replace obsolete cases in `backend/tests/rls/test_email_scheduler.py` |
| Upgrade | Create `backend/tests/migrations/email_scheduler_upgrade_check.py`; modify `email_upgrade_check.py` and `backend/tests/conftest.py` |
| Real HTTP integration | Create `backend/tests/unit/test_email_caller.py`; reuse real route/dispatcher and controlled dependencies from `test_email_routes.py` |
| CI | Modify `.github/workflows/ci.yml`; retire `backend/tests/migrations/email_network_guard_check.sql` and `backend/tests/support/email_callback.py` only after reference audit |
| Documentation | ARCHITECTURE, DATABASE, SECURITY, DEPLOYMENT, TESTING, TECH_STACK, ADR 0005, original email spec/plan, replacement spec/plan and IMPLEMENTATION_STATUS |

### Task 1: Implement the bounded caller using test-first local HTTP checks

**Files:** New `ops/email-dispatch/dispatch.mjs`, `dispatch.test.mjs`.

**Interfaces:**

```js
// readConfig throws a fixed configuration error, never one carrying env values.
// Disabled mode returns only { enabled: false }.
readConfig(env) // => { enabled: true, origin: string, secret: string } | { enabled: false }
dispatchOnce(config, fetchImpl = globalThis.fetch)
// => { code: 'dispatch_ok', counts } | { code: 'dispatch_disabled' }
main(env = process.env) // => Promise<0 | 1 | 2>, writes one sanitized JSON line
```

- [ ] Detect existing worktree isolation and clean tracked state. Do not create another worktree. Use per-command safe.directory if needed, not global config changes.
- [ ] Write a node:test module with a real loopback HTTP server, request capture and deterministic server cleanup. Start with disabled/no-network and one-success cases. A minimal success expectation is:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { readConfig, dispatchOnce } from './dispatch.mjs';

test('disabled caller does not invoke transport', async () => {
  const result = await dispatchOnce(readConfig({}), () => {
    assert.fail('disabled mode attempted a request');
  });
  assert.deepEqual(result, { code: 'dispatch_disabled' });
});

test('accepted retry outcomes belong to the backend', async () => {
  const config = readConfig({
    WRITEWISE_EMAIL_SCHEDULER_ENABLED: 'true',
    WRITEWISE_BACKEND_ORIGIN: 'https://backend.example.test',
    EMAIL_DISPATCH_SECRET: 'synthetic-dispatch-secret-0123456789',
  });
  const result = await dispatchOnce(config, async (url, request) => {
    assert.equal(url, 'https://backend.example.test/api/internal/dispatch-emails');
    assert.equal(request.method, 'POST');
    assert.equal(request.redirect, 'manual');
    assert.equal(request.body, '{}');
    assert.equal(request.headers['X-Dispatch-Secret'], config.secret);
    return new Response(JSON.stringify({claimed: 1, sent: 0, retried: 1, failed: 0, skipped: 0}));
  });
  assert.equal(result.code, 'dispatch_ok');
  assert.equal(result.counts.retried, 1);
});
```

- [ ] From repo root run `node --test ops/email-dispatch/dispatch.test.mjs`. Observe absent caller exports/module failure before implementation; after exports exist, require behavior failures for each new validation boundary.
- [ ] Implement strict booleans for both flags, disabled mode before enabled-config requirements, origin validation with URL plus raw whitespace/control checks, and secret length/ASCII validation. Reject userinfo, non-root paths, queries/fragments, remote HTTP and nonliteral localhost names. HTTP loopback requires explicit `WRITEWISE_ALLOW_LOCALHOST=true`. Normalize one trailing slash away.
- [ ] Add and run literal table-driven negative cases: invalid booleans; missing/short/whitespace/control secret; credentials/path/query/fragment in origin; HTTP remote; HTTP loopback without opt-in; malformed URL. Verify no request for every configuration failure.
- [ ] Implement one POST with `{}`, Content-Type JSON, X-Dispatch-Secret and `redirect:'manual'`. Use one AbortSignal.timeout(30000) for the request and response stream. Accumulate Uint8Array chunks only while total <=16384; cancel the reader on overflow/abort and release its lock in finally. Do not read `response.text()` unbounded. Validate the parsed response with this predicate:

```js
const keys = ['claimed', 'sent', 'retried', 'failed', 'skipped'];
const valid = value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length
  && keys.every(k => Number.isSafeInteger(value[k]) && value[k] >= 0)
  && value.claimed <= 10
  && value.sent + value.retried + value.failed + value.skipped <= value.claimed;
```

- [ ] Add real-server cases for correct path/header/body, 302 redirect to a second listener (second listener must receive zero requests), 401/503/500, malformed JSON, 16384/16385-byte boundaries, too-large streamed chunks and a stalled response. Keep the real production 30-second deadline; one actual timeout test is appropriate. Close accepted sockets and server handles in finally so node:test exits.
- [ ] Add invalid count fixtures: null/array, extra/missing key, booleans, strings, negative/fractional/unsafe integers, claimed 11 and outcomes exceeding claimed. Accept zero counts and acknowledged sums below claimed.
- [ ] Map exceptions only to fixed caller codes (`dispatch_configuration`, `dispatch_timeout`, `dispatch_network`, `dispatch_http`, `dispatch_response`). main returns 2 for config, 1 for other failure, 0 for valid backend counts/disabled. Print only code plus validated counts. Never include caught exception text or status bodies. Capture CLI stdout/stderr using child_process.spawn with synthetic sentinel secrets/URLs/address payloads; assert no sentinel leak for success or failure.
- [ ] Use `pathToFileURL(process.argv[1]).href === import.meta.url` guarded for absent argv[1] to distinguish CLI execution from imports; set process.exitCode from awaited main. Verify importing alone produces no output or requests.
- [ ] Run the complete Node suite, review results and commit `feat: add bounded external email dispatch caller`.

### Task 2: Retire only the database email trigger and update the SQL boundary

**Files:** New CLI-generated migration; `backend/tests/rls/test_email_scheduler.py`, `backend/tests/conftest.py`, `backend/tests/migrations/email_upgrade_check.py`, `.github/workflows/ci.yml`.

**Interfaces:** Old helper/job absent after migration; deadline job remains exactly
`*/15 * * * *` / `select writewise_internal.enqueue_time_based_notifications();`.
Public queue RPC signatures and data remain unchanged.

- [ ] Write real SQL red assertions before creating the migration:

```python
def test_database_email_timer_is_retired():
    assert db_value("select count(*) from cron.job where jobname='writewise-email-dispatch'") == 0
    assert db_value("select to_regprocedure('writewise_internal.request_email_dispatch()')") is None

def test_deadline_timer_is_preserved():
    assert db_value("select count(*) from cron.job where jobname='writewise-deadline-notifications' "
                    "and schedule='*/15 * * * *' "
                    "and command='select writewise_internal.enqueue_time_based_notifications();'") == 1
```

- [ ] Keep Vault actual-role denial checks. Replace direct net SELECT/EXECUTE-denial expectations and synthetic callback tests with actual Data API exposure tests. Use both anon-key anonymous and `family['parent_client'].auth.get_session().access_token` requests; GET `http_request_queue` with Accept-Profile `net`, and `decrypted_secrets` with Accept-Profile `vault`, must be rejected with PostgREST's unexposed-schema response. Run against the real stack; never use the service role to prove browser access denial. Check anon/authenticated remain NOLOGIN and all existing queue/RLS tests stay.
- [ ] Run new retirement assertions on the old migrated stack and record their expected failure. If Docker remains absent, push the red-test checkpoint on the already authorized feature branch for disposable CI; never substitute hosted dev or hand-generated contracts.
- [ ] Discover CLI commands before invoking them. Use the repo-pinned CLI 2.115.0 through its installed path or `npm.cmd exec --yes --package=supabase@2.115.0 -- supabase --help`, then `migration --help` and `migration new --help`. Run `migration new retire_database_email_dispatch` from the feature worktree; record the actual returned path. Write this SQL to that file:

```sql
do $$
declare target_job bigint;
begin
  for target_job in
    select jobid from cron.job where jobname = 'writewise-email-dispatch'
  loop
    perform cron.unschedule(target_job);
  end loop;
end;
$$;

drop function if exists writewise_internal.request_email_dispatch();
```

- [ ] In the same implementation checkpoint remove the CI owner-replay step and synthetic callback start/stop steps: the helper no longer exists after replay. Remove fixture pausing of the retired email job, retaining only deadline pause/restore. Update `email_upgrade_check.verify_scheduler` to expect only the unchanged deadline job and assert `to_regprocedure` is null; remove privilege checks on a nonexistent function.
- [ ] Audit references with `rg -n 'email_callback|email_network_guard_check|request_email_dispatch|writewise-email-dispatch' backend .github docs supabase`. Delete obsolete callback/guard test support only when no active code references remain. Preserve historical SQL migration bodies and historical documentation. Do not add net/Vault exposure or remove provider-lock/idempotency tests.
- [ ] On disposable CI/localhost replay the full migration chain, run retirement/API-boundary/RLS modules, regenerate actual public database/API types and inspect zero drift or commit actual generated output. Commit migration and actual contract evidence together as `fix: retire unsupported database email dispatch timer`.

### Task 3: Prove existing email data survives retirement

**Files:** New `backend/tests/migrations/email_scheduler_upgrade_check.py`; `.github/workflows/ci.yml`; existing upgrade proof scheduler expectations from Task 2.

**Interfaces:** CLI `prepare --manifest PATH` / `verify --manifest PATH`, requiring
ENVIRONMENT=test and localhost API/DB URLs before imports or I/O. Manifest holds
synthetic fixture identities only and is never printed/uploaded as an artifact.

- [ ] Build on `email_upgrade_check.py` and its cleanup/snapshot helpers without refactoring unrelated proofs. Prepare at actual migration version `20261103132241`. Seed synthetic teacher/parent/linked student/activity and notification records using existing fixture patterns. Seed valid pending, sent, skipped and attempted-retry outbox rows; teacher/parent preference true/false; read/unread notices; and one unrelated cron job (`writewise-email-retirement-proof`, command `select 1`, inactive). Use only synthetic Vault values if needed to establish inert prior configuration; do not select decrypted values into the manifest.
- [ ] Snapshot business/outbox/preference/notice/receipt rows as canonical JSON, plus the original deadline/unrelated job schedule/command/active state. Record generated object IDs for deterministic cleanup. Pause only relevant wall-clock jobs while capturing; do not change expected persisted active state silently.
- [ ] Verify red behavior before the new migration: assert no old job/helper, snapshot equivalence and preserved deadline/unrelated job metadata. The retirement assertions must fail on the old schema.
- [ ] Add the fifth CI prepare/upgrade/verify sequence after the existing four:

```bash
supabase db reset --local --version 20261103132241
cd backend
uv run python tests/migrations/email_scheduler_upgrade_check.py prepare --manifest /tmp/email-scheduler-upgrade.json
cd ..
supabase migration up --local
cd backend
uv run python tests/migrations/email_scheduler_upgrade_check.py verify --manifest /tmp/email-scheduler-upgrade.json
cd ..
supabase db reset --local
```

- [ ] Verify SQL metadata equivalence except the explicitly retired job/helper. Prove unrelated job and extensions survive. Verify browser profile denial and actual queue grants without platform-owner replay. Clean up synthetic users/rows/job/Vault entries in finally; never print credentials or addresses.
- [ ] Execute all five upgrade proofs and full pytest on the ephemeral stack. Generate database types from that actual schema again; retain advisor/type-drift/teardown gates. Commit `test: preserve email state across scheduler retirement`.

### Task 4: Exercise the real endpoint and package the one-shot timer

**Files:** New `backend/tests/unit/test_email_caller.py`, `ops/email-dispatch/Dockerfile`, `railway.toml`, `.env.example`, README; `.github/workflows/ci.yml`.

**Interfaces:** Container entrypoint `node dispatch.mjs`; root `ops/email-dispatch`;
caller-to-backend HTTP contract unchanged. No dependency/API-type changes.

- [ ] Write a backend test that runs the actual mounted router from `app.main.app` on a bound ephemeral loopback socket using Uvicorn in a background thread, with `lifespan='off'` only in this test. Use pytest monkeypatch/dependency overrides, restored in finally, to set synthetic dispatch enable/secret and controlled queue/provider resources. Reuse route-test patterns; do not contact Resend or import model artifacts for this test.
- [ ] Spawn the actual Node CLI with a minimal explicit environment containing synthetic caller origin/secret and localhost opt-in. Verify valid counts and exit 0, wrong secret 401/exit 1, backend disabled 503/exit 1, and no queue/provider access for unauthorized/disabled calls. Assert sentinel secret/address/body values are absent in captured stdout/stderr. Stop server/thread/socket in finally. This test depends on ephemeral backend test setup and should run in CI, not against hosted env defaults.
- [ ] Add complete Node tests to CI after Node setup: `node --test ops/email-dispatch/dispatch.test.mjs`. Keep frontend lint/type checks, backend full pytest, all five upgrade proofs, generated contracts and advisors.
- [ ] Add a minimal isolated image and configuration:

```dockerfile
FROM node:24-slim
WORKDIR /app
COPY --chown=node:node dispatch.mjs ./dispatch.mjs
USER node
ENV WRITEWISE_EMAIL_SCHEDULER_ENABLED=false WRITEWISE_ALLOW_LOCALHOST=false
CMD ["node", "dispatch.mjs"]
```

```toml
[build]
builder = "DOCKERFILE"
dockerfilePath = "Dockerfile"

[deploy]
startCommand = "node dispatch.mjs"
cronSchedule = "*/5 * * * *"
restartPolicyType = "NEVER"
```

- [ ] Include only four caller settings in `.env.example`; empty origin/secret, both flags false. The repo ignores `.env*`, so stage this specific example using `git add -f -- ops/email-dispatch/.env.example`, never broadly force-add env files.
- [ ] README states service root, no backend model/key dependencies, private env configuration, expected exits/counts, no retries, no inbound port/healthcheck, and a local disabled invocation `node ops/email-dispatch/dispatch.mjs`. Explain the script does not automatically read `.env.example` or backend `.env`.
- [ ] On CI's Docker runner build `docker build -t writewise-email-caller:ci ops/email-dispatch` and run `docker run --rm writewise-email-caller:ci`. Require fixed disabled output/exit 0. Do not publish an image or start a paid service. Railway restart NEVER is intentional: backend owns retries, not the hosting restart policy.
- [ ] Run Node suite, real-route integration and full ephemeral pytest; review transport/privacy behavior. Commit `feat: package Railway email timer with endpoint checks`.

### Task 5: Promote final contracts and finish PR verification

**Files:** `docs/ARCHITECTURE.md`, `DATABASE.md`, `SECURITY.md`, `DEPLOYMENT.md`, `TESTING.md`, `TECH_STACK.md`, `docs/adr/0005-transactional-notifications-and-scheduling.md`, original/replacement email specs/plans and `IMPLEMENTATION_STATUS.md`.

- [ ] Document exact four caller settings; distinguish them from existing backend settings. Describe external secret storage, strict origin validation, one-request bounds and current exit codes. Remove unsupported owner-provisioning from current operational instructions while retaining dated historical evidence.
- [ ] Document new migration retirement/rollout, dormant Vault-entry cleanup without value inspection, queue-scope review, secret rotation if any live value was exposed, preservation of deadline jobs/extensions and pause/rollback without restoring pg_net HTTP.
- [ ] Record caller CI, container execution and real-route synthetic tests as code evidence only. Keep existing Return/opt-out/no-replay inbox evidence and user-skipped due-soon accurate. No new test failure/race/accessibility sign-off is inferred. No claim of hosted timer/inbox/production activation is allowed.
- [ ] Verify required scoped checks using the installed Windows fallbacks if uv cache/npx.ps1 is blocked:

```powershell
# feature worktree/backend
..\.venv\Scripts\ruff.exe check .
# feature worktree/frontend
node node_modules/eslint/bin/eslint.js .
node node_modules/typescript/bin/tsc --noEmit --incremental false
# feature worktree root
node --test ops/email-dispatch/dispatch.test.mjs
git diff --check
```

- [ ] Apply requesting-code-review and verification-before-completion. Resolve material findings; rerun affected checks only. Publish checkpoints only to the already authorized origin/feature branch; no force push, merge, hosted migration or deployment. Require fresh final-head CI with all five upgrade proofs/full pytest/contracts/advisors and capture its exact URL/SHA.
- [ ] Update draft PR #9 around the final implementation and actual validation, including unperformed operations/manual gates. Preserve the worktree/env files. Whether to mark ready/merge must reflect current acceptance evidence and the user's integration decision; code success does not activate email.

## Coverage and execution record

Task 1 covers all caller configuration/transport/privacy/budget semantics.
Task 2 removes the unsupported path and proves the replacement security boundary.
Task 3 covers in-place upgrade/data/job safety. Task 4 covers actual endpoint
authentication/enable behavior and deployable one-shot packaging. Task 5 promotes
contracts and records current evidence without closing skipped/hosted gates.

Planning self-review: exact file paths and exported interfaces are consistent;
the migration path is intentionally CLI-allocated at execution, not fabricated.
No SDK/framework/dependency or frontend test suite is added. All checkboxes start
unchecked. Record actual red/green commands, generated migration filename,
CI SHAs/results and remaining operational gates here during execution. Planning
does not change schema/application behavior or enable delivery.

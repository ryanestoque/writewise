# Slice 4 email scheduler replacement

**Date:** 2026-11-12. **Status:** Written specification approved by the user on
2026-11-12. Implementation planning follows; application/database implementation
remains pending. Work continues on `feat/phase3-email-notifications`, PR #9.

## Problem and evidence

All six original email migrations are recorded applied on dev, but the hosted
platform retains net schema usage, request/response reads and network function
execution for application roles. The current helper correctly refuses to put a
dispatch secret into that network queue. Supabase documents per-project changes
to these managed grants as unsupported. Disposable CI's owner replay is not a
supported hosted deployment procedure.

The real Return/outbox/provider path, inbox receipt, opt-out, no replay and
expired-event suppression passed user-assisted QA. Fresh queued due-soon
delivery was explicitly skipped. No hosted scheduler or mounted dispatch-route
live verification is claimed. The backend is currently localhost-only for QA.

## Decision and alternatives

Use a Railway scheduled service that makes one authenticated HTTP request to the
existing backend endpoint and exits. This fits the planned Railway backend
hosting and avoids storing its authorization header in pg_net. A Node 24 caller
uses built-in fetch, AbortSignal and node:test, with no new npm dependencies,
workspace tooling or dependency upgrades.

GitHub scheduled Actions were considered: they use the default branch and can
be delayed or dropped. A local scheduled task was considered: it depends on the
developer's PC remaining available. Manual invocation remains a development
check, not evidence of hosted automatic scheduling.

## Components and flow

1. Existing notification transactions enqueue Return/due-soon outbox rows.
2. The existing 15-minute database deadline sweep continues unchanged.
3. Railway starts an HTTP-only caller every five minutes (`*/5 * * * *`).
4. The caller POSTs `{}` to `/api/internal/dispatch-emails` on the configured
   backend origin, supplying `X-Dispatch-Secret` in the header.
5. FastAPI retains all existing authentication, enabled-state, claim,
   eligibility, authorization, template, idempotency, retry and finalization work.
6. The caller validates and reports sanitized aggregate counts, then exits.

Railway's timer launches a separate short process; it does not start another
FastAPI worker, import Python application code, load TensorFlow, perform CV/CNN
work or directly access Supabase/Resend. It is an HTTP trigger, not a second
scoring service or an email queue worker.

## Caller contract

Files: `ops/email-dispatch/dispatch.mjs`, `dispatch.test.mjs`, `Dockerfile`,
`railway.toml`, `.env.example` and `README.md`. The service root is
`ops/email-dispatch`; its container copies only caller files. No package install
or lockfile is necessary because there are no npm dependencies. Pin the runtime
to Node 24 in the container, matching the repository's existing Node major.

Environment:

| Variable | Contract |
|---|---|
| `WRITEWISE_EMAIL_SCHEDULER_ENABLED` | Defaults false; accept only `true` or `false`. Disabled exits successfully without network access. |
| `WRITEWISE_BACKEND_ORIGIN` | Plain canonical HTTPS origin, no credentials, non-root path, query or fragment. |
| `EMAIL_DISPATCH_SECRET` | Same private backend secret; at least 32 non-whitespace printable ASCII characters. |
| `WRITEWISE_ALLOW_LOCALHOST` | Defaults false; explicitly true allows HTTP only for literal localhost/127.0.0.1/::1 during local testing. |

The caller reads process environment only; it does not load the backend's .env
or receive Supabase keys, Resend keys, model configuration or user-selected
recipients. Backend environment and service-role/Resend keys stay backend-only.
Do not repurpose a NEXT_PUBLIC variable for the dispatch secret.

Export `readConfig(env)`, `dispatchOnce(config, fetchImpl = globalThis.fetch)`
and `main(env = process.env)` so transport/configuration can be exercised without
an external service. Direct execution calls main once. Importing the module
must not send a request.

- One request per invocation, no automatic HTTP retries, redirect following,
  background loop or caller-selected event/recipient/body fields.
- A single 30-second AbortSignal covers fetch and bounded response reading.
  Read at most 16 KiB, cancelling an oversized response stream.
- A valid success is HTTP 200 and a JSON object containing exactly `claimed`,
  `sent`, `retried`, `failed`, `skipped`, each a nonnegative safe integer.
  Claimed must be at most 10; the sum of the four outcome counts must not exceed
  claimed. Acknowledged database outcomes can sum to less than claimed.
- A valid response exits 0, even when the backend reports retried/failed rows:
  retry policy belongs to the backend. Disabled mode also exits 0.
- Invalid enabled configuration exits 2 without network access. Network/timeout,
  redirects, non-200 status, oversized/malformed or invalid success exits 1.
- Print only fixed allowlisted outcome codes and validated aggregate counts.
  Never print configuration values, request headers, response bodies, exception
  messages, URLs, addresses, provider IDs or secrets. Do not trace requests.
- Do not add application-level rate limiting or a spending cap. Existing
  backend invocation/send bounds remain authoritative.

## Retire the obsolete database trigger

Create a new versioned migration using the installed Supabase CLI's discovered
`migration new` command; never edit the six applied email migrations or invent a
timestamp. The migration unschedules every job named exactly
`writewise-email-dispatch`, then drops exactly
`writewise_internal.request_email_dispatch()` without CASCADE.

It leaves the deadline job and unrelated cron jobs, pg_cron, pg_net, Vault,
managed grants, tables, receipt identities, read state, preferences, outbox rows,
attempts and payload fingerprints unchanged. Do not delete historical queue
rows, replay terminal messages, drop shared extensions, or attempt owner-role
escalation. Unexpected helper dependencies must fail visibly for inspection.

Existing Vault entries, if any, become unused; do not read or delete their
values in the migration. Document their removal through an authorized private
settings workflow after confirming no other consumer. If a live dispatch secret
was ever placed in a network queue, rotate it privately before activation.

The old helper and its guard are retired together because the secret-bearing
network path is removed. This is not weakening that guard while retaining the
path. Existing business authorization, service-only RPC grants, RLS, canonical
Auth lookup and bounded recovery remain unchanged.

## Verification and CI changes

Keep every existing outbox, eligibility, lease, provider, dispatcher, route,
privacy and unrelated notification test. Replace obsolete pg_net-callback and
owner-provisioning tests with behavior for the new boundary:

- Node tests use a loopback HTTP server and controlled transport; prove disabled
  and import modes send nothing, correct endpoint/header/empty body, timeout and
  size limits, no redirect/retry, strict counts, fixed exits and sanitized output.
  Patch realistic failures with sentinel credentials and assert no output leak.
- Real SQL tests prove no old email job/helper, preserved deadline/unrelated jobs
  and business data, denied application access to the removed helper, unchanged
  service-only queue RPCs and preserved Vault protections.
- Stop treating platform-default direct net object denial as a hosted
  prerequisite. Exercise the actual anon/authenticated Data API boundary instead:
  net/Vault are unexposed and cannot be selected through an API schema profile.
  Do not claim object-level denial when a platform-default privilege exists.
- Remove CI's owner replay and old synthetic pg_net callback service. Do not
  remove the existing no-database-lock-during-provider tests or provider mocks.
- Keep all four existing legacy upgrade proofs with their final scheduler
  expectations adjusted to the retired path. Add a fifth upgrade proof seeded
  at the actual last original email migration (`20261103132241`) to demonstrate
  that retiring a configured old job preserves pending/sent/skipped rows,
  attempt metadata, preferences, read state and unrelated jobs.
- Run caller tests in CI using existing Node 24. Exercise the caller against the
  real mounted FastAPI endpoint with synthetic authorization/queue/provider
  dependencies; automated checks must not contact Resend.
- Generate actual API/database contracts and verify drift. The private function
  drop may produce no public type diff; record successful regeneration instead
  of hand-editing types. Preserve advisors, full ephemeral pytest and teardown.

Promote the resulting contract to ARCHITECTURE, DATABASE, SECURITY, DEPLOYMENT,
TESTING, TECH_STACK, ADR 0005, the original email spec/plan and implementation
tracker. Preserve dated historical evidence and the skipped due-soon result.

## Local checks and activation boundaries

Current authorization covers development and the previously designated inbox,
not live delivery to the other recipients in shared dev. The normal dispatcher
has no recipient filter. Use controlled queue/provider dependencies for local
caller-to-route tests; do not enable it against an unreviewed shared queue or
ship the scratch one-recipient adapter as product behavior.

A hosted timer cannot reach this PC's localhost. Later activation requires a
reachable, correct-environment backend and privately configured matching secret,
an explicitly reviewed recipient/queue scope, sender/domain/tracking checks,
and separate deployment approval. Do not add a tunnel or paid dev service as an
unrequested workaround. Railway access retains the existing two-key-holder
policy. No platform provisioning or production change is authorized by this
design alone.

Deployment order: deliver code and retirement migration with dispatch disabled;
verify retirement and preserved deadline scheduling; configure a disabled caller
for the intended hosted backend; validate its environment and recipient scope;
enable backend/caller only for the designated live smoke, verify provider and
inbox outcomes, then review ongoing activation. Preserve the single Uvicorn
worker. Pausing disables the caller and backend dispatch; never restore the old
pg_net secret path as rollback. Pending rows remain durable.

Code/CI verification, migration rollout, platform configuration, actual timer
execution and inbox receipt are separate gates. The implementation can be ready
for review with hosted activation explicitly outstanding; it must not be called
deployed or fully verified merely because a timer file exists. User-skipped
fresh due-soon delivery remains unverified unless separately completed or the
acceptance requirement is explicitly revised.

## Sources checked 2026-11-12

- [Supabase managed pg_net grant limitation](https://supabase.com/kb/troubleshooting/revoking-access-to-pg_net-objects-has-no-effect-0bbc16).
- [Railway cron jobs](https://docs.railway.com/cron-jobs): short-lived tasks, five-minute minimum and no guaranteed minute precision.
- [Railway config reference](https://docs.railway.com/config-as-code/reference).
- [GitHub scheduled workflows](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

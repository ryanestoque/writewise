# ADR 0005 — Transactional notifications and scheduled deadline checks

**Date:** 2026-11-03. **Status:** Implemented on the Slice 3 feature branch; verification/deployment are recorded separately in `IMPLEMENTATION_STATUS.md`.

## Context

Assignment, Return, rejection, release, and successful resubmission need durable alerts across teacher and parent accounts. Deadline events must run when nobody has a portal open. Repeated requests/jobs must not duplicate alerts, including after a successful retry is deleted. Existing coursework writes already use service-only transactional Postgres functions.

## Decision

Insert event notifications inside those existing functions, after their authorization/state checks. A private insertion helper claims `writewise_internal.notification_delivery.dedupe_key` and inserts the public notification in one transaction. Receipts reference recipient/activity/student and survive submission deletion; both tables cascade when their owners are deleted. Notification rows hold identifiers and timestamps only. Recipient-only RLS permits browser SELECT; FastAPI authorizes read-state mutations and service-only RPCs recheck ownership.

Explicit assignment edits compare targets using one frozen roster ID/section snapshot. Metadata edits, roster changes, and new parent links do not independently emit assignment events. A private assignment helper accepts that snapshot, or uses current roster membership for scheduled checks. It does not depend on a browser JWT, unlike the public caller-scoped assignment helper.

One named pg_cron job calls a private SQL sweep every 15 minutes. It uses current assignments, unarchived activities, effective per-student deadlines, and the existing active-attempt view. Activity-first locks align it with coursework writes. Deadline keys use exact UTC epoch microseconds; changed instants re-arm reminders, while returning to an already-delivered instant does not repeat them.

TanStack Query polls the bell every 60 seconds in foreground. Cursor pagination retains the loaded window and reconciles server state after Load more; pagination and polling are serialized. Read mutations verify the exact access token they submit and are canceled on account changes. Parent URLs identify a child, activity, and optional exact attempt, with current RLS/release checks at the destination.

## Consequences

An insertion failure rolls back its coursework state change. Database-only deadline checks need no new service/worker, and the CV/CNN pipeline keeps its in-process execution contract. Private receipt storage grows with delivered events until recipient/activity/student cleanup; pilot-scale usage does not require an additional retention subsystem. Email/outbox/preferences, points/excused work, and comments remain their later slices. Slice 5 must add excused suppression when its schema arrives.

Rejected alternatives: independent Python inserts after RPC commit would permit partial delivery; generic triggers on assignment rows would confuse target replacement and overlapping targets; Realtime is unnecessary for the initial bell latency requirement. See the [Slice 3 design](../superpowers/specs/2026-11-02-phase3-in-app-notifications-design.md).

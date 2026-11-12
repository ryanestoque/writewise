"""Local-only upgrade proof for retiring the secret-bearing database timer."""

import argparse
import asyncio
import json
import os
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse
from uuid import UUID, uuid4


def require_local_test():
    if os.environ.get("ENVIRONMENT") != "test" or any(
        urlparse(os.environ.get(key, "")).hostname not in {"localhost", "127.0.0.1", "::1"}
        for key in ("SUPABASE_URL", "SUPABASE_DB_URL")
    ):
        raise SystemExit("Scheduler upgrade proof requires test mode and localhost URLs")


async def snapshot(manifest):
    import asyncpg

    c = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
    try:
        result = {}
        for name, query, args in (
            (
                "outbox",
                "select coalesce(jsonb_agg(to_jsonb(q) order by q.id),'[]') "
                "from public.email_outbox q join public.notification n on n.id=q.notification_id "
                "where n.activity_id=$1",
                [UUID(manifest["activity"])],
            ),
            (
                "preferences",
                "select jsonb_build_object('teacher',"
                "(select email_notifications from public.teacher where id=$1),'parent',"
                "(select email_notifications from public.parent where id=$2))",
                [UUID(x["id"]) for x in manifest["users"]],
            ),
            (
                "jobs",
                "select jsonb_agg(to_jsonb(j) order by jobname) from "
                "(select jobname,schedule,command,active from cron.job where jobname in "
                "('writewise-deadline-notifications','writewise-email-retirement-proof')) j",
                [],
            ),
            (
                "extensions",
                "select jsonb_agg(to_jsonb(e) order by extname) from "
                "(select extname,extversion,extnamespace::regnamespace::text as schema "
                "from pg_extension where extname in ('pg_cron','pg_net','supabase_vault')) e",
                [],
            ),
            (
                "vault_entries",
                "select coalesce(jsonb_agg(to_jsonb(v) order by name),'[]') "
                "from (select id,name from vault.secrets where name in "
                "('writewise_backend_url','writewise_email_dispatch_secret')) v",
                [],
            ),
            (
                "queue_grants",
                "select jsonb_agg(to_jsonb(p) order by signature) from "
                "(select oid::regprocedure::text as signature,proacl::text as acl "
                "from pg_proc where pronamespace='public'::regnamespace and proname in "
                "('claim_email_delivery','prepare_email_delivery',"
                "'authorize_email_delivery','finish_email_delivery')) p",
                [],
            ),
        ):
            result[name] = json.loads(await c.fetchval(query, *args))
        return result
    finally:
        await c.close()


async def seed_queue_and_jobs(manifest):
    import asyncpg

    c = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
    try:
        assert (
            await c.fetchval(
                "select count(*) from cron.job where jobname='writewise-email-dispatch'"
            )
            == 1
        )
        await c.execute(
            "select cron.alter_job(jobid,active:=false) from cron.job "
            "where jobname='writewise-email-dispatch'"
        )
        manifest["unrelated_job"] = await c.fetchval(
            "select cron.schedule('writewise-email-retirement-proof','*/7 * * * *','select 1')"
        )
        await c.execute(
            "select cron.alter_job($1::bigint,active:=false)", manifest["unrelated_job"]
        )
        manifest["vault_ids"] = []
        for value, name in (
            ("http://127.0.0.1:1", "writewise_backend_url"),
            ("synthetic-retirement-secret-0123456789", "writewise_email_dispatch_secret"),
        ):
            manifest["vault_ids"].append(
                str(await c.fetchval("select vault.create_secret($1,$2)", value, name))
            )
        activity, student = UUID(manifest["activity"]), UUID(manifest["student"])
        for _ in range(2):
            returned = uuid4()
            await c.execute(
                "insert into public.submission (id,student_id,activity_id,status,image_path,"
                "uploader_id,uploader_role,created_at,returned_at,returned_by,"
                "return_reason,return_note) "
                "select $1,student_id,activity_id,status,$2,uploader_id,uploader_role,created_at,"
                "returned_at,returned_by,return_reason,return_note "
                "from public.submission where id=$3",
                returned,
                f"{student}/{returned}.jpg",
                UUID(manifest["submissions"][0]),
            )
            manifest["submissions"].append(str(returned))
            await c.fetchval(
                "select writewise_internal.notify_work_parents('submission_returned',$1,$2,$3,$4)",
                activity,
                student,
                returned,
                str(returned),
            )
        rows = await c.fetch(
            "select q.id from public.email_outbox q join public.notification n "
            "on n.id=q.notification_id where n.activity_id=$1 order by q.created_at,q.id",
            activity,
        )
        assert len(rows) == 4
        await c.execute(
            "update public.email_outbox set status='sent',attempts=1,"
            "first_attempt_at=now()-interval '5 minutes',payload_sha256=repeat('a',64),"
            "provider_message_id='synthetic-provider-id',sent_at=now() where id=$1",
            rows[0]["id"],
        )
        await c.execute(
            "update public.email_outbox set status='skipped',last_error='preference_off' "
            "where id=$1",
            rows[1]["id"],
        )
        await c.execute(
            "update public.email_outbox set attempts=1,first_attempt_at=now()-interval '5 minutes',"
            "payload_sha256=repeat('b',64),last_error='provider_unavailable',"
            "next_attempt_at=now()+interval '15 minutes' where id=$1",
            rows[3]["id"],
        )
        await c.execute(
            "update public.teacher set email_notifications=false where id=$1",
            UUID(manifest["users"][0]["id"]),
        )
    finally:
        await c.close()


async def verify_retired():
    import asyncpg

    c = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
    try:
        assert (
            await c.fetchval(
                "select count(*) from cron.job where jobname='writewise-email-dispatch'"
            )
            == 0
        )
        assert (
            await c.fetchval(
                "select to_regprocedure('writewise_internal.request_email_dispatch()')"
            )
            is None
        )
    finally:
        await c.close()


async def cleanup_extras(manifest):
    import asyncpg

    c = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
    try:
        if manifest.get("unrelated_job") is not None:
            await c.execute("select cron.unschedule($1::bigint)", manifest["unrelated_job"])
        for identity in manifest.get("vault_ids", []):
            await c.execute("delete from vault.secrets where id=$1", UUID(identity))
    finally:
        await c.close()


def main():
    require_local_test()
    from email_upgrade_check import capture, cleanup
    from supabase import create_client

    parser = argparse.ArgumentParser()
    parser.add_argument("mode", choices=["prepare", "verify"])
    parser.add_argument("--manifest", type=Path, required=True)
    args = parser.parse_args()
    manifest = {}
    admin = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_ROLE_KEY"])
    phase = "prepare_historical_work" if args.mode == "prepare" else "load_manifest"
    success = False
    try:
        if args.mode == "prepare":
            subprocess.run(
                [
                    sys.executable,
                    str(Path(__file__).with_name("email_upgrade_check.py")),
                    "prepare",
                    "--manifest",
                    str(args.manifest),
                ],
                check=True,
            )
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        parent = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
        parent.auth.sign_in_with_password(
            {key: manifest["users"][1][key] for key in ("email", "password")}
        )
        if args.mode == "prepare":
            phase = "seed_email_states"
            asyncio.run(seed_queue_and_jobs(manifest))
            manifest["scheduler_before"] = asyncio.run(snapshot(manifest))
            manifest["business_before"] = capture(admin, parent, manifest)
            args.manifest.write_text(json.dumps(manifest), encoding="utf-8")
            success = True
            print("Scheduler retirement upgrade prepared using synthetic localhost records")
            return
        phase = "verify_retirement"
        asyncio.run(verify_retired())
        phase = "verify_preserved_state"
        assert asyncio.run(snapshot(manifest)) == manifest["scheduler_before"]
        assert capture(admin, parent, manifest) == manifest["business_before"]
        success = True
        print("Scheduler retirement upgrade verified: queue, work, preferences and jobs preserved")
    except Exception:
        raise SystemExit("Synthetic scheduler upgrade proof failed at " + phase) from None
    finally:
        if args.mode == "verify" or not success:
            if manifest:
                asyncio.run(cleanup_extras(manifest))
                cleanup(admin, manifest)


if __name__ == "__main__":
    main()

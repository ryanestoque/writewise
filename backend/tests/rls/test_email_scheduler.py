"""Actual cron/Vault/pg_net boundaries, using only a synthetic loopback listener."""

import asyncio
import json
import os

import asyncpg
import pytest

from tests.rls.notification_support import db_value

SECRET = "synthetic-email-dispatch-secret-00000001"


def test_one_private_email_job_without_embedded_configuration():
    assert (
        db_value(
            "select count(*) from cron.job where jobname='writewise-email-dispatch' "
            "and schedule='*/5 * * * *' "
            "and command='select writewise_internal.request_email_dispatch();'"
        )
        == 1
    )
    for role in ("anon", "authenticated", "service_role"):
        assert not db_value(
            "select has_function_privilege($1, "
            "'writewise_internal.request_email_dispatch()', 'EXECUTE')",
            role,
        )


def test_absent_vault_configuration_is_a_noop():
    assert db_value("select writewise_internal.request_email_dispatch()") is None


@pytest.mark.parametrize("role", ["anon", "authenticated"])
def test_browser_cannot_read_vault_or_network_queues_or_send(role):
    for table in ("vault.decrypted_secrets", "net.http_request_queue", "net._http_response"):
        assert not db_value("select has_table_privilege($1,$2,'SELECT')", role, table)
    assert not db_value("select has_schema_privilege($1,'vault','USAGE')", role)
    assert not db_value("select has_schema_privilege($1,'net','USAGE')", role)
    assert not db_value(
        "select exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace "
        "where n.nspname='net' and p.proname in ('http_get','http_post','http_delete') "
        "and has_function_privilege($1,p.oid,'EXECUTE'))",
        role,
    )


@pytest.mark.parametrize("role", ["anon", "authenticated"])
@pytest.mark.parametrize(
    "statement",
    [
        "select 1 from net.http_request_queue limit 0",
        "select 1 from net._http_response limit 0",
        "select 1 from vault.decrypted_secrets limit 0",
        "select net.http_post('http://127.0.0.1:8765/api/internal/dispatch-emails')",
    ],
)
def test_actual_browser_role_cannot_read_or_invoke_network(role, statement):
    async def exercise():
        connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        try:
            async with connection.transaction():
                await connection.execute(f"set local role {role}")
                with pytest.raises(asyncpg.InsufficientPrivilegeError):
                    async with connection.transaction():
                        await connection.execute(statement)
        finally:
            await connection.close()

    asyncio.run(exercise())


@pytest.fixture
def vault_config():
    ids = []

    def add(value, name):
        identity = db_value("select vault.create_secret($1,$2)", value, name)
        ids.append(identity)
        return identity

    try:
        yield add
    finally:
        for identity in ids:
            db_value("delete from vault.secrets where id=$1 returning id", identity)


@pytest.mark.parametrize(
    "origin",
    ["", "https://example.com/path", "http://example.com", "https://user:pass@example.com"],
)
def test_blank_noop_and_invalid_origin_are_value_free(vault_config, origin):
    vault_config(origin, "writewise_backend_url")
    vault_config(SECRET, "writewise_email_dispatch_secret")
    if not origin:
        assert db_value("select writewise_internal.request_email_dispatch()") is None
    else:
        with pytest.raises(asyncpg.InvalidParameterValueError) as caught:
            db_value("select writewise_internal.request_email_dispatch()")
        assert str(caught.value) == "Invalid email dispatch configuration"


def test_pg_net_callback_only_runs_after_commit_and_not_after_rollback(vault_config):
    vault_config("http://127.0.0.1:8765", "writewise_backend_url")
    vault_config(SECRET, "writewise_email_dispatch_secret")

    async def exercise():
        connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        try:

            async def response(request):
                async with asyncio.timeout(15):
                    while True:
                        row = await connection.fetchrow(
                            "select status_code,content,error_msg "
                            "from net._http_response where id=$1",
                            request,
                        )
                        if row:
                            assert row["status_code"] == 200 and row["error_msg"] is None
                            return json.loads(row["content"])
                        await asyncio.sleep(0.05)

            async def state():
                request = await connection.fetchval(
                    "select net.http_get('http://127.0.0.1:8765/state',timeout_milliseconds:=3000)"
                )
                return await response(request)

            before = await state()
            transaction = connection.transaction()
            await transaction.start()
            request = await connection.fetchval(
                "select writewise_internal.request_email_dispatch()"
            )
            assert request is not None
            await asyncio.sleep(0.2)
            assert not await connection.fetchval(
                "select exists(select 1 from net._http_response where id=$1)", request
            )
            await transaction.commit()
            assert await response(request) == dict.fromkeys(
                ("claimed", "sent", "retried", "failed", "skipped"), 0
            )
            after = await state()
            assert after == {
                "calls": before["calls"] + 1,
                "authenticated": True,
                "path_ok": True,
                "body_ok": True,
            }
            transaction = connection.transaction()
            await transaction.start()
            rolled_back = await connection.fetchval(
                "select writewise_internal.request_email_dispatch()"
            )
            await transaction.rollback()
            await asyncio.sleep(0.3)
            assert not await connection.fetchval(
                "select exists(select 1 from net._http_response where id=$1)", rolled_back
            )
            assert await state() == after
        finally:
            await connection.close()

    asyncio.run(exercise())


def test_vault_entry_names_are_unique(vault_config):
    vault_config(SECRET, "writewise_email_dispatch_secret")
    with pytest.raises(asyncpg.UniqueViolationError):
        vault_config(SECRET, "writewise_email_dispatch_secret")


def test_invalid_secret_is_value_free(vault_config):
    vault_config("http://127.0.0.1:8765", "writewise_backend_url")
    vault_config("short-synthetic-secret", "writewise_email_dispatch_secret")
    with pytest.raises(asyncpg.InvalidParameterValueError) as caught:
        db_value("select writewise_internal.request_email_dispatch()")
    assert str(caught.value) == "Invalid email dispatch configuration"


def test_named_schedule_replacement_never_duplicates_job():
    async def exercise():
        connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        transaction = connection.transaction()
        await transaction.start()
        try:
            await connection.fetchval(
                "select cron.schedule('writewise-email-dispatch','*/5 * * * *',"
                "'select writewise_internal.request_email_dispatch();')"
            )
            assert (
                await connection.fetchval(
                    "select count(*) from cron.job where jobname='writewise-email-dispatch'"
                )
                == 1
            )
        finally:
            await transaction.rollback()
            await connection.close()

    asyncio.run(exercise())

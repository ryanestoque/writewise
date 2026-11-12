"""Retired email timer, preserved deadline scheduling and real browser API boundary."""

import asyncio
import os

import asyncpg
import httpx
import pytest

from tests.rls.notification_support import db_value


def test_database_email_job_is_retired():
    assert db_value("select count(*) from cron.job where jobname='writewise-email-dispatch'") == 0


def test_database_email_helper_is_retired():
    assert db_value("select to_regprocedure('writewise_internal.request_email_dispatch()')") is None


@pytest.mark.parametrize("role", ["anon", "authenticated"])
@pytest.mark.parametrize(
    ("schema", "table"), [("net", "http_request_queue"), ("vault", "decrypted_secrets")]
)
def test_network_and_vault_are_unavailable_through_browser_data_api(family, role, schema, table):
    public_key = os.environ["SUPABASE_ANON_KEY"]
    token = (
        public_key if role == "anon" else family["parent_client"].auth.get_session().access_token
    )
    response = httpx.get(
        os.environ["SUPABASE_URL"].rstrip("/") + "/rest/v1/" + table,
        params={"select": "id", "limit": "1"},
        headers={
            "apikey": public_key,
            "Authorization": "Bearer " + token,
            "Accept-Profile": schema,
        },
        timeout=5.0,
    )
    assert response.status_code == 406
    assert response.json()["code"] == "PGRST106"


@pytest.mark.parametrize("role", ["anon", "authenticated"])
def test_browser_roles_cannot_open_direct_database_sessions(role):
    assert db_value("select rolcanlogin from pg_roles where rolname=$1", role) is False


def test_deadline_timer_is_preserved():
    assert (
        db_value(
            "select count(*) from cron.job where jobname='writewise-deadline-notifications' "
            "and schedule='*/15 * * * *' "
            "and command='select writewise_internal.enqueue_time_based_notifications();'"
        )
        == 1
    )


@pytest.mark.parametrize("role", ["anon", "authenticated"])
def test_browser_roles_still_cannot_read_vault(role):
    assert not db_value("select has_schema_privilege($1,'vault','USAGE')", role)
    assert not db_value("select has_table_privilege($1,'vault.decrypted_secrets','SELECT')", role)

    async def exercise():
        connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        try:
            async with connection.transaction():
                await connection.execute("set local role " + role)
                with pytest.raises(asyncpg.InsufficientPrivilegeError):
                    async with connection.transaction():
                        await connection.execute("select 1 from vault.decrypted_secrets limit 0")
        finally:
            await connection.close()

    asyncio.run(exercise())


@pytest.mark.parametrize("role", ["anon", "authenticated", "service_role"])
def test_removed_dispatch_helper_cannot_be_called(role):
    async def exercise():
        connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        try:
            async with connection.transaction():
                await connection.execute("set local role " + role)
                with pytest.raises(
                    (asyncpg.InsufficientPrivilegeError, asyncpg.UndefinedFunctionError)
                ):
                    async with connection.transaction():
                        await connection.execute(
                            "select writewise_internal.request_email_dispatch()"
                        )
        finally:
            await connection.close()

    asyncio.run(exercise())

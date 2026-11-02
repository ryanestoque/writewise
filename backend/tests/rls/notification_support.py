"""Local-stack SQL execution for private notification function tests."""

import asyncio
import os

import asyncpg


def db_value(query, *parameters):
    async def execute():
        connection = await asyncpg.connect(os.environ["SUPABASE_DB_URL"])
        try:
            return await connection.fetchval(query, *parameters)
        finally:
            await connection.close()

    return asyncio.run(execute())


async def wait_for_database_lock(observer, pid):
    """Synchronize on an observed PostgreSQL lock, not an assumed delay."""

    async def wait():
        while not await observer.fetchval(
            "select exists(select 1 from pg_stat_activity where pid=$1 and wait_event_type='Lock')",
            pid,
        ):
            await asyncio.sleep(0.01)

    await asyncio.wait_for(wait(), timeout=10)

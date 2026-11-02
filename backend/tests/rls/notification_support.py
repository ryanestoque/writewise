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

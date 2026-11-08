"""Caller-RLS coursework reads; no service-role client participates in this read path."""

from uuid import UUID

from fastapi import APIRouter, Depends, Response
from httpx import AsyncClient, Timeout

from app.api.deps import get_current_parent, get_current_teacher, get_current_user, security
from app.core.config import settings
from app.gradebook.contracts import ChildGradebook, SectionGradebook
from app.gradebook.csv_export import render_gradebook_csv
from app.gradebook.repository import read_error, read_gradebook_facts
from app.gradebook.service import assemble_child, assemble_section
from app.scoring.provider import get_score_provider

router = APIRouter()


async def get_gradebook_client(
    credentials=Depends(security), user=Depends(get_current_user),
):
    if not settings.SUPABASE_ANON_KEY:
        raise read_error()
    async with AsyncClient(
        base_url=settings.SUPABASE_URL.rstrip("/") + "/rest/v1/",
        headers={"apikey": settings.SUPABASE_ANON_KEY,
                 "Authorization": "Bearer " + credentials.credentials},
        timeout=Timeout(10.0),
    ) as caller_client:
        yield caller_client


async def _section_data(section_id: UUID, caller_client: AsyncClient) -> SectionGradebook:
    facts = await read_gradebook_facts(
        caller_client, "read_section_gradebook", {"target_section_id": str(section_id)}
    )
    try:
        return assemble_section(facts, get_score_provider())
    except (KeyError, ValueError, TypeError):
        raise read_error() from None


@router.get("/sections/{section_id}/gradebook", response_model=SectionGradebook)
async def section_gradebook(
    section_id: UUID, response: Response,
    teacher: dict = Depends(get_current_teacher),
    caller_client: AsyncClient = Depends(get_gradebook_client),
):
    response.headers["Cache-Control"] = "no-store"
    return await _section_data(section_id, caller_client)


@router.get("/sections/{section_id}/gradebook.csv")
async def section_gradebook_csv(
    section_id: UUID, teacher: dict = Depends(get_current_teacher),
    caller_client: AsyncClient = Depends(get_gradebook_client),
):
    book = await _section_data(section_id, caller_client)
    return Response(
        content=render_gradebook_csv(book), media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="gradebook-{section_id}.csv"',
                 "Cache-Control": "no-store"},
    )


@router.get("/students/{student_id}/gradebook", response_model=ChildGradebook)
async def child_gradebook(
    student_id: UUID, response: Response,
    parent: dict = Depends(get_current_parent),
    caller_client: AsyncClient = Depends(get_gradebook_client),
):
    facts = await read_gradebook_facts(
        caller_client, "read_child_gradebook", {"target_student_id": str(student_id)}
    )
    try:
        book = assemble_child(facts, get_score_provider())
    except (KeyError, ValueError, TypeError):
        raise read_error() from None
    response.headers["Cache-Control"] = "no-store"
    return book

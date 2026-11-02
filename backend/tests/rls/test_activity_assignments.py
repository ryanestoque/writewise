import os
from uuid import uuid4

import pytest
from postgrest.exceptions import APIError
from supabase import create_client

from app.core.supabase import supabase_client as admin


def assigned(client, activity, student):
    return (
        client.rpc(
            "is_assigned",
            {
                "target_activity_id": activity,
                "target_student_id": student,
            },
        )
        .execute()
        .data
    )


def test_section_and_direct_union_live_membership_and_roster(family, assigned_activity):
    activity = assigned_activity["id"]
    first, second, direct = family["students"]
    client = family["teacher_client"]
    assert assigned(client, activity, first) is True
    assert assigned(client, activity, second) is False
    assert assigned(client, activity, direct) is True
    try:
        admin.table("student").update({"section_id": family["sections"][1]}).eq(
            "id", first
        ).execute()
        assert assigned(client, activity, first) is False
        admin.table("teacher_student").delete().eq("teacher_id", family["teacher"]).eq(
            "student_id", direct
        ).execute()
        assert assigned(client, activity, direct) is False
    finally:
        admin.table("student").update({"section_id": family["sections"][0]}).eq(
            "id", first
        ).execute()
        admin.table("teacher_student").upsert(
            {"teacher_id": family["teacher"], "student_id": direct}
        ).execute()


def test_parent_activity_visibility_and_target_rows_do_not_leak_other_children(
    family, assigned_activity
):
    activity = assigned_activity["id"]
    own = family["parent_client"]
    other = family["other_parent_client"]
    assert own.table("activity").select("id").eq("id", activity).execute().data == [
        {"id": activity}
    ]
    rows = (
        own.table("activity_assignment")
        .select("section_id,student_id")
        .eq("activity_id", activity)
        .execute()
        .data
    )
    assert rows == [{"section_id": family["sections"][0], "student_id": None}]
    other_rows = (
        other.table("activity_assignment")
        .select("student_id")
        .eq("activity_id", activity)
        .execute()
        .data
    )
    assert other_rows == [{"student_id": family["students"][2]}]
    # Same teacher's unassigned sibling does not satisfy the child predicate.
    assert assigned(own, activity, family["students"][1]) is False
    assert assigned(own, activity, family["students"][2]) is False
    assert assigned(family["other_teacher_client"], activity, family["students"][0]) is False
    assert (
        not family["other_teacher_client"]
        .table("activity")
        .select("id")
        .eq("id", activity)
        .execute()
        .data
    )


def test_unassigned_parent_cannot_read_activity(family, assigned_activity):
    activity = assigned_activity["id"]
    admin.rpc(
        "update_assigned_activity",
        {
            "actor_id": family["teacher"],
            "target_activity_id": activity,
            "payload": {
                "assignments": [{"section_id": family["sections"][0]}],
                "is_take_home": False,
            },
        },
    ).execute()
    assert (
        not family["other_parent_client"]
        .table("activity")
        .select("id")
        .eq("id", activity)
        .execute()
        .data
    )
    # Assigned in-class metadata is intentionally visible to parents.
    assert family["parent_client"].table("activity").select("id").eq("id", activity).execute().data


def test_browser_cannot_mutate_targets_or_call_service_rpcs(family, assigned_activity):
    for client in (family["teacher_client"], family["parent_client"]):
        with pytest.raises(APIError):
            client.table("activity_assignment").insert(
                {
                    "activity_id": assigned_activity["id"],
                    "student_id": family["students"][0],
                }
            ).execute()
        with pytest.raises(APIError):
            client.rpc(
                "update_assigned_activity",
                {
                    "actor_id": family["teacher"],
                    "target_activity_id": assigned_activity["id"],
                    "payload": {"title": "Stolen"},
                },
            ).execute()
        with pytest.raises(APIError):
            client.rpc(
                "create_assigned_activity", {"actor_id": family["teacher"], "payload": {}}
            ).execute()
    anon = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_ANON_KEY"])
    with pytest.raises(APIError):
        assigned(anon, assigned_activity["id"], family["students"][0])
    with pytest.raises(APIError):
        anon.table("activity_assignment").select("id").execute()


def test_constraints_reject_zero_or_two_targets(family, assigned_activity):
    for target in [{}, {"section_id": family["sections"][0], "student_id": family["students"][0]}]:
        with pytest.raises(APIError):
            admin.table("activity_assignment").insert(
                {"activity_id": assigned_activity["id"], **target}
            ).execute()


def test_rpc_deduplicates_targets_and_failed_replacement_rolls_back(family, assigned_activity):
    activity = assigned_activity["id"]
    params = {"actor_id": family["teacher"], "target_activity_id": activity}
    target = {"student_id": family["students"][0]}
    result = (
        admin.rpc(
            "update_assigned_activity",
            {
                **params,
                "payload": {
                    "assignments": [target, target],
                    "due_at": "2026-11-02T12:00:00+08:00",
                },
            },
        )
        .execute()
        .data
    )
    assert len(result["assignments"]) == 1
    for targets in [[], [{"section_id": family["sections"][2]}], [{"student_id": str(uuid4())}]]:
        with pytest.raises(APIError) as caught:
            admin.rpc(
                "update_assigned_activity",
                {
                    **params,
                    "payload": {
                        "title": "Must roll back",
                        "due_at": None,
                        "assignments": targets,
                    },
                },
            ).execute()
        assert caught.value.code == "22023"
        after = admin.rpc("update_assigned_activity", {**params, "payload": {}}).execute().data
        assert after == result
    title = f"Failed create {uuid4()}"
    with pytest.raises(APIError):
        admin.rpc(
            "create_assigned_activity",
            {
                "actor_id": family["teacher"],
                "payload": {
                    "title": title,
                    "target_text": "words",
                    "assignments": [{"section_id": family["sections"][2]}],
                },
            },
        ).execute()
    assert not admin.table("activity").select("id").eq("title", title).execute().data

"""Read only gradebook fact RPCs through a request-scoped caller identity."""

import httpx
from fastapi import HTTPException

_PARAMETERS = {
    "read_section_gradebook": "target_section_id",
    "read_child_gradebook": "target_student_id",
}


def read_error(status: int = 500, code: str = "INTERNAL_ERROR") -> HTTPException:
    messages = {
        "INTERNAL_ERROR": "Could not load grades. Please try again.",
        "NOT_FOUND": "Gradebook not found.",
        "UNAUTHORIZED": "Authentication required.",
    }
    return HTTPException(
        status, detail={"code": code, "message": messages[code], "details": {}},
        headers={"WWW-Authenticate": "Bearer"} if status == 401 else None,
    )


async def read_gradebook_facts(
    client: httpx.AsyncClient, rpc: str, parameters: dict[str, str]
) -> dict:
    if rpc not in _PARAMETERS or set(parameters) != {_PARAMETERS[rpc]}:
        raise ValueError("Only fixed gradebook read RPCs can be requested")
    try:
        response = await client.post(f"rpc/{rpc}", json=parameters)
    except httpx.HTTPError:
        raise read_error() from None
    if response.status_code == 401:
        raise read_error(401, "UNAUTHORIZED")
    try:
        payload = response.json()
    except ValueError:
        raise read_error() from None
    if not response.is_success:
        if isinstance(payload, dict) and payload.get("code") == "WW404":
            raise read_error(404, "NOT_FOUND")
        raise read_error()
    if not isinstance(payload, dict):
        raise read_error()
    return payload

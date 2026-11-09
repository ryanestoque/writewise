"""Only fixed error text crosses the private-conversation boundary."""

from fastapi import HTTPException

COMMENT_ERRORS = {
    "WW404": (404, "NOT_FOUND", "Conversation not found."),
    "WW412": (404, "ACTIVITY_NOT_ASSIGNED", "This activity is no longer assigned."),
    "WW422": (422, "VALIDATION_ERROR", "Check the comment request."),
    "WW440": (409, "COMMENTS_LOCKED", "This conversation is locked."),
    "WW441": (409, "ACTIVITY_ARCHIVED", "This activity is archived."),
    "WW442": (409, "COMMENT_READ_CONFLICT", "New comments arrived. Refresh the conversation."),
}


def comment_error(sql_state: str = "INTERNAL_ERROR") -> HTTPException:
    status, code, message = COMMENT_ERRORS.get(
        sql_state,
        (500, "INTERNAL_ERROR", "Could not update the conversation. Try again."),
    )
    return HTTPException(status, detail={"code": code, "message": message, "details": {}})

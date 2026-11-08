"""Stable public codes for service-only coursework mutations."""

GRADE_ERRORS = {
    "WW430": (409, "GRADE_NOT_RELEASABLE", "This work does not have a grade to release."),
    "WW431": (409, "GRADE_REVISION_CONFLICT", "This grade changed. Refresh before releasing."),
    "WW432": (409, "POINTS_OVERRIDE_CONFLICT", "A point override exceeds the new maximum."),
    "WW433": (
        409,
        "POINTS_REMOVAL_CONFIRMATION_REQUIRED",
        "Confirm removal of points and existing grade publication.",
    ),
    "WW434": (422, "VALIDATION_ERROR", "Check the points and work changes."),
}

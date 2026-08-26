from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.activities import router as activities_router
from app.api.students import router as students_router
from app.api.submissions import router as submissions_router
from app.core.config import settings

app = FastAPI(title="WriteWise API")

# Configure CORS
origins = [origin.strip() for origin in settings.CORS_ALLOWED_ORIGINS.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    # Normalize error to standard format
    if isinstance(exc.detail, dict) and "code" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": "INTERNAL_ERROR", "message": str(exc.detail), "details": {}}},
    )


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "model_loaded": True,  # Hardcoded stub for now
        "scoring_engine": settings.SCORING_ENGINE,
    }


app.include_router(students_router, prefix="/api/students", tags=["students"])
app.include_router(activities_router, prefix="/api/activities", tags=["activities"])
app.include_router(submissions_router, prefix="/api/submissions", tags=["submissions"])

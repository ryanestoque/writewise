import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.activities import router as activities_router
from app.api.students import router as students_router
from app.api.submissions import router as submissions_router
from app.core.config import settings
from app.ml.model import is_stub_mode, load_model

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: load CNN model at startup (ML_PIPELINE §8)."""
    load_model()
    yield


app = FastAPI(title="WriteWise API", lifespan=lifespan)

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


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    error_messages = []
    sanitized_errors = []
    for err in exc.errors():
        loc = " -> ".join(str(part) for part in err.get("loc", []))
        msg = err.get("msg", "Invalid value")
        error_messages.append(f"{loc}: {msg}" if loc else msg)
        sanitized_errors.append(
            {
                "loc": [str(p) for p in err.get("loc", [])],
                "msg": msg,
                "type": err.get("type", "validation_error"),
            }
        )
    message = "; ".join(error_messages) if error_messages else "Request validation failed."
    return JSONResponse(
        status_code=422,
        content={
            "error": {
                "code": "VALIDATION_ERROR",
                "message": message,
                "details": {"errors": sanitized_errors},
            }
        },
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled server error: %s", exc)
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_ERROR",
                "message": "An internal server error occurred.",
                "details": {},
            }
        },
    )


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "environment": settings.ENVIRONMENT,
        "model_loaded": True,
        "model_stub": is_stub_mode(),
        "scoring_engine": settings.SCORING_ENGINE,
    }


app.include_router(students_router, prefix="/api/students", tags=["students"])
app.include_router(activities_router, prefix="/api/activities", tags=["activities"])
app.include_router(submissions_router, prefix="/api/submissions", tags=["submissions"])

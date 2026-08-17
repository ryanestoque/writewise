from typing import Annotated

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings

security = HTTPBearer()


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(security)]
) -> dict:
    try:
        token = credentials.credentials
        payload = jwt.decode(
            token,
            settings.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "token_expired",
                    "message": "Token has expired",
                    "details": None,
                }
            },
        )
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "error": {
                    "code": "unauthorized",
                    "message": "Invalid authentication credentials",
                    "details": None,
                }
            },
        )


def get_current_teacher(user: Annotated[dict, Depends(get_current_user)]) -> dict:
    # Supabase roles might be in user_metadata or app_metadata
    user_metadata = user.get("user_metadata", {})
    app_metadata = user.get("app_metadata", {})

    # Check if the user is a teacher
    role = user_metadata.get("role") or app_metadata.get("role") or user.get("role")

    if role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error": {
                    "code": "forbidden",
                    "message": "Requires teacher role",
                    "details": None,
                }
            },
        )

    return user

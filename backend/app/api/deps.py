from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.supabase import supabase_client

security = HTTPBearer()


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:
    token = credentials.credentials
    try:
        # Pass the token to Supabase Auth API to verify signature and retrieve the user
        response = supabase_client.auth.get_user(token)

        # The response payload contains the user's metadata and role
        user = response.user

        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"code": "UNAUTHORIZED", "message": "User not found", "details": {}},
            )

        # We simulate the JWT payload shape for compatibility with our role checks
        payload = {
            "sub": user.id,
            "role": (user.user_metadata or {}).get("role", "authenticated"),
            "email": user.email,
        }
        return payload

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={
                "code": "UNAUTHORIZED",
                "message": "Invalid token",
                "details": {"error": str(e)},
            },
        )


def get_current_teacher(payload: dict = Depends(get_current_user)) -> dict:
    role = payload.get("role")
    if role != "teacher":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Teacher access required", "details": {}},
        )
    return payload


def get_current_parent(payload: dict = Depends(get_current_user)) -> dict:
    role = payload.get("role")
    if role != "parent":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"code": "FORBIDDEN", "message": "Parent access required", "details": {}},
        )
    return payload

"""Mongo-backed user authentication with token-version revocation."""

from bson import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException
from pymongo.errors import DuplicateKeyError
from app.auth import create_access_token, decode_token, hash_password, verify_password
from app.database import get_db
from app.schemas import (
    SignupRequest,
    LoginRequest,
    TokenResponse,
    UserResponse,
    UpdateProfileRequest,
    ChangePasswordRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def require_user(authorization: str | None = Header(default=None), db=Depends(get_db)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Authentication required")
    payload = decode_token(authorization[7:])
    if not payload or not ObjectId.is_valid(payload.get("sub", "")):
        raise HTTPException(401, "Invalid or expired token")
    user = db.users.find_one({"_id": ObjectId(payload["sub"])})
    if not user or payload.get("version", 0) != user.get("token_version", 0):
        raise HTTPException(401, "Invalid or expired token")
    return user


def require_user_id(user=Depends(require_user)):
    return str(user["_id"])


def user_response(user):
    resume = user.get("resume") or {}
    return UserResponse(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        email_verified=user.get("email_verified", False),
        resume_status=(
            "present"
            if resume.get("latest_resume_id") or resume.get("raw_text")
            else "none"
        ),
        target_role=user.get("target_role", "Software Engineer"),
        experience_level=user.get("experience_level", "mid"),
        created_at=str(user["_id"].generation_time),
    )


@router.post("/signup", response_model=TokenResponse, status_code=201)
def signup(body: SignupRequest, db=Depends(get_db)):
    email = str(body.email).strip().lower()
    if db.users.find_one({"email": email}):
        raise HTTPException(409, "Email already registered")
    user = {
        "name": body.name.strip(),
        "email": email,
        "hashed_password": hash_password(body.password),
        "resume": None,
        "token_version": 0,
    }
    try:
        user["_id"] = db.users.insert_one(user).inserted_id
    except DuplicateKeyError:
        raise HTTPException(409, "Email already registered")
    return TokenResponse(access_token=create_access_token(str(user["_id"]), 0))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db=Depends(get_db)):
    user = db.users.find_one({"email": str(body.email).strip().lower()})
    if not user or not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(401, "Invalid email or password")
    return TokenResponse(
        access_token=create_access_token(str(user["_id"]), user.get("token_version", 0))
    )


@router.get("/me", response_model=UserResponse)
def get_me(user=Depends(require_user)):
    return user_response(user)


@router.put("/profile", response_model=UserResponse)
def update_profile(
    body: UpdateProfileRequest, db=Depends(get_db), user=Depends(require_user)
):
    updates = {
        k: v.strip()
        for k, v in body.model_dump().items()
        if isinstance(v, str) and v.strip()
    }
    if updates:
        db.users.update_one({"_id": user["_id"]}, {"$set": updates})
        user.update(updates)
    return user_response(user)


@router.post("/change-password")
def change_password(
    body: ChangePasswordRequest, db=Depends(get_db), user=Depends(require_user)
):
    if not verify_password(body.old_password, user["hashed_password"]):
        raise HTTPException(400, "Current password is incorrect")
    updated = db.users.update_one(
        {
            "_id": user["_id"],
            "hashed_password": user["hashed_password"],
            "token_version": user.get("token_version"),
        },
        {
            "$set": {"hashed_password": hash_password(body.new_password)},
            "$inc": {"token_version": 1},
        },
    )
    if updated.modified_count != 1:
        raise HTTPException(
            409, "Account credentials changed. Sign in again before retrying."
        )
    return {
        "message": "Password updated.",
        "access_token": create_access_token(
            str(user["_id"]), user.get("token_version", 0) + 1
        ),
    }


@router.post("/logout")
def logout(db=Depends(get_db), user=Depends(require_user)):
    db.users.update_one({"_id": user["_id"]}, {"$inc": {"token_version": 1}})
    return {"message": "Signed out on all devices."}

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pymongo.database import Database

from app.auth import create_access_token, decode_access_token, hash_password, verify_password
from app.database import get_db
from app.schemas import (
    ChangePasswordRequest,
    LoginRequest,
    SignupRequest,
    TokenResponse,
    UpdateProfileRequest,
    UserResponse,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/check-db")
def check_db():
    from app.database import init_db
    init_db()
    try:
        db = get_db()
        db.command("ping")
        return {"status": "ok", "tables": "mongodb connected"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


def require_user(authorization: str = Header(...)) -> dict:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    db = get_db()
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


def require_user_id(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Database = Depends(get_db)):
    try:
        existing = db.users.find_one({"email": body.email})
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        user = {
            "name": body.name,
            "email": body.email,
            "hashed_password": hash_password(body.password),
            "resume": None,
        }
        result = db.users.insert_one(user)
        token = create_access_token(str(result.inserted_id))
        return TokenResponse(access_token=token)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Database = Depends(get_db)):
    user = db.users.find_one({"email": body.email})
    if not user:
        raise HTTPException(status_code=404, detail="No user found with this email")
    if not verify_password(body.password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Invalid password")

    token = create_access_token(str(user["_id"]))
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def get_me(user: dict = Depends(require_user)):
    resume_status = "present" if user.get("resume") and user["resume"].get("raw_text") else "none"
    return UserResponse(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        resume_status=resume_status,
        created_at=str(user["_id"].generation_time),
    )


@router.put("/profile")
def update_profile(body: UpdateProfileRequest, user: dict = Depends(require_user), db: Database = Depends(get_db)):
    updates = {}
    if body.name is not None:
        updates["name"] = body.name
    if updates:
        db.users.update_one({"_id": user["_id"]}, {"$set": updates})
        user.update(updates)
    return UserResponse(
        id=str(user["_id"]),
        name=user["name"],
        email=user["email"],
        resume_status="present" if user.get("resume") and user["resume"].get("raw_text") else "none",
        created_at=str(user["_id"].generation_time),
    )


@router.post("/change-password")
def change_password(body: ChangePasswordRequest, user: dict = Depends(require_user), db: Database = Depends(get_db)):
    if not verify_password(body.old_password, user["hashed_password"]):
        raise HTTPException(status_code=401, detail="Current password is incorrect")
    new_hash = hash_password(body.new_password)
    db.users.update_one({"_id": user["_id"]}, {"$set": {"hashed_password": new_hash}})
    return {"message": "Password updated successfully"}


@router.post("/logout")
def logout(user: dict = Depends(require_user)):
    return {"message": "Logged out successfully"}

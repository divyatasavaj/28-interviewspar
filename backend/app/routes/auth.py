from fastapi import APIRouter, Depends, HTTPException, Header, status
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.auth import create_access_token, decode_access_token, hash_password, verify_password
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest, SignupRequest, TokenResponse, UserResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/check-db")
def check_db():
    from app.database import init_db
    init_db()
    try:
        from app.database import SessionLocal
        db = SessionLocal()
        db.execute(text("SELECT 1 FROM users LIMIT 1"))
        db.close()
        return {"status": "ok", "tables": "users exists"}
    except Exception as e:
        return {"status": "error", "detail": str(e)}


def require_token(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    return authorization.removeprefix("Bearer ")


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def signup(body: SignupRequest, db: Session = Depends(get_db)):
    try:
        existing = db.query(User).filter(User.email == body.email).first()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        user = User(
            name=body.name,
            email=body.email,
            hashed_password=hash_password(body.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        token = create_access_token(user.id)
        return TokenResponse(access_token=token)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="No user found with this email")
    if not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid password")

    token = create_access_token(user.id)
    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserResponse)
def get_me(token: str = Depends(require_token), db: Session = Depends(get_db)):
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

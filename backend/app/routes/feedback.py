from datetime import datetime, timezone

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pymongo.database import Database

from app.auth import decode_access_token
from app.database import get_db
from app.schemas import FeedbackResponse, SubmitFeedbackRequest

router = APIRouter(prefix="/feedback", tags=["feedback"])


def require_user_id(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


@router.post("/", status_code=status.HTTP_201_CREATED)
def submit_feedback(body: SubmitFeedbackRequest, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    if body.rating < 1 or body.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    doc = {
        "user_id": user_id,
        "session_id": body.session_id,
        "rating": body.rating,
        "comments": body.comments,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    result = db.feedback.insert_one(doc)
    return FeedbackResponse(
        id=str(result.inserted_id),
        session_id=body.session_id,
        rating=body.rating,
        comments=body.comments,
        submitted_at=doc["submitted_at"],
    )


@router.get("/")
def get_feedback_history(db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    items = list(db.feedback.find({"user_id": user_id}).sort("_id", -1))
    return [
        FeedbackResponse(
            id=str(f["_id"]),
            session_id=f["session_id"],
            rating=f["rating"],
            comments=f.get("comments"),
            submitted_at=f["submitted_at"],
        )
        for f in items
    ]

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pymongo.database import Database

from app.adaptive import get_ability_profile, initialize_ability_estimate
from app.database import get_db
from app.schemas import SessionResponse, StartSessionRequest, StartSessionResponse

router = APIRouter(prefix="/sessions", tags=["sessions"])


def require_user_id(authorization: str = Header(...)) -> str:
    from app.auth import decode_access_token
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


from fastapi import Header


@router.post("/start", status_code=status.HTTP_201_CREATED)
def start_session(body: StartSessionRequest, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    existing = db.sessions.find_one({"user_id": user_id, "status": "in_progress"})
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active session")

    calibration_qs = list(
        db.questions.find({"domain": body.domain, "difficulty": "easy"}).limit(3)
    )
    if not calibration_qs:
        calibration_qs = list(db.questions.aggregate([{"$sample": {"size": 3}}]))

    calibration = []
    for q in calibration_qs:
        calibration.append({
            "question_id": str(q["_id"]),
            "question_text": q.get("question_text"),
            "type": q.get("type"),
            "difficulty": "easy",
        })

    session = {
        "user_id": user_id,
        "domain": body.domain,
        "round_type": body.round_type,
        "mode": body.mode,
        "difficulty": body.difficulty or "medium",
        "duration_minutes": body.duration_minutes or 30,
        "started_at": None,
        "ended_at": None,
        "ability_profile": {},
        "status": "in_progress",
    }
    result = db.sessions.insert_one(session)

    initialize_ability_estimate(user_id, [], db)

    return StartSessionResponse(
        session_id=str(result.inserted_id),
        calibration_questions=calibration,
    )


@router.post("/{session_id}/end")
def end_session(session_id: str, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    from datetime import datetime, timezone
    session = db.sessions.find_one({"_id": ObjectId(session_id), "user_id": user_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    db.sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"status": "completed", "ended_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"message": "Session ended"}


@router.get("/")
def list_sessions(db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    sessions = db.sessions.find({"user_id": user_id}).sort("_id", -1)
    return [
        SessionResponse(
            id=str(s["_id"]),
            domain=s.get("domain", ""),
            round_type=s.get("round_type", ""),
            mode=s.get("mode", ""),
            difficulty=s.get("difficulty", "medium"),
            duration_minutes=s.get("duration_minutes", 30),
            status=s.get("status", "in_progress"),
            ability_profile=s.get("ability_profile"),
            started_at=str(s["_id"].generation_time),
            ended_at=s.get("ended_at"),
        )
        for s in sessions
    ]


@router.get("/active")
def get_active_session(db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    session = db.sessions.find_one({"user_id": user_id, "status": "in_progress"})
    if not session:
        raise HTTPException(status_code=404, detail="No active session")
    return SessionResponse(
        id=str(session["_id"]),
        domain=session.get("domain", ""),
        round_type=session.get("round_type", ""),
        mode=session.get("mode", ""),
        difficulty=session.get("difficulty", "medium"),
        duration_minutes=session.get("duration_minutes", 30),
        status=session.get("status", "in_progress"),
        ability_profile=session.get("ability_profile"),
        started_at=str(session["_id"].generation_time),
        ended_at=session.get("ended_at"),
    )


@router.get("/ability-profile")
def get_profile(db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    profile = get_ability_profile(user_id, db)
    return {"ability_profile": profile}

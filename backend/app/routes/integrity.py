from datetime import datetime, timezone

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Header
from pymongo.database import Database

from app.auth import decode_access_token
from app.database import get_db
from app.schemas import IntegrityEvent, IntegritySummaryResponse

router = APIRouter(prefix="/integrity", tags=["integrity"])


def require_user_id(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


def _get_log(session_id: str, db: Database):
    log = db.integrity_logs.find_one({"session_id": session_id})
    if not log:
        log_id = db.integrity_logs.insert_one({
            "session_id": session_id,
            "events": [],
        }).inserted_id
        log = db.integrity_logs.find_one({"_id": log_id})
    return log


@router.post("/event")
def log_event(body: IntegrityEvent, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    event = {
        "type": body.type,
        "timestamp": body.timestamp or datetime.now(timezone.utc).isoformat(),
    }
    if body.question_id:
        event["question_id"] = body.question_id
    if body.extra:
        event.update(body.extra)

    log = _get_log(body.session_id, db)
    db.integrity_logs.update_one(
        {"_id": log["_id"]},
        {"$push": {"events": event}},
    )
    return {"message": "Event logged"}


@router.get("/summary/{session_id}")
def compile_integrity_summary(session_id: str, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    log = db.integrity_logs.find_one({"session_id": session_id})
    if not log:
        return IntegritySummaryResponse(session_id=session_id, events=[])

    events = log.get("events", [])
    flags = []
    for e in events:
        etype = e.get("type", "")
        if etype in ("face_not_detected", "multi_face_detected", "face_left_frame"):
            flags.append(e)
        elif etype == "tab_switch":
            flags.append(e)
        elif etype == "copy_paste":
            flags.append(e)
        elif etype == "code_similarity_flag":
            flags.append(e)

    return IntegritySummaryResponse(session_id=session_id, events=flags)


@router.post("/check-code-similarity")
def check_code_similarity(body: dict, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    code = body.get("code", "")
    session_id = body.get("session_id")
    question_id = body.get("question_id")

    known_answers = list(db.answers.find({"question_id": question_id}).limit(10))
    max_similarity = 0
    for ka in known_answers:
        stored_code = ka.get("code_submission", "")
        if stored_code and code:
            common = len(set(code.split()) & set(stored_code.split()))
            total = max(len(set(code.split())), 1)
            similarity = common / total
            max_similarity = max(max_similarity, similarity)

    if max_similarity > 0.7:
        log = _get_log(session_id, db)
        db.integrity_logs.update_one(
            {"_id": log["_id"]},
            {"$push": {"events": {
                "type": "code_similarity_flag",
                "question_id": question_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "similarity_score": max_similarity,
            }}},
        )

    return {"similarity_score": max_similarity, "flagged": max_similarity > 0.7}

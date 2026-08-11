from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Header
from pymongo.database import Database

from app.auth import decode_access_token
from app.database import get_db
from app.schemas import (
    CopyPasteRequest,
    FaceEventRequest,
    FullscreenExitRequest,
    IntegrityEvent,
    LatencyAnomalyRequest,
    TabSwitchRequest,
)
from app.services import anticheat

router = APIRouter(prefix="/integrity", tags=["integrity"])


def require_user_id(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


@router.post("/face-event")
def log_face_event(body: FaceEventRequest, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    try:
        event = anticheat.log_face_event(db, body.session_id, body.event_type, body.timestamp)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {"message": "Face event logged", "event": event}


@router.post("/tab-switch")
def log_tab_switch(body: TabSwitchRequest, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    event = anticheat.log_tab_switch(db, body.session_id, body.timestamp)
    return {"message": "Tab switch logged", "event": event}


@router.post("/fullscreen-exit")
def log_fullscreen_exit(body: FullscreenExitRequest, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    event = anticheat.log_fullscreen_exit(db, body.session_id, body.timestamp)
    return {"message": "Fullscreen exit logged", "event": event}


@router.post("/copy-paste")
def log_copy_paste(body: CopyPasteRequest, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    event = anticheat.log_copy_paste(
        db,
        body.session_id,
        question_id=body.question_id,
        pasted_content_length=body.pasted_content_length,
        timestamp=body.timestamp,
    )
    return {"message": "Copy/paste logged", "event": event}


@router.post("/latency-anomaly")
def log_latency_anomaly(body: LatencyAnomalyRequest, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    result = anticheat.flag_latency_anomaly(body.response_latency_ms, body.baseline)
    if result["flagged"]:
        event = {
            "type": "latency_anomaly",
            "timestamp": body.timestamp or datetime.now(timezone.utc).isoformat(),
            "response_latency_ms": body.response_latency_ms,
            "expected_ms": result["expected_ms"],
            "ratio": result["ratio"],
        }
        if body.question_id:
            event["question_id"] = body.question_id
        anticheat._push(db, body.session_id, event)
        result["event"] = event
    return result


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

    anticheat._push(db, body.session_id, event)
    return {"message": "Event logged"}


@router.get("/summary/{session_id}")
def compile_integrity_summary(session_id: str, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    return anticheat.compile_integrity_summary(db, session_id)


@router.post("/check-code-similarity")
def check_code_similarity(body: dict, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    code = body.get("code", "")
    session_id = body.get("session_id")
    question_id = body.get("question_id")

    known_answers = list(db.answers.find({"question_id": question_id}).limit(10))
    bank = [ka.get("code_submission", "") for ka in known_answers if ka.get("code_submission")]

    result = anticheat.check_code_similarity(code, bank)
    if session_id and result["flag"] in ("high", "medium"):
        anticheat._push(db, session_id, {
            "type": "code_similarity_flag",
            "question_id": question_id,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "similarity_score": result["score"],
        })

    return {"similarity_score": result["score"], "flag": result["flag"], "flagged": result["flag"] == "high"}

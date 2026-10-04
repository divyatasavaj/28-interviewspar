import base64
import json
from datetime import datetime, timezone

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pymongo.database import Database

from app.auth import decode_access_token
from app.database import get_db

router = APIRouter(prefix="/video", tags=["video"])


def require_user_id(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


@router.post("/start", status_code=status.HTTP_201_CREATED)
def start_video_session(body: dict, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id is required")

    video_session = {
        "user_id": user_id,
        "interview_session_id": session_id,
        "started_at": datetime.now(timezone.utc).isoformat(),
        "ended_at": None,
        "status": "active",
        "frame_count": 0,
        "face_detected_count": 0,
        "total_frames_analyzed": 0,
    }
    result = db.video_sessions.insert_one(video_session)
    return {"video_session_id": str(result.inserted_id), "status": "active"}


@router.post("/stop")
def stop_video_session(body: dict, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    video_session_id = body.get("video_session_id")
    if not video_session_id:
        raise HTTPException(status_code=400, detail="video_session_id is required")

    result = db.video_sessions.update_one(
        {"_id": ObjectId(video_session_id), "user_id": user_id},
        {"$set": {"status": "ended", "ended_at": datetime.now(timezone.utc).isoformat()}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Video session not found")
    return {"message": "Video session ended"}


@router.post("/analyze-frame")
def analyze_frame(body: dict, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    video_session_id = body.get("video_session_id")
    frame_data = body.get("frame_data")

    if not video_session_id or not frame_data:
        raise HTTPException(status_code=400, detail="video_session_id and frame_data required")

    video_session = db.video_sessions.find_one({"_id": ObjectId(video_session_id), "user_id": user_id})
    if not video_session:
        raise HTTPException(status_code=404, detail="Video session not found")

    face_detected = body.get("face_detected", True)
    face_count = body.get("face_count", 1)

    db.video_sessions.update_one(
        {"_id": ObjectId(video_session_id)},
        {
            "$inc": {
                "frame_count": 1,
                "face_detected_count": 1 if face_detected else 0,
                "total_frames_analyzed": 1,
                "multi_face_count": 1 if face_count and face_count > 1 else 0,
            },
        },
    )

    if not face_detected:
        db.integrity_logs.update_one(
            {"session_id": video_session.get("interview_session_id", "")},
            {"$push": {"events": {
                "type": "face_not_detected",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "video_session_id": video_session_id,
            }}},
            upsert=True,
        )

    if face_count and face_count > 1:
        db.integrity_logs.update_one(
            {"session_id": video_session.get("interview_session_id", "")},
            {"$push": {"events": {
                "type": "multi_face_detected",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "face_count": face_count,
            }}},
            upsert=True,
        )

    return {
        "frame_analyzed": True,
        "face_detected": face_detected,
        "face_count": face_count,
        "alerts": [],
    }


@router.get("/session/{video_session_id}")
def get_video_session(video_session_id: str, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    vs = db.video_sessions.find_one({"_id": ObjectId(video_session_id), "user_id": user_id})
    if not vs:
        raise HTTPException(status_code=404, detail="Video session not found")
    return {
        "id": str(vs["_id"]),
        "interview_session_id": vs.get("interview_session_id"),
        "status": vs.get("status"),
        "started_at": vs.get("started_at"),
        "ended_at": vs.get("ended_at"),
        "frame_count": vs.get("frame_count", 0),
        "face_detected_count": vs.get("face_detected_count", 0),
        "total_frames_analyzed": vs.get("total_frames_analyzed", 0),
    }


@router.get("/summary/{interview_session_id}")
def get_video_summary(interview_session_id: str, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    sessions = list(db.video_sessions.find({
        "interview_session_id": interview_session_id,
        "user_id": user_id,
    }))
    if not sessions:
        raise HTTPException(status_code=404, detail="No video sessions found")

    total_frames = sum(s.get("total_frames_analyzed", 0) for s in sessions)
    total_face = sum(s.get("face_detected_count", 0) for s in sessions)
    face_ratio = round(total_face / total_frames, 2) if total_frames > 0 else 0

    return {
        "total_sessions": len(sessions),
        "total_frames_analyzed": total_frames,
        "face_detection_rate": face_ratio,
        "recommendation": "Good" if face_ratio > 0.8 else "Needs improvement",
    }

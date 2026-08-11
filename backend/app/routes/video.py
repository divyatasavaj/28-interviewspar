import base64
import json
import math
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


def _dist(p1, p2):
    """Euclidean distance between two normalized points."""
    if not p1 or not p2:
        return None
    return math.hypot(p1.get("x", 0) - p2.get("x", 0), p1.get("y", 0) - p2.get("y", 0))


def _analyze_pose(pose_keypoints, face_box, frame_w, frame_h):
    """Analyze pose for suspicious patterns. Returns list of event dicts."""
    events = []
    if not pose_keypoints or not isinstance(pose_keypoints, list):
        return events

    for pose in pose_keypoints:
        if not isinstance(pose, dict):
            continue

        ls = pose.get("left_shoulder")
        rs = pose.get("right_shoulder")
        le = pose.get("left_elbow")
        re = pose.get("right_elbow")
        lw = pose.get("left_wrist")
        rw = pose.get("right_wrist")

        # 1. Hands near face (potential cheating device, covering mouth)
        if face_box and (lw or rw):
            fx = face_box.get("x", 0) + face_box.get("width", 0) / 2
            fy = face_box.get("y", 0) + face_box.get("height", 0) / 2
            fw = face_box.get("width", 0)
            fh = face_box.get("height", 0)
            face_radius = max(fw, fh) * 0.6  # threshold radius around face center

            for wrist, label in [(lw, "left"), (rw, "right")]:
                if wrist and _dist(wrist, {"x": fx, "y": fy}) is not None:
                    d = _dist(wrist, {"x": fx, "y": fy})
                    if d < face_radius:
                        events.append({
                            "type": "hand_near_face",
                            "hand": label,
                            "distance": round(d, 3),
                            "threshold": round(face_radius, 3),
                        })

        # 2. Arms crossed (both wrists near opposite shoulders)
        if ls and rs and lw and rw:
            d_lw_rs = _dist(lw, rs)
            d_rw_ls = _dist(rw, ls)
            shoulder_width = _dist(ls, rs)
            if shoulder_width and d_lw_rs and d_rw_ls:
                if d_lw_rs < shoulder_width * 0.5 and d_rw_ls < shoulder_width * 0.5:
                    events.append({
                        "type": "arms_crossed",
                        "left_wrist_to_right_shoulder": round(d_lw_rs, 3),
                        "right_wrist_to_left_shoulder": round(d_rw_ls, 3),
                        "shoulder_width": round(shoulder_width, 3),
                    })

        # 3. Hands reaching off-screen (wrist near frame edge)
        if lw or rw:
            for wrist, label in [(lw, "left"), (rw, "right")]:
                if wrist:
                    x, y = wrist.get("x", 0.5), wrist.get("y", 0.5)
                    margin = 0.05  # 5% from edge
                    if x < margin or x > 1 - margin or y < margin or y > 1 - margin:
                        events.append({
                            "type": "hand_off_screen",
                            "hand": label,
                            "position": {"x": round(x, 3), "y": round(y, 3)},
                        })

    return events


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
    pose_keypoints = body.get("pose_keypoints")
    hand_landmarks = body.get("hand_landmarks")

    if not video_session_id or not frame_data:
        raise HTTPException(status_code=400, detail="video_session_id and frame_data required")

    video_session = db.video_sessions.find_one({"_id": ObjectId(video_session_id), "user_id": user_id})
    if not video_session:
        raise HTTPException(status_code=404, detail="Video session not found")

    face_detected = body.get("face_detected", True)
    face_count = body.get("face_count", 1)

    # Get primary face box for pose analysis (approximate from frontend)
    # The frontend sends face boxes in the frame analysis but we don't have them here
    # We'll use a default center face box for pose analysis if needed
    face_box = None
    if face_detected and face_count > 0:
        # Approximate face box at center (normalized)
        face_box = {"x": 0.5, "y": 0.4, "width": 0.3, "height": 0.4}

    # Analyze pose for suspicious patterns
    pose_events = _analyze_pose(pose_keypoints, face_box, 1, 1)

    update_fields = {
        "$inc": {
            "frame_count": 1,
            "face_detected_count": 1 if face_detected else 0,
            "total_frames_analyzed": 1,
            "multi_face_count": 1 if face_count and face_count > 1 else 0,
        },
    }
    # Store latest pose/hand data (optional, for debugging)
    if pose_keypoints is not None:
        update_fields["$set"] = {"latest_pose_keypoints": pose_keypoints}
    if hand_landmarks is not None:
        if "$set" not in update_fields:
            update_fields["$set"] = {}
        update_fields["$set"]["latest_hand_landmarks"] = hand_landmarks

    db.video_sessions.update_one(
        {"_id": ObjectId(video_session_id)},
        update_fields,
    )

    interview_session_id = video_session.get("interview_session_id", "")
    alerts = []

    if not face_detected:
        db.integrity_logs.update_one(
            {"session_id": interview_session_id},
            {"$push": {"events": {
                "type": "face_not_detected",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "video_session_id": video_session_id,
            }}},
            upsert=True,
        )
        alerts.append({"type": "face_not_detected"})

    if face_count and face_count > 1:
        db.integrity_logs.update_one(
            {"session_id": interview_session_id},
            {"$push": {"events": {
                "type": "multi_face_detected",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "face_count": face_count,
            }}},
            upsert=True,
        )
        alerts.append({"type": "multi_face_detected", "face_count": face_count})

    # Log pose-based integrity events
    for event in pose_events:
        db.integrity_logs.update_one(
            {"session_id": interview_session_id},
            {"$push": {"events": {
                **event,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "video_session_id": video_session_id,
            }}},
            upsert=True,
        )
        alerts.append(event)

    return {
        "frame_analyzed": True,
        "face_detected": face_detected,
        "face_count": face_count,
        "alerts": alerts,
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

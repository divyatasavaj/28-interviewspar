"""Anti-cheat monitoring service functions (see flow.md)."""

from datetime import datetime, timezone

from app.services.similarity import code_similarity, similarity_flag

FACE_EVENT_TYPES = {"no_face", "multi_face", "face_left_frame"}

# severity / category mapping for integrity summary aggregation
_LEVEL_MAP = {
    "face_not_detected": "warning",
    "face_left_frame": "critical",
    "multi_face_detected": "critical",
    "person_not_detected": "warning",
    "multi_person_detected": "critical",
    "body_part_detected": "warning",
    "hand_near_face": "warning",
    "arms_crossed": "warning",
    "hand_off_screen": "warning",
    "tab_switch": "warning",
    "tab-hidden": "warning",
    "window-blur": "warning",
    "fullscreen_exit": "warning",
    "fullscreen-exit": "warning",
    "copy_paste": "warning",
    "code_similarity_flag": "warning",
    "latency_anomaly": "warning",
    "looking_away": "warning",
    "mobile_phone_detected": "critical",
    "mobile_phone_cleared": "info",
}

_CATEGORY_MAP = {
    "face_not_detected": "face",
    "face_left_frame": "face",
    "multi_face_detected": "face",
    "person_not_detected": "person",
    "multi_person_detected": "person",
    "body_part_detected": "person",
    "hand_near_face": "person",
    "arms_crossed": "person",
    "hand_off_screen": "person",
    "tab_switch": "tab_switch",
    "tab-hidden": "tab_switch",
    "window-blur": "tab_switch",
    "fullscreen_exit": "fullscreen_exit",
    "fullscreen-exit": "fullscreen_exit",
    "copy_paste": "copy_paste",
    "code_similarity_flag": "code_similarity",
    "latency_anomaly": "latency",
    "looking_away": "attention",
    "mobile_phone_detected": "device",
    "mobile_phone_cleared": "device",
}


def _utcnow() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get_log(db, session_id: str) -> dict:
    log = db.integrity_logs.find_one({"session_id": session_id})
    if not log:
        log_id = db.integrity_logs.insert_one({"session_id": session_id, "events": []}).inserted_id
        log = db.integrity_logs.find_one({"_id": log_id})
    return log


def _push(db, session_id: str, event: dict) -> None:
    log = _get_log(db, session_id)
    db.integrity_logs.update_one({"_id": log["_id"]}, {"$push": {"events": event}})


def _push_many(db, session_id: str, events: list[dict]) -> None:
    if not events:
        return
    log = _get_log(db, session_id)
    db.integrity_logs.update_one({"_id": log["_id"]}, {"$push": {"events": {"$each": events}}})


def log_face_event(db, session_id: str, event_type: str, timestamp: str | None = None, extra: dict | None = None) -> dict:
    """Log a no-face / multi-face / face-left-frame event."""
    if event_type not in FACE_EVENT_TYPES:
        raise ValueError(f"invalid face event type: {event_type}")
    event = {"type": event_type, "timestamp": timestamp or _utcnow()}
    if extra:
        event.update(extra)
    _push(db, session_id, event)
    return event


def log_tab_switch(db, session_id: str, timestamp: str | None = None) -> dict:
    event = {"type": "tab_switch", "timestamp": timestamp or _utcnow()}
    _push(db, session_id, event)
    return event


def log_fullscreen_exit(db, session_id: str, timestamp: str | None = None) -> dict:
    event = {"type": "fullscreen_exit", "timestamp": timestamp or _utcnow()}
    _push(db, session_id, event)
    return event


def log_copy_paste(
    db,
    session_id: str,
    question_id: str | None = None,
    pasted_content_length: int | None = None,
    timestamp: str | None = None,
) -> dict:
    event = {"type": "copy_paste", "timestamp": timestamp or _utcnow()}
    if question_id:
        event["question_id"] = question_id
    if pasted_content_length is not None:
        event["pasted_content_length"] = pasted_content_length
    _push(db, session_id, event)
    return event


def check_code_similarity(code: str, known_solutions_bank: list[str]) -> dict:
    """Token-overlap comparison of `code` against a bank of known solutions.

    Returns the best (highest) similarity found plus its flag level.
    """
    best = {"score": 0.0, "flag": "low"}
    for known in known_solutions_bank or []:
        if not isinstance(known, str) or not known.strip():
            continue
        score = code_similarity(code, known)
        if score > best["score"]:
            best = {"score": score, "flag": similarity_flag(score)}
    return best


def flag_latency_anomaly(response_latency_ms: float, baseline) -> dict:
    """Compare response latency against a question-complexity baseline.

    `baseline` is either a number (expected latency in ms) or a dict with
    `expected_ms` and an optional `tolerance_ratio` (default 2.5x).
    Flags when latency exceeds expected * tolerance.
    """
    if isinstance(baseline, dict):
        expected_ms = baseline.get("expected_ms") or 0
        tolerance = baseline.get("tolerance_ratio") or 2.5
    else:
        expected_ms = baseline or 0
        tolerance = 2.5
    if expected_ms <= 0 or response_latency_ms <= 0:
        return {"flagged": False, "ratio": 0.0, "expected_ms": expected_ms}
    ratio = round(response_latency_ms / expected_ms, 2)
    return {"flagged": ratio > tolerance, "ratio": ratio, "expected_ms": expected_ms}


def baseline_for_difficulty(difficulty: str) -> int:
    """Expected response latency (ms) for a question of a given difficulty."""
    return {
        "easy": 30000,
        "medium": 60000,
        "hard": 120000,
    }.get((difficulty or "").lower(), 60000)


def compile_integrity_summary(db, session_id: str) -> dict:
    """Aggregate all integrity flags for a session into a structured summary."""
    log = db.integrity_logs.find_one({"session_id": session_id})
    events = (log or {}).get("events", []) or []

    categories = {}
    for e in events:
        etype = e.get("type", "")
        cat = _CATEGORY_MAP.get(etype, "other")
        bucket = categories.setdefault(cat, {"count": 0, "events": []})
        bucket["count"] += 1
        bucket["events"].append(e)

    total = len(events)
    critical = sum(1 for e in events if _LEVEL_MAP.get(e.get("type", "")) == "critical")
    warnings = total - critical

    if critical:
        risk_level = "high"
    elif warnings >= 3:
        risk_level = "medium"
    elif total:
        risk_level = "low"
    else:
        risk_level = "clear"

    return {
        "session_id": session_id,
        "total_flags": total,
        "critical_count": critical,
        "warning_count": warnings,
        "risk_level": risk_level,
        "categories": categories,
        "events": events,
    }

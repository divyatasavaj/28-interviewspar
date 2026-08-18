from pymongo.database import Database

from app.database import get_db

TOPICS = ["DSA", "Communication", "SystemDesign", "ProblemSolving", "DomainKnowledge"]

DIFFICULTY_MAP = {"easy": 1, "medium": 2, "hard": 3}
REVERSE_DIFFICULTY = {1: "easy", 2: "medium", 3: "hard"}


def _default_profile() -> dict:
    return {t: 0.5 for t in TOPICS}


def initialize_ability_estimate(user_id: str, calibration_results: list[dict], db: Database = None) -> dict:
    if db is None:
        db = get_db()
    profile = _default_profile()
    for r in calibration_results:
        topic = r.get("topic", "ProblemSolving")
        correct = r.get("correct", False)
        difficulty = DIFFICULTY_MAP.get(r.get("difficulty", "medium"), 2)
        delta = 0.05 * difficulty if correct else -0.05 * difficulty
        profile[topic] = max(0.0, min(1.0, profile.get(topic, 0.5) + delta))
    db.sessions.update_one(
        {"user_id": user_id, "status": "in_progress"},
        {"$set": {"ability_profile": profile}},
    )
    return profile


def update_ability_estimate(user_id: str, topic: str, combined_result: dict, db: Database = None) -> float:
    if db is None:
        db = get_db()
    session = db.sessions.find_one({"user_id": user_id, "status": "in_progress"})
    if not session:
        return 0.5
    profile = session.get("ability_profile") or _default_profile()
    correct = combined_result.get("passed", False)
    difficulty = DIFFICULTY_MAP.get(combined_result.get("difficulty", "medium"), 2)
    delta = 0.04 * difficulty if correct else -0.04 * difficulty
    new_val = max(0.0, min(1.0, profile.get(topic, 0.5) + delta))
    profile[topic] = new_val
    db.sessions.update_one(
        {"_id": session["_id"]},
        {"$set": {"ability_profile": profile}},
    )
    return new_val


def select_next_difficulty(user_id: str, topic: str, db: Database = None) -> str:
    if db is None:
        db = get_db()
    session = db.sessions.find_one({"user_id": user_id, "status": "in_progress"})
    if not session:
        return "medium"
    profile = session.get("ability_profile") or _default_profile()
    ability = profile.get(topic, 0.5)
    if ability < 0.4:
        return "easy"
    elif ability < 0.7:
        return "medium"
    else:
        return "hard"


def get_ability_profile(user_id: str, db: Database = None) -> dict:
    if db is None:
        db = get_db()
    session = db.sessions.find_one({"user_id": user_id, "status": "in_progress"})
    if session:
        return session.get("ability_profile") or _default_profile()
    return _default_profile()

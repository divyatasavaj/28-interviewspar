"""Owned, persistent interview API used by the current React application."""

from typing import Literal
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.database import get_db
from app.routes.auth import require_user
from app.interview_flow import (
    DOMAINS,
    make_questions,
    evaluate_answer,
    public_session,
    compile_report,
    now,
    evaluation_kind,
    spoken_question,
    set_question_depth,
)
from app.safe_execution import execution_endpoint, run_problem
from app.coding_practice import CODING_DOMAINS, evaluate_code
from app.delivery import CodingObservation, DeliveryObservation, coding_feedback, delivery_feedback

router = APIRouter(prefix="/interview", tags=["interview"])


class StartRequest(BaseModel):
    name: str = Field(default="", max_length=120)
    domain: str = "Software Engineering"
    experience: str = Field(default="", max_length=200)
    experience_level: Literal["intern", "junior", "mid", "senior", "lead"] = "mid"
    persona: Literal["hr", "tech", "technical"] = "technical"
    mode: Literal["practice", "assessment"] = "practice"
    save_consent: bool = False
    allow_ai: bool = False
    response_mode: Literal["text", "voice"] = "text"
    coding_practice: bool = False


class AnswerRequest(BaseModel):
    session_id: str
    question_id: str
    request_id: str = Field(min_length=8, max_length=80)
    version: int = Field(ge=0)
    answer: str = Field(default="", max_length=12000)
    code: str = Field(default="", max_length=50000)
    language: Literal["javascript", "python"] = "javascript"
    latency_ms: int = Field(default=0, ge=0, le=86400000)
    skipped: bool = False
    delivery: DeliveryObservation | None = None
    coding_observation: CodingObservation | None = None


def owned_session(db, session_id, user):
    if not ObjectId.is_valid(session_id):
        raise HTTPException(404, "Session not found")
    session = db.interview_sessions.find_one(
        {"_id": ObjectId(session_id), "user_id": str(user["_id"]), "engine_version": 2}
    )
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@router.get("/domains")
def domains():
    return {
        "domains": DOMAINS, "coding_domains": CODING_DOMAINS,
        "coding_runner_configured": bool(execution_endpoint()),
    }


@router.post("/start", status_code=201)
def start(body: StartRequest, db=Depends(get_db), user=Depends(require_user)):
    if not body.save_consent:
        raise HTTPException(
            400,
            "Consent to save this interview is required. You can delete it from your report.",
        )
    if body.domain not in DOMAINS:
        raise HTTPException(400, "Unsupported domain")
    persona = "technical" if body.persona == "tech" else body.persona
    if body.coding_practice and (persona != "technical" or body.domain not in CODING_DOMAINS):
        raise HTTPException(400, "Hands-on coding is unavailable for this track and domain.")
    resume = next(
        iter(db.resumes.find({"user_id": str(user["_id"])}).sort("_id", -1).limit(1)),
        None,
    )
    previous = next(iter(db.interview_sessions.find({
        "user_id": str(user["_id"]), "engine_version": 2,
        "domain": body.domain, "persona": persona,
    }).sort("_id", -1).limit(1)), None)
    variant = previous.get("question_variant", 0) + 1 if previous else 0
    questions = make_questions(
        body.domain, persona, resume, body.experience_level, variant, body.coding_practice
    )
    session = {
        "user_id": str(user["_id"]),
        "engine_version": 2,
        "name": body.name.strip() or user["name"],
        "domain": body.domain,
        "experience": body.experience,
        "experience_level": body.experience_level,
        "question_variant": variant,
        "persona": persona,
        "mode": body.mode,
        "response_mode": body.response_mode,
        "coding_practice": body.coding_practice,
        "questions": [spoken_question(q) if body.response_mode == "voice" else q
                      for q in questions],
        "answers": [],
        "index": 0,
        "version": 0,
        "ability": {},
        "status": "active",
        "save_consent": True,
        "allow_ai": body.allow_ai,
        "created_at": now(),
    }
    session["_id"] = db.interview_sessions.insert_one(session).inserted_id
    return public_session(session)


def session_summary(session):
    summary = public_session(session)
    for field in ("answers", "current_question", "ability"):
        summary.pop(field, None)
    summary["overall_score"] = compile_report(session)["overall_score"]
    return summary


@router.post("/{session_id}/voice")
def enable_voice(session_id: str, db=Depends(get_db), user=Depends(require_user)):
    """Enable speech on older sessions while preserving hands-on coding prompts."""
    session = owned_session(db, session_id, user)
    if session.get("response_mode") == "voice" or session["status"] != "active":
        return public_session(session)
    patch = {"response_mode": "voice", "version": session["version"] + 1,
             "questions": [spoken_question(q) if i >= session["index"] else q
                           for i, q in enumerate(session["questions"])]}
    result = db.interview_sessions.update_one(
        {"_id": session["_id"], "version": session["version"], "status": "active"}, {"$set": patch})
    if not result.modified_count:
        current = owned_session(db, session_id, user)
        if current.get("response_mode") == "voice":
            return public_session(current)
        raise HTTPException(409, "The interview changed. Reopen it to continue.")
    session.update(patch)
    return public_session(session)


@router.get("/sessions")
def sessions(db=Depends(get_db), user=Depends(require_user)):
    return [
        session_summary(s)
        for s in db.interview_sessions.find(
            {"user_id": str(user["_id"]), "engine_version": 2}
        )
        .sort("_id", -1)
        .limit(100)
    ]


@router.post("/answer")
def answer(body: AnswerRequest, db=Depends(get_db), user=Depends(require_user)):
    session = owned_session(db, body.session_id, user)
    if any(a["request_id"] == body.request_id for a in session["answers"]):
        return public_session(session)
    if session["status"] != "active":
        raise HTTPException(409, "Interview is already completed")
    question = session["questions"][session["index"]]
    question["evaluation_kind"] = "technical" if question["type"] == "spoken" else evaluation_kind(
        question["round"], session["domain"], session["persona"]
    )
    if body.version != session["version"] or body.question_id != question["id"]:
        raise HTTPException(
            409, "This question has already changed. Reload the interview."
        )
    hands_on = question.get("hands_on", False)
    if hands_on and not body.skipped:
        if not body.code.strip() or len(body.code) > 12000 or body.answer or body.delivery:
            raise HTTPException(422, "Submit up to 12,000 characters of code for this exercise.")
    elif not body.skipped and body.coding_observation is not None:
        raise HTTPException(422, "Coding observations apply only to a hands-on exercise.")
    if session.get("response_mode") == "voice" and not body.skipped and not hands_on:
        if not body.delivery or not body.delivery.transcript.strip():
            raise HTTPException(422, "A spoken answer is required. Enable the microphone and try again.")
        if body.answer.strip() != body.delivery.transcript.strip() or body.code:
            raise HTTPException(422, "Voice interviews accept the recognized spoken answer only.")
    if not body.skipped and not hands_on and (
        not body.answer.strip()
        or (question["type"] == "coding" and not body.code.strip())
    ):
        raise HTTPException(
            422,
            "Enter an answer and, for coding questions, your code; or skip this question.",
        )
    if body.skipped:
        evaluation = {
            "communication_score": None,
            "correctness_score": None,
            "source": "skipped",
            "feedback": "Question skipped; no evaluation assigned.",
            "evidence": {},
            "code_result": None,
            "mistake_tag": None,
        }
    elif hands_on:
        evaluation = evaluate_code(question, body.code, body.language, session.get("allow_ai", False))
        evaluation["coding_observation"] = coding_feedback(body.coding_observation)
    else:
        code_result = (
            run_problem(question["problem_id"], body.code, body.language)
            if question["type"] == "coding" else None
        )
        evaluation = evaluate_answer(
            question,
            body.answer.strip(),
            body.latency_ms,
            session.get("allow_ai", False),
            code_result,
        )
        evaluation["delivery"] = delivery_feedback(body.delivery, body.answer.strip())
    entry = {
        "question_id": question["id"],
        "question": question["prompt"],
        "round": question["round"],
        "hands_on": hands_on,
        "answer": body.answer.strip() if not body.skipped else "",
        "code": body.code if not body.skipped else "",
        "language": body.language,
        "skipped": body.skipped,
        "request_id": body.request_id,
        "latency_ms": body.latency_ms,
        "evaluation": evaluation,
        "submitted_at": now(),
    }
    session["answers"].append(entry)
    session["index"] += 1
    session["version"] += 1
    if not body.skipped:
        old = session["ability"].get(question["round"], 0.5)
        measured = (
            evaluation["correctness_score"]
            if question["evaluation_kind"] in ("technical", "coding")
            else evaluation["communication_score"]
        )
        if measured is not None:
            session["ability"][question["round"]] = round(
                0.6 * old + 0.4 * measured / 100, 3
            )
    if session["index"] == len(session["questions"]):
        session.update(status="completed", completed_at=now())
    else:
        next_q = session["questions"][session["index"]]
        estimate = session["ability"].get(next_q["round"])
        if next_q["round"] == "technical" and estimate is not None:
            if estimate >= 0.7:
                set_question_depth(next_q, "hard")
            elif estimate < 0.4:
                set_question_depth(next_q, "easy")
    patch = {k: v for k, v in session.items() if k != "_id"}
    updated = db.interview_sessions.update_one(
        {"_id": session["_id"], "version": body.version, "status": "active"},
        {"$set": patch},
    )
    if updated.modified_count != 1:
        raise HTTPException(
            409, "Another answer was saved first. Reload the interview."
        )
    return public_session(session)


@router.get("/{session_id}/feedback")
def feedback(session_id: str, db=Depends(get_db), user=Depends(require_user)):
    return compile_report(owned_session(db, session_id, user))


@router.post("/{session_id}/complete")
def complete(session_id: str, db=Depends(get_db), user=Depends(require_user)):
    session = owned_session(db, session_id, user)
    if session["status"] == "active":
        patch = {
            "status": "completed",
            "completed_at": now(),
            "version": session["version"] + 1,
        }
        result = db.interview_sessions.update_one(
            {"_id": session["_id"], "version": session["version"]}, {"$set": patch}
        )
        if result.modified_count != 1:
            raise HTTPException(409, "Session changed. Reload before completing.")
        session.update(patch)
    return public_session(session)


@router.delete("/{session_id}")
def delete(session_id: str, db=Depends(get_db), user=Depends(require_user)):
    session = owned_session(db, session_id, user)
    db.interview_sessions.delete_one(
        {"_id": session["_id"], "user_id": str(user["_id"])}
    )
    db.integrity_logs.delete_many(
        {"session_id": session_id, "user_id": str(user["_id"])}
    )
    return {"deleted": True}


@router.get("/{session_id}")
def get_session(session_id: str, db=Depends(get_db), user=Depends(require_user)):
    return public_session(owned_session(db, session_id, user))

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
)
from app.safe_execution import run_problem
from app.delivery import DeliveryObservation, delivery_feedback

router = APIRouter(prefix="/interview", tags=["interview"])


class StartRequest(BaseModel):
    name: str = Field(default="", max_length=120)
    domain: str = "Software Engineering"
    experience: str = Field(default="", max_length=200)
    persona: Literal["hr", "tech", "technical"] = "technical"
    mode: Literal["practice", "assessment"] = "practice"
    save_consent: bool = False
    allow_ai: bool = False


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
    return {"domains": DOMAINS}


@router.post("/start", status_code=201)
def start(body: StartRequest, db=Depends(get_db), user=Depends(require_user)):
    if not body.save_consent:
        raise HTTPException(
            400,
            "Consent to save this interview is required. You can delete it from your report.",
        )
    if body.domain not in DOMAINS:
        raise HTTPException(400, "Unsupported domain")
    resume = next(
        iter(db.resumes.find({"user_id": str(user["_id"])}).sort("_id", -1).limit(1)),
        None,
    )
    persona = "technical" if body.persona == "tech" else body.persona
    session = {
        "user_id": str(user["_id"]),
        "engine_version": 2,
        "name": body.name.strip() or user["name"],
        "domain": body.domain,
        "experience": body.experience,
        "persona": persona,
        "mode": body.mode,
        "questions": make_questions(body.domain, persona, resume),
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
    question["evaluation_kind"] = evaluation_kind(
        question["round"], session["domain"], session["persona"]
    )
    if body.version != session["version"] or body.question_id != question["id"]:
        raise HTTPException(
            409, "This question has already changed. Reload the interview."
        )
    if not body.skipped and (
        not body.answer.strip()
        or (question["type"] == "coding" and not body.code.strip())
    ):
        raise HTTPException(
            422,
            "Enter an answer and, for coding questions, your code; or skip this question.",
        )
    code_result = None
    if question["type"] == "coding" and not body.skipped:
        code_result = run_problem(question["problem_id"], body.code, body.language)
    evaluation = (
        {
            "communication_score": None,
            "correctness_score": None,
            "source": "skipped",
            "feedback": "Question skipped; no evaluation assigned.",
            "evidence": {},
            "code_result": None,
            "mistake_tag": None,
        }
        if body.skipped
        else evaluate_answer(
            question,
            body.answer.strip(),
            body.latency_ms,
            session.get("allow_ai", False),
            code_result,
        )
    )
    if not body.skipped:
        evaluation["delivery"] = delivery_feedback(body.delivery, body.answer.strip())
    entry = {
        "question_id": question["id"],
        "question": question["prompt"],
        "round": question["round"],
        "answer": body.answer.strip(),
        "code": body.code,
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
        estimate = session["ability"].get(next_q["round"], 0.5)
        next_q["difficulty"] = (
            "hard" if estimate >= 0.7 else "easy" if estimate < 0.4 else "medium"
        )
        if next_q["round"] == "technical":
            next_q["prompt"] += (
                " Discuss a trade-off and failure mode."
                if estimate >= 0.7
                else (
                    " Start with the core idea and one example."
                    if estimate < 0.4
                    else ""
                )
            )
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

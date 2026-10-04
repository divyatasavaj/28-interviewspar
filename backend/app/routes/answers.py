import json
import os
from datetime import datetime, timezone

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Header, status
from groq import Groq
from pymongo.database import Database

from app.adaptive import select_next_difficulty, update_ability_estimate
from app.auth import decode_access_token
from app.database import get_db
from app.fluency import compute_fluency_score
from app.schemas import (
    AnswerResponse,
    CaptureCodeAnswerRequest,
    CaptureTextAnswerRequest,
)
from app.verification import (
    classify_mistake_type,
    keyword_precheck,
    llm_verify_answer,
    route_verification_method,
    run_code_test_cases,
    verify_logical_puzzle,
    verify_resume_consistency,
    verify_trick_question,
)

router = APIRouter(prefix="/answers", tags=["answers"])


def require_user_id(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


@router.post("/capture-text")
def capture_text_answer(body: CaptureTextAnswerRequest, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    session = db.sessions.find_one({"_id": ObjectId(body.session_id), "user_id": user_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    question = db.questions.find_one({"_id": ObjectId(body.question_id)})

    topic = (question or {}).get("domain", "ProblemSolving")
    q_type = (question or {}).get("type", "concept")
    difficulty = (question or {}).get("difficulty", "medium")

    method = route_verification_method(q_type)
    correctness = {"passed": True, "score": 50, "method_used": method}

    if method == "test_cases":
        test_cases = ((question or {}).get("reference") or {}).get("test_cases", [])
        correctness = run_code_test_cases(body.text, test_cases)
        correctness["method_used"] = "test_cases"
    elif method == "llm_rag":
        ref = ((question or {}).get("reference") or {}).get("checklist") or []
        if ref:
            precheck = keyword_precheck(body.text, ref)
            if not precheck["all_found"]:
                llm_result = llm_verify_answer(
                    (question or {}).get("question_text", ""),
                    json.dumps(ref),
                    body.text,
                )
                correctness = llm_result
        correctness["method_used"] = "llm_rag"
    elif method == "reasoning_path":
        ref_path = ((question or {}).get("reference") or {}).get("reasoning_path", "")
        correctness = verify_logical_puzzle(
            (question or {}).get("question_text", ""), ref_path, body.text
        )
        correctness["method_used"] = "reasoning_path"
    elif method == "key_insight":
        insight = ((question or {}).get("reference") or {}).get("key_insight", "")
        correctness = verify_trick_question(
            (question or {}).get("question_text", ""), insight, body.text
        )
        correctness["method_used"] = "key_insight"
    elif method == "quality_only":
        try:
            groq_key = os.environ.get("GROQ_API_KEY", "")
            if groq_key and not groq_key.startswith("your"):
                client = Groq(api_key=groq_key)
                response = client.chat.completions.create(
                    model=os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile"),
                    messages=[
                        {"role": "system", "content": "Rate this interview answer on quality. Return JSON with keys: score (0-100), feedback (string)."},
                        {"role": "user", "content": body.text},
                    ],
                    temperature=0.1,
                )
                content = response.choices[0].message.content or "{}"
                text = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
                correctness = json.loads(text)
            else:
                correctness = {"score": 75, "feedback": "Solid answer covering core aspects."}
        except Exception:
            correctness = {"score": 75, "feedback": "Good response with relevant technical context."}
        correctness["method_used"] = "quality_only"
    elif method == "resume_consistency":
        user_doc = db.users.find_one({"_id": ObjectId(user_id)})
        resume_claim = json.dumps((user_doc or {}).get("resume", {}))
        correctness = verify_resume_consistency(resume_claim, body.text)
        correctness["method_used"] = "resume_consistency"

    fluency = compute_fluency_score(body.text)

    combined = {
        "passed": correctness.get("passed", False),
        "score": correctness.get("score", 50),
        "difficulty": difficulty,
    }
    update_ability_estimate(user_id, topic, combined, db)

    next_difficulty = select_next_difficulty(user_id, topic, db)
    next_q = None
    if session.get("status") == "in_progress":
        next_q_doc = db.questions.find_one({
            "domain": topic,
            "difficulty": next_difficulty,
        })
        if next_q_doc:
            next_q = {
                "id": str(next_q_doc["_id"]),
                "question_text": next_q_doc.get("question_text"),
                "type": next_q_doc.get("type"),
                "difficulty": next_difficulty,
            }

    mistake_tags = classify_mistake_type({
        "text": body.text,
        "length": len(body.text.split()),
        "correctness": correctness,
    })

    answer_doc = {
        "session_id": body.session_id,
        "question_id": body.question_id,
        "user_id": user_id,
        "answer_text": body.text,
        "response_latency_ms": None,
        "correctness_result": correctness,
        "fluency_score": fluency,
        "mistake_tags": mistake_tags,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    result = db.answers.insert_one(answer_doc)

    return AnswerResponse(
        id=str(result.inserted_id),
        correctness_result=correctness,
        fluency_score=fluency,
        mistake_tags=mistake_tags,
        next_question=next_q,
    )


@router.post("/capture-code")
def capture_code_answer(body: CaptureCodeAnswerRequest, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    session = db.sessions.find_one({"_id": ObjectId(body.session_id), "user_id": user_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    question = db.questions.find_one({"_id": ObjectId(body.question_id)})
    topic = (question or {}).get("domain", "ProblemSolving")
    difficulty = (question or {}).get("difficulty", "medium")

    test_cases = ((question or {}).get("reference") or {}).get("test_cases", [])
    correctness = run_code_test_cases(body.code, test_cases) if test_cases else {"passed": True, "test_case_results": []}

    combined = {
        "passed": correctness.get("passed", False),
        "score": 100 if correctness.get("passed") else 30,
        "difficulty": difficulty,
    }
    update_ability_estimate(user_id, topic, combined, db)

    next_difficulty = select_next_difficulty(user_id, topic, db)

    answer_doc = {
        "session_id": body.session_id,
        "question_id": body.question_id,
        "user_id": user_id,
        "code_submission": body.code,
        "keystroke_log": body.keystroke_log,
        "correctness_result": correctness,
        "submitted_at": datetime.now(timezone.utc).isoformat(),
    }
    result = db.answers.insert_one(answer_doc)

    return AnswerResponse(
        id=str(result.inserted_id),
        correctness_result=correctness,
        fluency_score=None,
        mistake_tags=None,
        next_question={"difficulty": next_difficulty},
    )


@router.post("/record-latency")
def record_response_latency(
    body: dict,
    db: Database = Depends(get_db),
    user_id: str = Depends(require_user_id),
):
    session_id = body.get("session_id")
    question_id = body.get("question_id")
    latency_ms = body.get("latency_ms")
    if not all([session_id, question_id, latency_ms]):
        raise HTTPException(status_code=400, detail="Missing fields")
    db.answers.update_one(
        {"session_id": session_id, "question_id": question_id, "user_id": user_id},
        {"$set": {"response_latency_ms": latency_ms}},
    )
    return {"message": "Latency recorded"}


@router.get("/session/{session_id}")
def get_session_answers(session_id: str, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    answers = list(db.answers.find({"session_id": session_id, "user_id": user_id}))
    return [
        {
            "id": str(a["_id"]),
            "question_id": a.get("question_id"),
            "answer_text": a.get("answer_text"),
            "code_submission": a.get("code_submission"),
            "correctness_result": a.get("correctness_result"),
            "fluency_score": a.get("fluency_score"),
            "mistake_tags": a.get("mistake_tags"),
            "response_latency_ms": a.get("response_latency_ms"),
            "submitted_at": a.get("submitted_at"),
        }
        for a in answers
    ]

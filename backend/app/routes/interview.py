import json
import os

from fastapi import APIRouter, Depends, HTTPException, Header, status
from groq import Groq
from pymongo.database import Database

from app.auth import decode_access_token
from app.database import get_db
from app.schemas import AnswerRequest, AnswerSimpleResponse, InterviewFeedbackResponse, StartInterviewResponse

router = APIRouter(prefix="/interview", tags=["interview"])

MAX_QUESTIONS = 6
GROQ_MODEL = "openai/gpt-oss-20b"
GEMINI_MODEL = "gemini-2.0-flash"


def require_token(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


def build_start_system_prompt(interview_type: str, resume_text: str) -> str:
    resume_json = _extract_json(resume_text)

    if interview_type == "hr":
        return (
            "You are a professional HR interviewer conducting a behavioral interview. "
            "You have the candidate's resume below. Your job is to ask one focused, specific question at a time. "
            "Start with an opening question that references a real detail from their resume "
            "(e.g. a past role, project, or skill). Do NOT ask multiple questions at once. "
            "Keep your tone friendly but professional.\n\n"
            f"Candidate's Resume:\n{resume_json}"
        )
    else:
        return (
            "You are a senior technical interviewer conducting a technical interview. "
            "You have the candidate's resume below. Your job is to ask one focused, specific technical question at a time. "
            "Start with an opening question that references a real detail from their resume "
            "(e.g. a technology they listed, a project they built, or a past role). "
            "Do NOT ask multiple questions at once. Keep questions challenging but fair.\n\n"
            f"Candidate's Resume:\n{resume_json}"
        )


def build_followup_system_prompt(interview_type: str) -> str:
    base = "You are continuing an interview. "
    if interview_type == "hr":
        base += (
            "Reference a specific detail from the candidate's last answer and challenge or probe it. "
            "Ask exactly one focused follow-up question. Do NOT ask generic questions like 'Tell me more'."
        )
    else:
        base += (
            "Reference a specific technical detail from the candidate's last answer and probe deeper. "
            "Ask exactly one focused follow-up question. Challenge their reasoning or ask about trade-offs."
        )
    return base


def _extract_json(text: str) -> str:
    if isinstance(text, dict):
        return json.dumps(text, indent=2)
    try:
        parsed = json.loads(text)
        return json.dumps(parsed, indent=2)
    except (json.JSONDecodeError, TypeError):
        return str(text)


def _count_questions(messages: list) -> int:
    return sum(1 for m in messages if m["role"] == "assistant")


def call_groq(messages: list) -> str:
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=0.7,
    )
    content = response.choices[0].message.content
    if not content:
        raise ValueError("Groq returned empty response")
    return content.strip()


def call_gemini(messages: list) -> str:
    import google.generativeai as genai

    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel(GEMINI_MODEL)

    system_msg = None
    history = []
    for m in messages:
        if m["role"] == "system":
            system_msg = m["content"]
        elif m["role"] == "user":
            history.append({"role": "user", "parts": [m["content"]]})
        elif m["role"] == "assistant":
            history.append({"role": "model", "parts": [m["content"]]})

    chat = model.start_chat(history=history[:-1] if history else [])
    last_user_content = history[-1]["parts"][0] if history else ""

    prompt = f"{system_msg}\n\n{last_user_content}" if system_msg else last_user_content
    response = chat.send_message(prompt)
    return response.text.strip()


def generate_response(messages: list) -> str:
    try:
        return call_groq(messages)
    except Exception as groq_err:
        gemini_key = os.environ.get("GEMINI_API_KEY")
        if gemini_key:
            try:
                return call_gemini(messages)
            except Exception as gemini_err:
                raise HTTPException(
                    status_code=502,
                    detail=f"Groq failed: {groq_err}. Gemini fallback also failed: {gemini_err}",
                )
        raise HTTPException(status_code=502, detail=f"Groq API error: {groq_err}")


@router.post("/start", status_code=status.HTTP_201_CREATED)
def start_interview(
    body: dict,
    db: Database = Depends(get_db),
    user_id: str = Depends(require_token),
):
    interview_type = body.get("interview_type")
    if interview_type not in ("hr", "technical"):
        raise HTTPException(status_code=400, detail="interview_type must be 'hr' or 'technical'")

    resume = (
        db.resumes
        .find({"user_id": user_id})
        .sort("_id", -1)
        .limit(1)
    )
    try:
        r = next(resume)
    except StopIteration:
        raise HTTPException(status_code=400, detail="Upload a resume before starting an interview")

    resume_data = r.get("parsed_data") or r.get("raw_text", "")
    system_prompt = build_start_system_prompt(interview_type, resume_data)

    messages = [{"role": "system", "content": system_prompt}]
    question = generate_response(messages)

    conversation = [
        {"role": "assistant", "content": question},
    ]

    session = {
        "user_id": user_id,
        "interview_type": interview_type,
        "resume_data": resume_data if isinstance(resume_data, str) else json.dumps(resume_data),
        "messages": conversation,
        "status": "active",
        "feedback": None,
    }
    result = db.interview_sessions.insert_one(session)

    return StartInterviewResponse(session_id=str(result.inserted_id), question=question)


@router.post("/answer")
def answer_question(
    body: AnswerRequest,
    db: Database = Depends(get_db),
    user_id: str = Depends(require_token),
):
    from bson.objectid import ObjectId

    session = db.interview_sessions.find_one(
        {"_id": ObjectId(body.session_id), "user_id": user_id}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session["status"] != "active":
        raise HTTPException(status_code=400, detail="Session is already completed")

    messages: list = session.get("messages", [])
    messages.append({"role": "user", "content": body.answer})

    questions_so_far = _count_questions(messages)

    words = body.answer.split()
    confidence_score = min(95, max(20, len(words) * 2 + 30 +
        (10 if any(w in body.answer.lower() for w in ("i believe", "i think", "confident", "sure")) else 0) -
        (15 if any(w in body.answer.lower() for w in ("maybe", "not sure", "i don't know", "unsure")) else 0)))
    fluency_score = round(max(0.3, min(1.0, 1.0 - (body.answer.lower().count("um") + body.answer.lower().count("uh")) * 0.05 - len(words) * 0.001)), 2)

    if questions_so_far >= MAX_QUESTIONS:
        db.interview_sessions.update_one(
            {"_id": ObjectId(body.session_id)},
            {"$set": {"status": "completed", "messages": messages}}
        )
        return AnswerSimpleResponse(question=None, status="completed",
            confidence_score=confidence_score, fluency_score=fluency_score)

    system_prompt = build_followup_system_prompt(session["interview_type"])
    api_messages = [{"role": "system", "content": system_prompt}, *messages]
    next_question = generate_response(api_messages)

    messages.append({"role": "assistant", "content": next_question})

    questions_after = _count_questions(messages)
    if questions_after >= MAX_QUESTIONS:
        db.interview_sessions.update_one(
            {"_id": ObjectId(body.session_id)},
            {"$set": {"status": "completed", "messages": messages}}
        )
        return AnswerSimpleResponse(question=None, status="completed",
            confidence_score=confidence_score, fluency_score=fluency_score)

    db.interview_sessions.update_one(
        {"_id": ObjectId(body.session_id)},
        {"$set": {"messages": messages}}
    )
    return AnswerSimpleResponse(question=next_question, status="active",
        confidence_score=confidence_score, fluency_score=fluency_score)


@router.get("/sessions")
def list_sessions(
    db: Database = Depends(get_db),
    user_id: str = Depends(require_token),
):
    sessions = (
        db.interview_sessions
        .find({"user_id": user_id})
        .sort("_id", -1)
    )
    return [
        {
            "id": str(s["_id"]),
            "interview_type": s["interview_type"],
            "status": s["status"],
            "created_at": str(s["_id"].generation_time),
        }
        for s in sessions
    ]


FEEDBACK_SYSTEM_PROMPT = (
    "You are an expert interview coach. Analyze the following interview transcript "
    "and return ONLY valid JSON with no markdown formatting or extra text. "
    "The JSON must have these exact keys:\n"
    '"overall_score" (integer 0-100),\n'
    '"strengths" (array of strings describing what the candidate did well),\n'
    '"weaknesses" (array of strings describing areas of improvement),\n'
    '"rambling_detected" (boolean — true if the candidate gave overly long, unfocused answers),\n'
    '"weak_claims" (array of objects with "claim" and "why_weak" for any unsupported or vague claims made),\n'
    '"suggested_improvements" (array of strings with actionable advice).\n'
    "Be honest and constructive. Base your analysis solely on the actual transcript."
)


def generate_feedback(messages: list) -> dict:
    transcript = []
    for m in messages:
        if m["role"] in ("user", "assistant"):
            label = "Candidate" if m["role"] == "user" else "Interviewer"
            transcript.append(f"{label}: {m['content']}")

    prompt = (
        "Here is the full interview transcript:\n\n"
        + "\n\n".join(transcript)
        + "\n\nReturn the analysis as JSON."
    )

    api_messages = [
        {"role": "system", "content": FEEDBACK_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]

    text = generate_response(api_messages)
    text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(text)


@router.get("/{session_id}/feedback")
def get_feedback(
    session_id: str,
    db: Database = Depends(get_db),
    user_id: str = Depends(require_token),
):
    from bson.objectid import ObjectId

    session = db.interview_sessions.find_one(
        {"_id": ObjectId(session_id), "user_id": user_id}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.get("feedback"):
        return session["feedback"]

    if session["status"] != "completed":
        raise HTTPException(status_code=400, detail="Session is not yet completed")

    messages: list = session.get("messages", [])
    qa_pairs = []
    for i, m in enumerate(messages):
        if m["role"] == "assistant":
            answer_text = ""
            if i + 1 < len(messages) and messages[i + 1]["role"] == "user":
                answer_text = messages[i + 1]["content"]
            qa_pairs.append({
                "question_number": len(qa_pairs) + 1,
                "question": m["content"],
                "answer": answer_text,
            })

    try:
        feedback = generate_feedback(messages)
        feedback["qa_pairs"] = qa_pairs
        InterviewFeedbackResponse(**feedback)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate feedback: {str(e)}"
        )

    db.interview_sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"feedback": feedback}}
    )
    return feedback

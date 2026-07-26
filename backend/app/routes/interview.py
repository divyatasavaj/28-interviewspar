import json
import os

from fastapi import APIRouter, Depends, HTTPException, Header, status
from groq import Groq
from sqlalchemy.orm import Session

from app.auth import decode_access_token
from app.database import get_db
from app.models import InterviewSession, Resume
from app.schemas import AnswerRequest, AnswerResponse, FeedbackResponse, StartInterviewResponse

router = APIRouter(prefix="/interview", tags=["interview"])

MAX_QUESTIONS = 6
GROQ_MODEL = "openai/gpt-oss-20b"
GEMINI_MODEL = "gemini-2.0-flash"


def require_token(authorization: str = Header(...)) -> int:
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
    try:
        parsed = json.loads(text)
        return json.dumps(parsed, indent=2)
    except json.JSONDecodeError:
        return text


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
    db: Session = Depends(get_db),
    user_id: int = Depends(require_token),
):
    interview_type = body.get("interview_type")
    if interview_type not in ("hr", "technical"):
        raise HTTPException(status_code=400, detail="interview_type must be 'hr' or 'technical'")

    resume = (
        db.query(Resume)
        .filter(Resume.user_id == user_id)
        .order_by(Resume.uploaded_at.desc())
        .first()
    )
    if not resume:
        raise HTTPException(status_code=400, detail="Upload a resume before starting an interview")

    resume_data = resume.parsed_data or resume.raw_text
    system_prompt = build_start_system_prompt(interview_type, resume_data)

    messages = [{"role": "system", "content": system_prompt}]
    question = generate_response(messages)

    conversation = [
        {"role": "assistant", "content": question},
    ]

    session = InterviewSession(
        user_id=user_id,
        interview_type=interview_type,
        resume_data=resume_data,
        messages=json.dumps(conversation),
        status="active",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    return StartInterviewResponse(session_id=session.id, question=question)


@router.post("/answer")
def answer_question(
    body: AnswerRequest,
    db: Session = Depends(get_db),
    user_id: int = Depends(require_token),
):
    session = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.id == body.session_id,
            InterviewSession.user_id == user_id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.status != "active":
        raise HTTPException(status_code=400, detail="Session is already completed")

    messages: list = json.loads(session.messages)
    messages.append({"role": "user", "content": body.answer})

    questions_so_far = _count_questions(messages)

    if questions_so_far >= MAX_QUESTIONS:
        session.status = "completed"
        session.messages = json.dumps(messages)
        db.commit()
        return AnswerResponse(question=None, status="completed")

    system_prompt = build_followup_system_prompt(session.interview_type)
    api_messages = [{"role": "system", "content": system_prompt}, *messages]
    next_question = generate_response(api_messages)

    messages.append({"role": "assistant", "content": next_question})
    session.messages = json.dumps(messages)
    db.commit()

    questions_after = _count_questions(messages)
    if questions_after >= MAX_QUESTIONS:
        session.status = "completed"
        db.commit()
        return AnswerResponse(question=None, status="completed")

    return AnswerResponse(question=next_question, status="active")


@router.get("/sessions")
def list_sessions(
    db: Session = Depends(get_db),
    user_id: int = Depends(require_token),
):
    sessions = (
        db.query(InterviewSession)
        .filter(InterviewSession.user_id == user_id)
        .order_by(InterviewSession.created_at.desc())
        .all()
    )
    return [
        {
            "id": s.id,
            "interview_type": s.interview_type,
            "status": s.status,
            "created_at": s.created_at.isoformat(),
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
    session_id: int,
    db: Session = Depends(get_db),
    user_id: int = Depends(require_token),
):
    session = (
        db.query(InterviewSession)
        .filter(
            InterviewSession.id == session_id,
            InterviewSession.user_id == user_id,
        )
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.feedback:
        return json.loads(session.feedback)

    if session.status != "completed":
        raise HTTPException(status_code=400, detail="Session is not yet completed")

    messages = json.loads(session.messages)
    try:
        feedback = generate_feedback(messages)
        FeedbackResponse(**feedback)
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate feedback: {str(e)}"
        )

    session.feedback = json.dumps(feedback)
    db.commit()

    return feedback

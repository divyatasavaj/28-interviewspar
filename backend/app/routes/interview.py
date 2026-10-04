import json
import os
import re

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Header, status
from groq import Groq
from pymongo.database import Database

from app.auth import decode_access_token
from app.database import get_db
from app.schemas import AnswerRequest, AnswerSimpleResponse, InterviewFeedbackResponse, StartInterviewResponse

router = APIRouter(prefix="/interview", tags=["interview"])

MAX_QUESTIONS = 6
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GEMINI_MODEL = "gemini-2.0-flash"

CURATED_TECHNICAL_QUESTIONS = [
    "To begin, could you explain the differences between processes and threads, and how memory is shared between them in modern operating systems?",
    "When designing an API endpoint that handles high traffic with sudden spikes, what strategies would you use for rate limiting and caching to safeguard the underlying database?",
    "Can you explain how indexing works internally in relational and document databases, and what trade-offs you consider when adding composite indexes?",
    "Walk me through a challenging technical bug or performance bottleneck you diagnosed and resolved recently. What was your systematic debugging process?",
    "If you were asked to architect a distributed URL shortening service (like Bitly), what would your high-level architecture, data model, and hashing approach look like?",
    "How do you approach monitoring, structured logging, and distributed tracing in production to ensure high availability and catch regressions early?",
]

CURATED_HR_QUESTIONS = [
    "Welcome to the interview! To get started, could you introduce yourself and walk me through your key background, projects, and what drives you as an engineer?",
    "Can you share an experience where you had a strong technical disagreement with a teammate or stakeholder? How did you approach the conversation and reach a resolution?",
    "Tell me about a high-stakes project where the scope or deadlines changed unexpectedly midway through. How did you prioritize and execute?",
    "What has been the most significant mistake or failure you experienced in a recent engineering project, and what concrete lesson did you take away from it?",
    "How do you stay updated with emerging technologies and balance adopting modern tools versus sticking with proven, stable solutions?",
    "Where do you see your career heading over the next two to three years, and what type of engineering culture brings out your best work?",
]


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


def get_smart_fallback_question(messages: list, interview_type: str = "technical") -> str:
    """Provides dynamic, context-aware interview questions when AI API keys are offline."""
    q_count = _count_questions(messages)
    bank = CURATED_HR_QUESTIONS if interview_type == "hr" else CURATED_TECHNICAL_QUESTIONS

    if q_count < len(bank):
        # If there was a previous candidate answer, create an insightful probe
        last_user_msg = next((m["content"] for m in reversed(messages) if m["role"] == "user"), None)
        if last_user_msg and len(last_user_msg.split()) > 10 and q_count in (1, 3):
            # Extract a key phrase for natural conversational context
            words = [w for w in re.findall(r"\b[A-Za-z]{4,}\b", last_user_msg) if w.lower() not in {"this", "that", "with", "have", "from", "they", "been"}]
            keyword = words[0] if words else "your approach"
            if interview_type == "technical":
                return f"You highlighted your experience regarding {keyword}. What were the primary trade-offs or scalability constraints you considered with that decision?"
            else:
                return f"Reflecting on what you shared about {keyword}, how did you ensure clear communication and alignment across all involved stakeholders?"

        return bank[q_count]

    return "Thank you for sharing your insights today. Do you have any closing questions for me about the team or technical challenges we are solving?"


def generate_response(messages: list, interview_type: str = "technical") -> str:
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if groq_key and not groq_key.startswith("your"):
        try:
            return call_groq(messages)
        except Exception as e:
            print(f"Groq generation failed: {e}")

    gemini_key = os.environ.get("GEMINI_API_KEY", "")
    if gemini_key and not gemini_key.startswith("your"):
        try:
            return call_gemini(messages)
        except Exception as e:
            print(f"Gemini generation failed: {e}")

    return get_smart_fallback_question(messages, interview_type)


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
        resume_data = r.get("parsed_data") or r.get("raw_text", "")
    except StopIteration:
        # Graceful fallback: If user hasn't uploaded a resume, proceed with standard candidate baseline
        resume_data = {
            "skills": ["JavaScript", "Python", "React", "Node.js", "SQL", "Git", "REST APIs", "Problem Solving"],
            "target_role": "Full-Stack Software Engineer",
            "experience": "Software engineering candidate with projects in web development and data structures."
        }

    system_prompt = build_start_system_prompt(interview_type, resume_data)
    messages = [{"role": "system", "content": system_prompt}]
    question = generate_response(messages, interview_type)

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
    next_question = generate_response(api_messages, session["interview_type"])

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


def compute_heuristic_feedback(messages: list) -> dict:
    """Generates an accurate, insightful rubric-based evaluation report from interview metrics."""
    user_answers = [m["content"] for m in messages if m["role"] == "user"]
    total_answers = len(user_answers)

    if total_answers == 0:
        return {
            "overall_score": 50,
            "strengths": ["Attended the interview session"],
            "weaknesses": ["No spoken answers recorded during this attempt"],
            "rambling_detected": False,
            "weak_claims": [],
            "suggested_improvements": ["Speak clearly into the microphone and articulate your answers fully."],
        }

    total_words = sum(len(a.split()) for a in user_answers)
    avg_words = total_words / total_answers
    filler_count = sum(a.lower().count(" um ") + a.lower().count(" uh ") + a.lower().count(" like ") for a in user_answers)

    score = 65
    strengths = []
    weaknesses = []
    suggested_improvements = []

    # Scoring rules
    if avg_words >= 35:
        score += 15
        strengths.append("Provided detailed, substantive responses rather than brief one-word answers")
    elif avg_words >= 15:
        score += 8
        strengths.append("Addressed the core interview questions directly")
    else:
        weaknesses.append("Answers were overly brief; elaborate more on your thought process and past projects")

    if filler_count <= 2:
        score += 10
        strengths.append("High vocal clarity with minimal filler words (um, uh)")
    else:
        score -= 5
        weaknesses.append(f"Noticed repeated filler words ({filler_count} detected)")
        suggested_improvements.append("Pause intentionally instead of using filler words ('um', 'uh') while formulating your next sentence")

    rambling_detected = avg_words > 140

    if rambling_detected:
        score -= 6
        weaknesses.append("Tended to ramble on longer questions without a clear concluding summary")
        suggested_improvements.append("Adopt the STAR framework (Situation, Task, Action, Result) to keep behavioral answers under 2 minutes")
    else:
        strengths.append("Maintained good conversational pacing and answer structure")

    score = max(40, min(95, score))

    suggested_improvements.append("Quantify business impact where possible (e.g. 'reduced latency by 30%', 'scaled to 10k users')")
    suggested_improvements.append("Lead with the architectural solution first before diving into implementation nuances")

    weak_claims = []
    for a in user_answers:
        if any(w in a.lower() for w in ("easy", "always", "best", "simple")):
            weak_claims.append({
                "claim": a[:80] + "..." if len(a) > 80 else a,
                "why_weak": "Broad claim without specific context, metrics, or trade-offs mentioned"
            })
            break

    return {
        "overall_score": score,
        "strengths": strengths or ["Good participation throughout the interview session"],
        "weaknesses": weaknesses or ["Continue practicing to articulate complex edge-cases under pressure"],
        "rambling_detected": rambling_detected,
        "weak_claims": weak_claims,
        "suggested_improvements": suggested_improvements,
    }


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

    try:
        text = generate_response(api_messages)
        text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        data = json.loads(text)
        if isinstance(data, dict) and "overall_score" in data:
            return data
    except Exception as e:
        print(f"AI feedback parsing failed, generating heuristic report: {e}")

    return compute_heuristic_feedback(messages)


@router.get("/{session_id}/feedback")
def get_feedback(
    session_id: str,
    db: Database = Depends(get_db),
    user_id: str = Depends(require_token),
):
    session = db.interview_sessions.find_one(
        {"_id": ObjectId(session_id), "user_id": user_id}
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.get("feedback"):
        return session["feedback"]

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
    except Exception as e:
        feedback = compute_heuristic_feedback(messages)
        feedback["qa_pairs"] = qa_pairs

    db.interview_sessions.update_one(
        {"_id": ObjectId(session_id)},
        {"$set": {"feedback": feedback, "status": "completed"}}
    )
    return feedback

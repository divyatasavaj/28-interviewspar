from fastapi import APIRouter, Depends, HTTPException, status, Header
from pymongo.database import Database
from pydantic import BaseModel
from typing import Optional, List
from bson.objectid import ObjectId
import uuid

from app.database import get_db
from app.auth import decode_access_token
from app.lib.interview import (
    SessionManager, create_session_manager,
    QuestionBank, RoundType, TechnicalRole,
    HRRound, create_hr_round,
    TechnicalRound, create_technical_round,
    ValidationEngine, create_validation_engine
)
from app.lib.interview.question_schema import SessionState, AnswerSubmission


router = APIRouter(prefix="/interview/v2", tags=["interview-v2"])

# In-memory session storage (replace with DB in production)
sessions_db = {}
question_bank = None
validation_engine = None
session_manager = None


def get_validation_engine():
    global validation_engine
    if validation_engine is None:
        validation_engine = create_validation_engine()
    return validation_engine


def get_question_bank():
    global question_bank
    if question_bank is None:
        from app.lib.interview.rounds.hr.questions import get_hr_questions
        from app.lib.interview.rounds.technical import get_theory_questions_for_role, get_challenges_for_role

        all_questions = list(get_hr_questions())
        for role in TechnicalRole:
            all_questions.extend(get_theory_questions_for_role(role))
            all_questions.extend(get_challenges_for_role(role))

        question_bank = QuestionBank(questions=all_questions)
    return question_bank


def get_session_manager():
    global session_manager
    if session_manager is None:
        session_manager = create_session_manager(get_question_bank())
    return session_manager


def require_token(authorization: str = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


class StartInterviewRequest(BaseModel):
    role: TechnicalRole = TechnicalRole.FULLSTACK


class StartInterviewResponse(BaseModel):
    session_id: str
    question: str
    question_id: str
    round: str
    progress: dict


class AnswerRequest(BaseModel):
    session_id: str
    answer: str
    code: Optional[str] = None


class AnswerResponse(BaseModel):
    evaluation: dict
    should_advance: bool
    next_question: Optional[dict] = None
    next_question_id: Optional[str] = None
    round_complete: bool
    session_status: str
    progress: dict
    message: str
    retry_message: Optional[str] = None


class RoleListResponse(BaseModel):
    roles: List[dict]


@router.get("/roles", response_model=RoleListResponse)
def list_roles():
    """Get all available technical roles"""
    from app.lib.interview.rounds.technical.roles import get_all_roles
    roles = get_all_roles()
    return RoleListResponse(roles=[
        {
            "id": r.role.value,
            "display_name": r.display_name,
            "description": r.description,
            "core_skills": r.core_skills,
            "secondary_skills": r.secondary_skills
        }
        for r in roles
    ])


@router.post("/start", response_model=StartInterviewResponse)
def start_interview(
    body: StartInterviewRequest,
    db: Database = Depends(get_db),
    user_id: str = Depends(require_token)
):
    """Start a new interview session"""
    session_id = str(uuid.uuid4())

    # Create session
    sm = get_session_manager()
    session = sm.create_session(
        user_id=user_id,
        session_id=session_id,
        initial_round=RoundType.HR,
        role=body.role
    )

    # Start HR round
    hr_round = create_hr_round(get_validation_engine())
    result = hr_round.start_round(session)

    return StartInterviewResponse(
        session_id=session_id,
        question=result.current_question.prompt if result.current_question else "No questions available",
        question_id=result.current_question.id if result.current_question else "",
        round="hr",
        progress=result.progress
    )


@router.post("/answer", response_model=AnswerResponse)
def submit_answer(
    body: AnswerRequest,
    db: Database = Depends(get_db),
    user_id: str = Depends(require_token)
):
    """Submit an answer for the current question"""
    sm = get_session_manager()
    session = sm.get_session(body.session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized for this session")
    if session.status != "active":
        raise HTTPException(status_code=400, detail=f"Session is {session.status}")

    ve = get_validation_engine()

    if session.current_round == RoundType.HR:
        hr_round = create_hr_round(ve)
        result = hr_round.process_answer(session, body.answer)

        return AnswerResponse(
            evaluation=result.evaluation.model_dump() if result.evaluation else {},
            should_advance=not result.is_complete,
            next_question={"id": result.current_question.id, "prompt": result.current_question.prompt, "type": result.current_question.question_type.value} if result.current_question else None,
            next_question_id=result.current_question.id if result.current_question else None,
            round_complete=result.is_complete,
            session_status=session.status,
            progress=result.progress,
            message=result.message,
            retry_message=result.evaluation.feedback if result.evaluation and not result.evaluation.overall_valid else None
        )

    elif session.current_round == RoundType.TECHNICAL:
        tech_round = create_technical_round(session.current_role, ve)
        result = tech_round.process_answer(session, body.answer, body.code)

        return AnswerResponse(
            evaluation=result.evaluation.model_dump() if result.evaluation else {},
            should_advance=not result.is_complete,
            next_question={"id": result.current_question.id, "prompt": result.current_question.prompt, "type": result.current_question.question_type.value} if result.current_question else None,
            next_question_id=result.current_question.id if result.current_question else None,
            round_complete=result.is_complete,
            session_status=session.status,
            progress=result.progress,
            message=result.message,
            retry_message=result.evaluation.feedback if result.evaluation and not result.evaluation.overall_valid else None
        )

    else:
        raise HTTPException(status_code=400, detail=f"Round {session.current_round} not implemented yet")


@router.get("/session/{session_id}")
def get_session(session_id: str, user_id: str = Depends(require_token)):
    """Get session status and progress"""
    sm = get_session_manager()
    session = sm.get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    current_question = None
    if session.current_round == RoundType.HR:
        from app.lib.interview.rounds.hr import get_hr_question_by_id
        current_question = get_hr_question_by_id(session.current_question_id)
    elif session.current_round == RoundType.TECHNICAL:
        from app.lib.interview.rounds.technical import get_theory_questions_for_role, get_challenges_for_role
        theory_qs = get_theory_questions_for_role(session.current_role)
        coding_qs = get_challenges_for_role(session.current_role)
        all_qs = theory_qs + coding_qs
        for q in all_qs:
            if q.id == session.current_question_id:
                current_question = q
                break

    return {
        "session_id": session.session_id,
        "user_id": session.user_id,
        "current_round": session.current_round.value,
        "current_role": session.current_role.value if session.current_role else None,
        "status": session.status,
        "current_question": {
            "id": current_question.id,
            "prompt": current_question.prompt,
            "type": current_question.question_type.value,
            "difficulty": current_question.difficulty.value
        } if current_question else None,
        "questions_answered": len(session.questions_answered),
        "violations": len(session.violations),
        "started_at": session.started_at.isoformat(),
        "updated_at": session.updated_at.isoformat()
    }


@router.post("/session/{session_id}/complete")
def complete_session(session_id: str, user_id: str = Depends(require_token)):
    """Complete the interview session and generate report"""
    sm = get_session_manager()
    session = sm.get_session(session_id)

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    report = sm.complete_session(session_id)
    session.status = "completed"

    return {
        "session_id": session_id,
        "status": "completed",
        "report": report.model_dump() if report else None
    }

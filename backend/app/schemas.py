from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, EmailStr, field_validator


# ── Auth ──

class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str

    @field_validator("password")
    @classmethod
    def validate_password(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 bytes or less")
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: str
    name: str
    email: str
    resume_status: str = "none"
    created_at: str


class UpdateProfileRequest(BaseModel):
    name: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, v: str) -> str:
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


# ── Resume ──

class ResumeUploadResponse(BaseModel):
    id: str
    parsed_data: dict
    summary: str


class ResumeSummaryResponse(BaseModel):
    id: str
    summary: str
    parsed_data: Optional[dict] = None


# ── Questions ──

class ReferenceData(BaseModel):
    test_cases: Optional[list[dict]] = None
    checklist: Optional[list[str]] = None
    reasoning_path: Optional[str] = None
    key_insight: Optional[str] = None


class QuestionCreate(BaseModel):
    domain: str
    difficulty: str
    type: str
    question_text: str
    reference: Optional[ReferenceData] = None


class QuestionResponse(BaseModel):
    id: str
    domain: str
    difficulty: str
    type: str
    question_text: str
    reference: Optional[dict] = None


# ── Sessions ──

class StartSessionRequest(BaseModel):
    domain: str
    round_type: str
    mode: str
    difficulty: Optional[str] = "medium"
    duration_minutes: Optional[int] = 30


class StartSessionResponse(BaseModel):
    session_id: str
    calibration_questions: list[dict]


class SessionResponse(BaseModel):
    id: str
    domain: str
    round_type: str
    mode: str
    difficulty: str
    duration_minutes: int
    status: str
    ability_profile: Optional[dict] = None
    started_at: str
    ended_at: Optional[str] = None


# ── Answers ──

class CaptureTextAnswerRequest(BaseModel):
    session_id: str
    question_id: str
    text: str


class CaptureCodeAnswerRequest(BaseModel):
    session_id: str
    question_id: str
    code: str
    keystroke_log: Optional[Any] = None


class AnswerResponse(BaseModel):
    id: str
    correctness_result: Optional[dict] = None
    fluency_score: Optional[dict] = None
    mistake_tags: Optional[list[dict]] = None
    next_question: Optional[dict] = None


# ── Reports ──

class ReportResponse(BaseModel):
    id: str
    session_id: str
    overall_level: int
    response_relevancy: float
    communication: float
    confidence: float
    pdf_url: Optional[str] = None
    generated_at: str


# ── Feedback ──

class SubmitFeedbackRequest(BaseModel):
    session_id: str
    rating: int
    comments: Optional[str] = None


class FeedbackResponse(BaseModel):
    id: str
    session_id: str
    rating: int
    comments: Optional[str] = None
    submitted_at: str


# ── Integrity ──

class IntegrityEvent(BaseModel):
    session_id: str
    type: str
    question_id: Optional[str] = None
    timestamp: Optional[str] = None
    extra: Optional[dict] = None


class IntegritySummaryResponse(BaseModel):
    session_id: str
    events: list[dict]


# ── Legacy Interview (kept for backward compat with existing UI) ──

class StartInterviewRequest(BaseModel):
    interview_type: str


class StartInterviewResponse(BaseModel):
    session_id: str
    question: str


class AnswerRequest(BaseModel):
    session_id: str
    answer: str


class AnswerSimpleResponse(BaseModel):
    question: Optional[str] = None
    status: str
    confidence_score: Optional[int] = None
    fluency_score: Optional[float] = None


class WeakClaim(BaseModel):
    claim: str
    why_weak: str


class QAPair(BaseModel):
    question: str
    answer: str
    question_number: int


class InterviewFeedbackResponse(BaseModel):
    overall_score: int
    strengths: list[str]
    weaknesses: list[str]
    rambling_detected: bool
    weak_claims: list[WeakClaim]
    suggested_improvements: list[str]
    qa_pairs: Optional[list[QAPair]] = None

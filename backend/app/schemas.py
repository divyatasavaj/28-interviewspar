from datetime import datetime

from pydantic import BaseModel, EmailStr


from pydantic import field_validator


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
    id: int
    name: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}


class StartInterviewRequest(BaseModel):
    interview_type: str


class StartInterviewResponse(BaseModel):
    session_id: int
    question: str


class AnswerRequest(BaseModel):
    session_id: int
    answer: str


class AnswerResponse(BaseModel):
    question: str | None = None
    status: str


class WeakClaim(BaseModel):
    claim: str
    why_weak: str


class FeedbackResponse(BaseModel):
    overall_score: int
    strengths: list[str]
    weaknesses: list[str]
    rambling_detected: bool
    weak_claims: list[WeakClaim]
    suggested_improvements: list[str]

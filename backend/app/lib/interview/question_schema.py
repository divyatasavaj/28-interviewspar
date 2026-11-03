from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field, field_validator
from datetime import datetime


class RoundType(str, Enum):
    HR = "hr"
    TECHNICAL = "technical"
    BEHAVIORAL = "behavioral"
    FINAL = "final"


class QuestionType(str, Enum):
    BASIC_INFO = "basic_info"
    BEHAVIORAL = "behavioral"
    TECHNICAL_THEORY = "technical_theory"
    CODING_CHALLENGE = "coding_challenge"
    SYSTEM_DESIGN = "system_design"
    SITUATIONAL = "situational"
    DOMAIN_SPECIFIC = "domain_specific"


class ValidationRuleType(str, Enum):
    LANGUAGE_ENFORCEMENT = "language_enforcement"
    RELEVANCE_CHECK = "relevance_check"
    COMPLETENESS_CHECK = "completeness_check"
    FORMAT_CHECK = "format_check"
    MIN_LENGTH = "min_length"
    MAX_LENGTH = "max_length"
    REQUIRED_KEYWORDS = "required_keywords"
    FORBIDDEN_PATTERNS = "forbidden_patterns"


class DifficultyLevel(str, Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class TechnicalRole(str, Enum):
    JUNIOR_FRONTEND = "junior_frontend"
    SENIOR_FRONTEND = "senior_frontend"
    JUNIOR_BACKEND = "junior_backend"
    SENIOR_BACKEND = "senior_backend"
    FULLSTACK = "fullstack"
    DEVOPS = "devops"
    MOBILE = "mobile"
    ML_AI = "ml_ai"
    QA_TEST = "qa_test"
    DATA_ENGINEER = "data_engineer"
    SECURITY = "security"
    ENGINEERING_MANAGER = "engineering_manager"


class LanguageCode(str, Enum):
    EN = "en"
    HI = "hi"
    GU = "gu"
    MR = "mr"
    TA = "ta"
    TE = "te"
    KN = "kn"
    ML = "ml"
    BN = "bn"
    PA = "pa"
    OR = "or"
    AS = "as"
    OTHER = "other"


class ValidationRule(BaseModel):
    rule_type: ValidationRuleType
    parameters: dict = Field(default_factory=dict)
    error_message: str
    severity: str = "error"  # error, warning, info
    retry_allowed: bool = True
    max_retries: int = 2


class QuestionBase(BaseModel):
    id: str
    round_type: RoundType
    role: Optional[TechnicalRole] = None
    question_type: QuestionType
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
    prompt: str
    expected_format: Optional[str] = None
    validation_rules: list[ValidationRule] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)
    order: int = 0
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class HRQuestion(QuestionBase):
    round_type: RoundType = RoundType.HR
    role: None = None
    requires_resume_context: bool = False


class TechnicalQuestion(QuestionBase):
    round_type: RoundType = RoundType.TECHNICAL
    role: TechnicalRole
    skills_tested: list[str] = Field(default_factory=list)
    reference_solution: Optional[str] = None
    test_cases: list[dict] = Field(default_factory=list)
    time_limit_seconds: int = 300
    memory_limit_mb: int = 256


class CodingChallenge(TechnicalQuestion):
    question_type: QuestionType = QuestionType.CODING_CHALLENGE
    starter_code: dict[str, str] = Field(default_factory=dict)  # language -> code
    function_signature: Optional[str] = None
    input_format: Optional[str] = None
    output_format: Optional[str] = None
    constraints: Optional[str] = None


class QuestionBank(BaseModel):
    questions: list[QuestionBase] = Field(default_factory=list)
    version: str = "1.0"
    last_updated: datetime = Field(default_factory=datetime.utcnow)

    def get_questions_for_round(self, round_type: RoundType, role: Optional[TechnicalRole] = None) -> list[QuestionBase]:
        filtered = [q for q in self.questions if q.round_type == round_type and q.is_active]
        if role:
            filtered = [q for q in filtered if q.role == role or q.role is None]
        return sorted(filtered, key=lambda q: q.order)

    def get_question_by_id(self, question_id: str) -> Optional[QuestionBase]:
        for q in self.questions:
            if q.id == question_id:
                return q
        return None


class AnswerSubmission(BaseModel):
    session_id: str
    question_id: str
    answer: str
    language: Optional[LanguageCode] = None
    metadata: dict = Field(default_factory=dict)


class ValidationResult(BaseModel):
    is_valid: bool
    rule_type: ValidationRuleType
    message: str
    severity: str
    retry_count: int = 0
    max_retries: int = 2
    can_retry: bool = True
    suggestions: list[str] = Field(default_factory=list)


class AnswerEvaluation(BaseModel):
    question_id: str
    answer: str
    validation_results: list[ValidationResult] = Field(default_factory=list)
    overall_valid: bool = True
    relevance_score: float = 0.0
    completeness_score: float = 0.0
    language_score: float = 0.0
    quality_score: float = 0.0
    feedback: str = ""
    flagged_issues: list[str] = Field(default_factory=list)
    evaluated_at: datetime = Field(default_factory=datetime.utcnow)


class SessionState(BaseModel):
    session_id: str
    user_id: str
    current_round: RoundType = RoundType.HR
    current_role: Optional[TechnicalRole] = None
    current_question_index: int = 0
    current_question_id: Optional[str] = None
    questions_answered: list[str] = Field(default_factory=list)
    validation_retries: dict[str, int] = Field(default_factory=dict)
    violations: list[dict] = Field(default_factory=list)
    status: str = "active"  # active, completed, flagged, terminated
    started_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    metadata: dict = Field(default_factory=dict)


class InterviewReport(BaseModel):
    session_id: str
    user_id: str
    overall_score: float
    round_scores: dict[RoundType, float]
    question_evaluations: list[AnswerEvaluation]
    strengths: list[str]
    weaknesses: list[str]
    violations_summary: dict[str, int]
    generated_at: datetime = Field(default_factory=datetime.utcnow)
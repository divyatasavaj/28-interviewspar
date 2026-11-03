"""Versioned request and response contracts for resume assessments."""

from __future__ import annotations

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from .schemas import SectionType, SourceSpan


ASSESSMENT_SCHEMA_VERSION = "resume-assessment-v1"
ASSESSMENT_SCORING_POLICY_VERSION = "resume-match-v1"
MAX_JOB_DESCRIPTION_CHARS = 20_000


class AssessmentMode(str, Enum):
    ROLE = "role"
    JOB_DESCRIPTION = "job_description"


class AssessmentStatus(str, Enum):
    PRELIMINARY = "preliminary"
    HEURISTIC = "heuristic"
    EVIDENCE_BACKED = "evidence_backed"


class ScoreStatus(str, Enum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"


class RequirementType(str, Enum):
    REQUIRED = "required"
    PREFERRED = "preferred"
    UNSPECIFIED = "unspecified"


class EvidenceClassification(str, Enum):
    LISTED = "listed"
    CONTEXTUAL_MENTION = "contextual_mention"
    DEMONSTRATED_USE = "demonstrated_use"
    DEMONSTRATED_OUTCOME = "demonstrated_outcome"


class MatchStatus(str, Enum):
    DEMONSTRATED = "demonstrated"
    MENTIONED_ONLY = "mentioned_only"
    WEAK_EVIDENCE = "weak_evidence"
    NOT_EVIDENCED = "not_evidenced"
    UNKNOWN_REQUIREMENT = "unknown_requirement"
    NOT_EVALUATED = "not_evaluated"


class RecommendationGroup(str, Enum):
    RESUME_IMPROVEMENT = "resume_improvement"
    SKILL_DEVELOPMENT = "skill_development"
    EVIDENCE_IMPROVEMENT = "evidence_improvement"


class PriorityBand(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ScoreMethod(str, Enum):
    WEIGHTED_ROLE_RUBRIC = "weighted_role_rubric_v1"
    JOB_DESCRIPTION_COVERAGE = "job_description_evidence_coverage_v1"
    UNAVAILABLE = "not_available"


class RoleAssessmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    target_role_id: str = Field(min_length=1, max_length=80, pattern=r"^[a-z0-9][a-z0-9-]*$")

    @field_validator("target_role_id")
    @classmethod
    def strip_role_id(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("target_role_id cannot be blank")
        return value


class JobDescriptionAssessmentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    job_description: str = Field(min_length=1, max_length=MAX_JOB_DESCRIPTION_CHARS)

    @field_validator("job_description")
    @classmethod
    def require_non_blank_description(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("job_description cannot be blank")
        return value


class EvidenceReference(BaseModel):
    classification: EvidenceClassification
    section_type: SectionType
    section_id: str
    span: SourceSpan
    snippet: str = Field(min_length=1, max_length=240)
    matched_alias: str
    parser_confidence: float = Field(ge=0.0, le=1.0)


class RequirementAssessment(BaseModel):
    requirement_id: str
    canonical_skill_id: str | None = None
    skill_ids: list[str] = Field(default_factory=list)
    matched_skill_ids: list[str] = Field(default_factory=list)
    display_name: str
    requirement_type: RequirementType
    importance: str | None = None
    rationale: str | None = None
    requirement_span: SourceSpan | None = None
    match_status: MatchStatus
    evidence: EvidenceReference | None = None
    explanation: str
    suggested_next_action: str

    @property
    def evidence_classification(self) -> EvidenceClassification | None:
        return self.evidence.classification if self.evidence else None

    @property
    def evidence_section(self) -> SectionType | None:
        return self.evidence.section_type if self.evidence else None

    @property
    def evidence_span(self) -> SourceSpan | None:
        return self.evidence.span if self.evidence else None


class UnknownRequirement(BaseModel):
    source_term: str = Field(min_length=1, max_length=80)
    requirement_type: RequirementType
    span: SourceSpan
    reason: str


class ScoreComponent(BaseModel):
    requirement_id: str
    requirement_type: RequirementType
    weight: float | None = Field(default=None, gt=0)
    evaluated_skill_ids: list[str] = Field(default_factory=list)
    evidence_classification: EvidenceClassification | None = None
    evidence_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    evidence_factor: float = Field(ge=0.0, le=1.0)
    weighted_value: float | None = Field(default=None, ge=0.0)
    explanation: str


class EvidenceSummary(BaseModel):
    resume_skill_count: int = Field(ge=0)
    project_count: int = Field(ge=0)
    experience_count: int = Field(ge=0)
    evaluated_requirement_count: int = Field(ge=0)
    demonstrated_count: int = Field(ge=0)
    mentioned_only_count: int = Field(ge=0)
    weak_evidence_count: int = Field(ge=0)
    not_evidenced_count: int = Field(ge=0)
    unknown_requirement_count: int = Field(ge=0)
    not_evaluated_count: int = Field(ge=0)


class Recommendation(BaseModel):
    recommendation_id: str
    group: RecommendationGroup
    priority: int = Field(ge=1)
    priority_band: PriorityBand
    title: str
    action: str
    why_it_matters: str
    related_skill_ids: list[str] = Field(default_factory=list)
    related_requirement_ids: list[str] = Field(default_factory=list)
    evidence: EvidenceReference | None = None
    learning_activity: str | None = None
    safety_note: str = (
        "Only add skills, projects, metrics, or outcomes that you can verify and explain."
    )


class JobDescriptionReference(BaseModel):
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    character_count: int = Field(ge=1)
    retention: Literal["hash_only"] = "hash_only"


class ResumeAssessment(BaseModel):
    schema_version: Literal["resume-assessment-v1"] = ASSESSMENT_SCHEMA_VERSION
    assessment_id: str
    assessment_mode: AssessmentMode
    target_role_id: str | None = None
    target_role_title: str | None = None
    resume_id: str
    resume_sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    job_description_reference: JobDescriptionReference | None = None
    assessment_status: AssessmentStatus
    score: float | None = Field(default=None, ge=0.0, le=100.0)
    score_status: ScoreStatus
    score_method: ScoreMethod
    score_explanation: str
    matched_requirements: list[RequirementAssessment] = Field(default_factory=list)
    skill_gaps: list[RequirementAssessment] = Field(default_factory=list)
    unknown_requirements: list[UnknownRequirement] = Field(default_factory=list)
    not_evaluated_requirements: list[RequirementAssessment] = Field(default_factory=list)
    score_components: list[ScoreComponent] = Field(default_factory=list)
    evidence_summary: EvidenceSummary
    recommendations: list[Recommendation] = Field(default_factory=list)
    rubric_id: str | None = None
    rubric_version: str | None = None
    catalog_version: str
    scoring_policy_version: str = ASSESSMENT_SCORING_POLICY_VERSION
    limitations: list[str] = Field(min_length=1)
    created_at: str

    @model_validator(mode="after")
    def validate_score_contract(self) -> "ResumeAssessment":
        if self.score_status is ScoreStatus.AVAILABLE and self.score is None:
            raise ValueError("an available score must contain a numeric value")
        if self.score_status is ScoreStatus.UNAVAILABLE and self.score is not None:
            raise ValueError("an unavailable score must be null")
        if self.assessment_mode is AssessmentMode.ROLE and self.target_role_id is None:
            raise ValueError("role assessments require target_role_id")
        if (
            self.assessment_mode is AssessmentMode.JOB_DESCRIPTION
            and self.job_description_reference is None
        ):
            raise ValueError("job-description assessments require a hash reference")
        return self


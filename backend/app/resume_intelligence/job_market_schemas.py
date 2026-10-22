"""Versioned contracts for job-market ingestion and generated role rubrics."""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


JOB_POSTING_SCHEMA_VERSION = "job-market-posting-v1"
INGESTION_RESULT_SCHEMA_VERSION = "job-market-ingestion-v1"
GENERATED_RUBRIC_SCHEMA_VERSION = "role-rubric-evidence-v1"


class JobPostingInput(BaseModel):
    """Minimal permitted posting fields accepted from CSV, JSON, or an adapter."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    source_id: str = Field(min_length=1, max_length=100)
    source_posting_id: str | None = Field(default=None, max_length=200)
    source_reference_url: str | None = Field(default=None, max_length=2000)
    title: str = Field(min_length=1, max_length=200)
    employer_name: str | None = Field(default=None, max_length=200)
    location: str | None = Field(default=None, max_length=200)
    required_skills: list[str] = Field(default_factory=list, max_length=100)
    preferred_skills: list[str] = Field(default_factory=list, max_length=100)
    description: str | None = Field(default=None, max_length=20_000)
    experience_min_years: float | None = Field(default=None, ge=0, le=50)
    experience_max_years: float | None = Field(default=None, ge=0, le=50)
    education: str | None = Field(default=None, max_length=300)
    employment_type: str | None = Field(default=None, max_length=80)
    posted_at: date | None = None
    collected_at: date

    @field_validator("source_reference_url")
    @classmethod
    def validate_reference_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        lowered = value.casefold()
        if not lowered.startswith(("https://", "http://")):
            raise ValueError("source_reference_url must use http or https")
        return value

    @field_validator("required_skills", "preferred_skills")
    @classmethod
    def validate_skill_terms(cls, values: list[str]) -> list[str]:
        cleaned: list[str] = []
        for value in values:
            term = value.strip()
            if not term:
                raise ValueError("skill terms cannot be empty")
            if len(term) > 120:
                raise ValueError("each skill term must be 120 characters or fewer")
            cleaned.append(term)
        return cleaned

    @model_validator(mode="after")
    def validate_record(self) -> "JobPostingInput":
        if not self.source_posting_id and not self.source_reference_url:
            raise ValueError(
                "source_posting_id or source_reference_url is required for provenance"
            )
        if (
            self.experience_min_years is not None
            and self.experience_max_years is not None
            and self.experience_max_years < self.experience_min_years
        ):
            raise ValueError("experience_max_years cannot be below experience_min_years")
        if self.posted_at is not None and self.posted_at > self.collected_at:
            raise ValueError("posted_at cannot be later than collected_at")
        return self


class NormalizedLocation(BaseModel):
    city: str = ""
    state: str = ""
    country: str = ""
    is_remote: bool = False
    india_evidence: bool = False


class NormalizedSkillEvidence(BaseModel):
    skill_id: str
    matched_term: str = Field(min_length=1, max_length=120)
    importance: Literal["required", "preferred", "mentioned"]
    extraction_method: str = Field(min_length=1, max_length=80)
    confidence: float = Field(ge=0.0, le=1.0)


class NormalizedJobPosting(BaseModel):
    schema_version: Literal["job-market-posting-v1"] = JOB_POSTING_SCHEMA_VERSION
    record_id: str = Field(pattern=r"^[a-f0-9]{64}$")
    content_fingerprint: str = Field(pattern=r"^[a-f0-9]{64}$")
    source_id: str
    source_posting_id: str | None = None
    source_reference_url: str | None = None
    title: str
    normalized_role_id: str
    employer_name: str = ""
    location: NormalizedLocation = Field(default_factory=NormalizedLocation)
    required_skill_ids: list[str] = Field(default_factory=list)
    preferred_skill_ids: list[str] = Field(default_factory=list)
    mentioned_skill_ids: list[str] = Field(default_factory=list)
    skill_evidence: list[NormalizedSkillEvidence] = Field(default_factory=list)
    skill_extraction_confidence: float = Field(ge=0.0, le=1.0)
    experience_min_years: float | None = None
    experience_max_years: float | None = None
    education: str = ""
    employment_type: str = ""
    posted_at: date | None = None
    collected_at: date
    source_license_status: str
    source_license_name: str
    source_content_kind: Literal["job_postings"]
    dataset_version: str
    duplicate_of: str | None = None
    duplicate_kind: Literal["none", "source_record", "content"] = "none"
    provenance_status: Literal["accepted"] = "accepted"

    @model_validator(mode="after")
    def validate_skill_sets(self) -> "NormalizedJobPosting":
        for label, values in (
            ("required_skill_ids", self.required_skill_ids),
            ("preferred_skill_ids", self.preferred_skill_ids),
            ("mentioned_skill_ids", self.mentioned_skill_ids),
        ):
            if len(values) != len(set(values)):
                raise ValueError(f"{label} cannot contain duplicates")
        evidence_ids = [item.skill_id for item in self.skill_evidence]
        if len(evidence_ids) != len(set(evidence_ids)):
            raise ValueError("skill_evidence cannot contain duplicate skill IDs")
        return self


class UnknownSkillReview(BaseModel):
    normalized_term: str
    display_terms: list[str] = Field(default_factory=list)
    source_ids: list[str] = Field(default_factory=list)
    role_ids: list[str] = Field(default_factory=list)
    posting_record_ids: list[str] = Field(default_factory=list)
    status: Literal["pending_review"] = "pending_review"
    first_seen_dataset_version: str
    last_seen_dataset_version: str


class QuarantinedRecord(BaseModel):
    row_number: int = Field(ge=1)
    source_id: str | None = None
    reason_code: str
    reason: str


class IngestionSummary(BaseModel):
    input_record_count: int = Field(ge=0)
    accepted_record_count: int = Field(ge=0)
    unique_record_count: int = Field(ge=0)
    duplicate_record_count: int = Field(ge=0)
    quarantined_record_count: int = Field(ge=0)
    unknown_skill_count: int = Field(ge=0)
    role_counts: dict[str, int] = Field(default_factory=dict)
    source_counts: dict[str, int] = Field(default_factory=dict)


class IngestionResult(BaseModel):
    schema_version: Literal["job-market-ingestion-v1"] = (
        INGESTION_RESULT_SCHEMA_VERSION
    )
    run_id: str = Field(pattern=r"^[a-f0-9]{64}$")
    dataset_version: str
    dry_run: bool
    postings: list[NormalizedJobPosting]
    unknown_skills: list[UnknownSkillReview]
    quarantined: list[QuarantinedRecord]
    summary: IngestionSummary


class EvidenceThresholds(BaseModel):
    model_config = ConfigDict(extra="forbid")

    minimum_eligible_postings: int = Field(ge=1)
    minimum_unique_employers: int = Field(ge=1)
    minimum_distinct_sources: int = Field(ge=1)
    minimum_recency_ratio: float = Field(ge=0, le=1)
    recency_window_months: int = Field(ge=1)
    maximum_duplicate_rate: float = Field(ge=0, le=1)
    minimum_required_skill_coverage: float = Field(ge=0, le=1)
    minimum_mean_skill_extraction_confidence: float = Field(ge=0, le=1)
    minimum_india_location_ratio: float = Field(ge=0, le=1)
    minimum_temporal_span_days: int = Field(ge=0)
    maximum_single_source_share: float = Field(ge=0, le=1)


class RubricConfidencePolicy(BaseModel):
    model_config = ConfigDict(extra="forbid")

    minimum_medium_confidence_postings: int = Field(ge=1)
    minimum_high_confidence_postings: int = Field(ge=1)

    @model_validator(mode="after")
    def validate_order(self) -> "RubricConfidencePolicy":
        if (
            self.minimum_high_confidence_postings
            < self.minimum_medium_confidence_postings
        ):
            raise ValueError(
                "high-confidence posting threshold cannot be below medium"
            )
        return self


class RubricThresholdDocument(BaseModel):
    model_config = ConfigDict(extra="forbid")

    schema_version: Literal["1.0.0"]
    threshold_version: str
    policy_note: str
    thresholds: EvidenceThresholds
    confidence_policy: RubricConfidencePolicy


class RubricEvidence(BaseModel):
    evidence_tier: Literal[
        "taxonomy_only",
        "insufficient_market_evidence",
        "threshold_met_pending_review",
        "validated",
    ]
    eligible_posting_count: int = Field(ge=0)
    unique_employer_count: int = Field(ge=0)
    source_distribution: dict[str, int] = Field(default_factory=dict)
    geographic_coverage: dict[str, object] = Field(default_factory=dict)
    temporal_coverage: dict[str, object] = Field(default_factory=dict)
    duplicate_rate: float = Field(ge=0, le=1)
    required_skill_coverage: float = Field(ge=0, le=1)
    mean_skill_extraction_confidence: float = Field(ge=0, le=1)
    india_location_ratio: float = Field(ge=0, le=1)
    maximum_single_source_share: float = Field(ge=0, le=1)
    threshold_version: str
    thresholds_met: bool
    checks: dict[str, bool] = Field(default_factory=dict)
    blockers: list[str] = Field(default_factory=list)
    limitations: list[str] = Field(default_factory=list)


class GeneratedRubricRequirement(BaseModel):
    requirement_id: str
    skill_ids: list[str] = Field(min_length=1)
    match_mode: Literal["all"] = "all"
    importance: Literal["core", "preferred"]
    weight: None = None
    weight_status: Literal["pending_manual_validation"] = (
        "pending_manual_validation"
    )
    rationale: str
    source_refs: list[dict[str, object]] = Field(min_length=1)


class GeneratedRoleRubric(BaseModel):
    schema_version: Literal["1.0.0"] = "1.0.0"
    rubric_id: str
    role_id: str
    version: str
    status: Literal["provisional"] = "provisional"
    created_at: date
    approved_at: None = None
    source_snapshot_ids: list[str] = Field(min_length=1)
    sample_size: int = Field(ge=0)
    confidence: Literal["low", "medium", "high"]
    confidence_reasons: list[str] = Field(min_length=1)
    provenance_mode: Literal["indian_job_postings"] = "indian_job_postings"
    score_policy_version: str = "score-v1"
    dimensions: list[dict[str, object]] = Field(min_length=1)
    validation: dict[str, object]
    requirements: list[GeneratedRubricRequirement] = Field(min_length=1)
    evidence: RubricEvidence

    @model_validator(mode="after")
    def validate_generated_rubric(self) -> "GeneratedRoleRubric":
        requirement_ids = [item.requirement_id for item in self.requirements]
        if len(requirement_ids) != len(set(requirement_ids)):
            raise ValueError("generated rubric requirement IDs must be unique")
        if self.validation.get("status") != "not_reviewed":
            raise ValueError("generated rubrics must remain unreviewed")
        if self.evidence.eligible_posting_count != self.sample_size:
            raise ValueError("sample_size must equal eligible posting count")
        return self

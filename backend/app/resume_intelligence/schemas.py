"""Versioned output contract for deterministic resume parsing."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, model_validator


RESUME_ANALYSIS_SCHEMA_VERSION = "resume-intelligence-v1"

SectionType = Literal[
    "header",
    "contact",
    "summary",
    "skills",
    "projects",
    "experience",
    "education",
    "certifications",
    "awards",
    "publications",
    "languages",
    "interests",
    "other",
]
EvidenceType = Literal["explicit_mention", "contextual_evidence"]
EvidenceStrength = Literal[
    "listed",
    "contextual_mention",
    "demonstrated_use",
    "demonstrated_outcome",
]


class SourceSpan(BaseModel):
    """Offsets into the cleaned resume text returned internally by extraction."""

    start: int = Field(ge=0)
    end: int = Field(ge=0)

    @model_validator(mode="after")
    def validate_order(self) -> "SourceSpan":
        if self.end < self.start:
            raise ValueError("span end must be greater than or equal to start")
        return self


class FileMetadata(BaseModel):
    extension: Literal[".pdf", ".docx"]
    media_type: str
    size_bytes: int = Field(ge=1)
    sha256: str = Field(pattern=r"^[a-f0-9]{64}$")
    page_count: int | None = Field(default=None, ge=1)


class ContactMetadata(BaseModel):
    """Privacy-preserving contact signals; actual contact values are not stored."""

    contact_section_present: bool = False
    email_present: bool = False
    phone_present: bool = False
    profile_link_present: bool = False


class ResumeSection(BaseModel):
    section_id: str
    section_type: SectionType
    heading: str | None = None
    span: SourceSpan
    line_start: int = Field(ge=0)
    line_end: int = Field(ge=0)


class SkillEvidence(BaseModel):
    skill_id: str
    canonical_name: str
    matched_alias: str
    mention_count: int = Field(ge=1)
    section_id: str
    section_type: SectionType
    section_types_seen: list[SectionType]
    evidence_type: EvidenceType
    evidence_strength: EvidenceStrength
    evidence_snippet: str = Field(min_length=1, max_length=240)
    span: SourceSpan
    extraction_method: str
    catalog_version: str
    confidence: float = Field(ge=0.0, le=1.0)
    context_validated: bool = False


class ProjectEvidence(BaseModel):
    project_id: str
    section_id: str
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=1200)
    technology_skill_ids: list[str] = Field(default_factory=list)
    technology_names: list[str] = Field(default_factory=list)
    span: SourceSpan


class WorkExperienceEvidence(BaseModel):
    experience_id: str
    section_id: str
    role: str = Field(default="", max_length=160)
    organization: str = Field(default="", max_length=160)
    duration: str = Field(default="", max_length=100)
    description: str = Field(default="", max_length=1200)
    skill_ids: list[str] = Field(default_factory=list)
    span: SourceSpan


class EducationEvidence(BaseModel):
    education_id: str
    section_id: str
    institution: str = Field(default="", max_length=200)
    degree: str = Field(default="", max_length=200)
    year: str = Field(default="", max_length=40)
    description: str = Field(default="", max_length=600)
    span: SourceSpan


class CertificationEvidence(BaseModel):
    certification_id: str
    section_id: str
    name: str = Field(min_length=1, max_length=200)
    issuer: str = Field(default="", max_length=160)
    description: str = Field(default="", max_length=600)
    span: SourceSpan


class ExtractionStats(BaseModel):
    text_characters: int = Field(ge=1)
    section_count: int = Field(ge=1)
    skill_count: int = Field(ge=0)
    project_count: int = Field(ge=0)
    experience_count: int = Field(ge=0)
    education_count: int = Field(ge=0)
    certification_count: int = Field(ge=0)


class ResumeAnalysis(BaseModel):
    schema_version: Literal["resume-intelligence-v1"] = RESUME_ANALYSIS_SCHEMA_VERSION
    parser_version: str
    catalog_version: str
    file: FileMetadata
    contact: ContactMetadata
    sections: list[ResumeSection]
    skills: list[SkillEvidence]
    projects: list[ProjectEvidence]
    work_experience: list[WorkExperienceEvidence]
    education: list[EducationEvidence]
    certifications: list[CertificationEvidence]
    warnings: list[str] = Field(default_factory=list)
    stats: ExtractionStats

    @model_validator(mode="after")
    def validate_unique_entities(self) -> "ResumeAnalysis":
        entity_groups = (
            ("skill", [item.skill_id for item in self.skills]),
            ("project", [item.project_id for item in self.projects]),
            ("experience", [item.experience_id for item in self.work_experience]),
            ("education", [item.education_id for item in self.education]),
            ("certification", [item.certification_id for item in self.certifications]),
        )
        for label, values in entity_groups:
            if len(values) != len(set(values)):
                raise ValueError(f"duplicate {label} identifiers are not allowed")
        return self

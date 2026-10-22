"""Synthetic resume and rubric fixtures for Phase 4 tests only."""

from __future__ import annotations

from dataclasses import replace
from types import SimpleNamespace

from bson.objectid import ObjectId

from app.resume_intelligence.catalog import ResumeIntelligenceCatalog, Role, Rubric, RubricRequirement
from app.resume_intelligence.schemas import (
    ContactMetadata,
    EducationEvidence,
    ExtractionStats,
    FileMetadata,
    ProjectEvidence,
    ResumeAnalysis,
    ResumeSection,
    SkillEvidence,
    SourceSpan,
    WorkExperienceEvidence,
)


def make_analysis(
    catalog: ResumeIntelligenceCatalog,
    skill_specs: list[tuple[str, str]] | None = None,
    *,
    project_descriptions: list[str] | None = None,
    experience_descriptions: list[str] | None = None,
    warnings: list[str] | None = None,
) -> ResumeAnalysis:
    """Build a valid synthetic analysis; never based on a real person's resume."""

    specs = skill_specs or []
    section_types = {"skills", "projects", "experience", "education"}
    sections = [
        ResumeSection(
            section_id=f"section-{section_type}",
            section_type=section_type,
            heading=section_type.upper(),
            span=SourceSpan(start=0, end=10),
            line_start=0,
            line_end=1,
        )
        for section_type in sorted(section_types)
    ]
    skills = []
    for index, (skill_id, strength) in enumerate(specs, start=1):
        skill = catalog.skills[skill_id]
        section_type = "skills" if strength == "listed" else "projects"
        skills.append(
            SkillEvidence(
                skill_id=skill_id,
                canonical_name=skill.canonical_name,
                matched_alias=skill.canonical_name,
                mention_count=3,
                section_id=f"section-{section_type}",
                section_type=section_type,
                section_types_seen=[section_type],
                evidence_type=(
                    "explicit_mention" if strength == "listed" else "contextual_evidence"
                ),
                evidence_strength=strength,
                evidence_snippet=f"Synthetic evidence for {skill.canonical_name}.",
                span=SourceSpan(start=index * 10, end=index * 10 + 5),
                extraction_method="canonical",
                catalog_version=catalog.skills_catalog_version,
                confidence=1.0,
            )
        )

    descriptions = project_descriptions or []
    projects = [
        ProjectEvidence(
            project_id=f"project-{index}",
            section_id="section-projects",
            title=f"Synthetic project {index}",
            description=description,
            technology_skill_ids=[],
            technology_names=[],
            span=SourceSpan(start=100 + index, end=110 + index),
        )
        for index, description in enumerate(descriptions, start=1)
    ]
    experiences = [
        WorkExperienceEvidence(
            experience_id=f"experience-{index}",
            section_id="section-experience",
            role="Synthetic role",
            organization="Synthetic employer",
            duration="2026",
            description=description,
            skill_ids=[],
            span=SourceSpan(start=200 + index, end=210 + index),
        )
        for index, description in enumerate(experience_descriptions or [], start=1)
    ]
    return ResumeAnalysis(
        parser_version="synthetic-fixture",
        catalog_version=catalog.skills_catalog_version,
        file=FileMetadata(
            extension=".docx",
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            size_bytes=1234,
            sha256="a" * 64,
        ),
        contact=ContactMetadata(),
        sections=sections,
        skills=skills,
        projects=projects,
        work_experience=experiences,
        education=[
            EducationEvidence(
                education_id="education-1",
                section_id="section-education",
                institution="Synthetic Institute",
                degree="B.Tech",
                year="2026",
                description="Synthetic fixture.",
                span=SourceSpan(start=300, end=310),
            )
        ],
        certifications=[],
        warnings=warnings or [],
        stats=ExtractionStats(
            text_characters=1000,
            section_count=len(sections),
            skill_count=len(skills),
            project_count=len(projects),
            experience_count=len(experiences),
            education_count=1,
            certification_count=0,
        ),
    )


def make_weighted_rubric(
    role: Role,
    requirements: list[tuple[tuple[str, ...], str, str, float]],
) -> Rubric:
    """Build an explicitly synthetic, already-validated rubric for formula tests."""

    rubric_requirements = tuple(
        RubricRequirement(
            requirement_id=f"synthetic-{index}",
            skill_ids=skill_ids,
            match_mode=match_mode,
            importance=importance,
            weight=weight,
            weight_status="validated",
            rationale="Synthetic rubric used only to verify deterministic arithmetic.",
            source_refs=({"source_id": "synthetic-test-fixture", "note": "Not market evidence."},),
        )
        for index, (skill_ids, match_mode, importance, weight) in enumerate(
            requirements, start=1
        )
    )
    return Rubric(
        schema_version="1.0.0",
        rubric_id=f"{role.role_id}@synthetic-test",
        role_id=role.role_id,
        version="synthetic-test",
        status="approved",
        created_at="2026-10-21",
        approved_at="2026-10-21",
        source_snapshot_ids=(),
        sample_size=10,
        confidence="high",
        confidence_reasons=("Synthetic arithmetic fixture; not market evidence.",),
        provenance_mode="synthetic_test",
        score_policy_version="score-v1",
        dimensions=(
            {
                "dimension_id": "synthetic",
                "label": "Synthetic",
                "weight": 1.0,
                "weight_status": "validated",
            },
        ),
        validation={
            "status": "approved",
            "reviewer_count": 1,
            "notes": "Synthetic test-only approval.",
        },
        requirements=rubric_requirements,
        evidence={
            "evidence_tier": "validated",
            "eligible_posting_count": 10,
            "unique_employer_count": 2,
            "source_distribution": {"synthetic": 10},
            "geographic_coverage": {"cities": {}, "states": {}, "india_location_ratio": 1.0},
            "temporal_coverage": {"from": "2026-01-01", "to": "2026-10-01", "span_days": 273, "recency_ratio": 1.0},
            "duplicate_rate": 0.0,
            "required_skill_coverage": 1.0,
            "mean_skill_extraction_confidence": 1.0,
            "india_location_ratio": 1.0,
            "maximum_single_source_share": 1.0,
            "threshold_version": "synthetic",
            "thresholds_met": True,
            "checks": {},
            "blockers": [],
            "limitations": ["Synthetic test fixture; not a market validation."],
        },
    )


def validated_role(role: Role, rubric: Rubric) -> Role:
    return replace(role, rubric_status="validated", rubric_id=rubric.rubric_id)


class FakeCursor:
    def __init__(self, documents: list[dict]):
        self.documents = documents

    def sort(self, specification, direction: int | None = None):
        if direction is not None:
            specification = [(specification, direction)]
        for key, order in reversed(specification):
            self.documents.sort(
                key=lambda item: item.get(key, ""),
                reverse=order < 0,
            )
        return self

    def limit(self, count: int):
        self.documents = self.documents[:count]
        return self

    def __iter__(self):
        return iter(self.documents)

    def __next__(self):
        if not self.documents:
            raise StopIteration
        return self.documents.pop(0)


class FakeResumes:
    def __init__(self, documents: list[dict] | None = None):
        self.documents = documents or []

    def find(self, query: dict):
        return FakeCursor(
            [
                document
                for document in self.documents
                if document.get("user_id") == query.get("user_id")
            ]
        )


class FakeAssessmentCollection:
    def __init__(self, documents: list[dict] | None = None):
        self.documents = documents or []
        self.fail_writes = False

    def update_one(self, query: dict, update: dict, upsert: bool = False):
        if self.fail_writes:
            raise RuntimeError("synthetic write failure")
        existing = self.find_one(query)
        if existing is not None:
            return SimpleNamespace(upserted_id=None, modified_count=0)
        document = dict(update.get("$setOnInsert", {}))
        document.setdefault("_id", ObjectId())
        self.documents.append(document)
        return SimpleNamespace(upserted_id=document["_id"], modified_count=1)

    def find_one(self, query: dict):
        for document in self.documents:
            if all(document.get(key) == value for key, value in query.items()):
                return document
        return None

    def find(self, query: dict):
        return FakeCursor(
            [
                document
                for document in self.documents
                if all(document.get(key) == value for key, value in query.items())
            ]
        )


class FakeDatabase:
    def __init__(
        self,
        resume_documents: list[dict] | None = None,
        assessment_documents: list[dict] | None = None,
    ):
        self.resumes = FakeResumes(resume_documents)
        self.resume_assessments = FakeAssessmentCollection(assessment_documents)


from app.resume_intelligence.parser import to_legacy_parsed_data


def synthetic_resume_document(user_id: str, analysis: ResumeAnalysis) -> dict:
    return {
        "_id": ObjectId(),
        "user_id": user_id,
        "raw_text": "Synthetic fixture text. Do not treat as a real resume.",
        "summary": "Synthetic resume fixture",
        "parsed_data": to_legacy_parsed_data(analysis),
        "analysis": analysis.model_dump(mode="json"),
    }


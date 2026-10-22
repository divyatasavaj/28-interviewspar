"""Application service for authenticated resume assessment creation and history."""

from __future__ import annotations

from typing import Any

from pydantic import ValidationError

from .assessment_engine import (
    assess_job_description,
    assess_role,
    make_assessment_id,
)
from .assessment_errors import AssessmentError
from .assessment_schemas import AssessmentMode, ResumeAssessment
from .catalog import ResumeIntelligenceCatalog, load_catalog
from .job_description import hash_job_description
from .schemas import ResumeAnalysis


def create_role_assessment(
    db: Any,
    user_id: str,
    target_role_id: str,
    *,
    catalog: ResumeIntelligenceCatalog | None = None,
) -> ResumeAssessment:
    active_catalog = catalog or load_catalog()
    role = active_catalog.roles.get(target_role_id)
    if role is None or role.status != "active":
        raise AssessmentError(
            "The requested target role is not available.",
            404,
            "unknown_target_role",
        )
    rubric = active_catalog.published_rubric_for_role(role.role_id)
    if rubric is None:
        raise AssessmentError(
            "No published rubric is available for this target role.",
            404,
            "rubric_unavailable",
        )

    resume_document, analysis = _latest_resume_analysis(db, user_id)
    resume_id = str(resume_document["_id"])
    assessment_id = make_assessment_id(
        user_id=user_id,
        resume_id=resume_id,
        resume_sha256=analysis.file.sha256,
        assessment_mode=AssessmentMode.ROLE,
        target_role_id=role.role_id,
        rubric_version=rubric.version,
        catalog_version=active_catalog.skills_catalog_version,
    )
    assessment = assess_role(
        analysis,
        role,
        rubric,
        active_catalog,
        resume_id=resume_id,
        assessment_id=assessment_id,
    )
    return _persist_assessment(db, user_id, assessment)


def create_job_description_assessment(
    db: Any,
    user_id: str,
    job_description: str,
    *,
    catalog: ResumeIntelligenceCatalog | None = None,
) -> ResumeAssessment:
    active_catalog = catalog or load_catalog()
    resume_document, analysis = _latest_resume_analysis(db, user_id)
    resume_id = str(resume_document["_id"])
    description_hash = hash_job_description(job_description)
    assessment_id = make_assessment_id(
        user_id=user_id,
        resume_id=resume_id,
        resume_sha256=analysis.file.sha256,
        assessment_mode=AssessmentMode.JOB_DESCRIPTION,
        job_description_sha256=description_hash,
        catalog_version=active_catalog.skills_catalog_version,
    )
    assessment = assess_job_description(
        analysis,
        job_description,
        active_catalog,
        resume_id=resume_id,
        assessment_id=assessment_id,
    )
    return _persist_assessment(db, user_id, assessment)


def get_latest_assessment(
    db: Any,
    user_id: str,
    *,
    mode: AssessmentMode | str | None = None,
    target_role_id: str | None = None,
) -> ResumeAssessment:
    query: dict[str, Any] = {"user_id": user_id}
    if mode is not None:
        query["assessment_mode"] = (
            mode.value if isinstance(mode, AssessmentMode) else mode
        )
    if target_role_id is not None:
        query["target_role_id"] = target_role_id
    cursor = (
        db.resume_assessments.find(query)
        .sort([("created_at", -1), ("_id", -1)])
        .limit(1)
    )
    try:
        document = next(cursor)
    except StopIteration:
        raise AssessmentError(
            "No resume assessment was found for this user.",
            404,
            "assessment_not_found",
        ) from None
    return _validate_stored_assessment(document)


def get_assessment(db: Any, user_id: str, assessment_id: str) -> ResumeAssessment:
    document = db.resume_assessments.find_one(
        {"assessment_id": assessment_id, "user_id": user_id}
    )
    if document is None:
        raise AssessmentError(
            "Assessment not found.",
            404,
            "assessment_not_found",
        )
    return _validate_stored_assessment(document)


def _latest_resume_analysis(
    db: Any, user_id: str
) -> tuple[dict[str, Any], ResumeAnalysis]:
    cursor = db.resumes.find({"user_id": user_id}).sort("_id", -1).limit(1)
    try:
        document = next(cursor)
    except StopIteration:
        raise AssessmentError(
            "No resume found. Upload a PDF or DOCX resume before requesting an assessment.",
            404,
            "resume_not_found",
        ) from None
    raw_analysis = document.get("analysis")
    if not raw_analysis:
        raise AssessmentError(
            "No structured resume analysis found. Upload the resume again before requesting an assessment.",
            409,
            "resume_analysis_missing",
        )
    try:
        analysis = ResumeAnalysis.model_validate(raw_analysis)
    except ValidationError:
        raise AssessmentError(
            "The stored resume analysis is invalid. Upload the resume again before requesting an assessment.",
            409,
            "resume_analysis_invalid",
        ) from None
    return document, analysis


def _persist_assessment(
    db: Any, user_id: str, assessment: ResumeAssessment
) -> ResumeAssessment:
    document = assessment.model_dump(mode="json")
    document["user_id"] = user_id
    db.resume_assessments.update_one(
        {"assessment_id": assessment.assessment_id},
        {"$setOnInsert": document},
        upsert=True,
    )
    stored = db.resume_assessments.find_one(
        {"assessment_id": assessment.assessment_id, "user_id": user_id}
    )
    if stored is None:
        raise AssessmentError(
            "The assessment could not be saved.", 500, "assessment_persistence_failed"
        )
    return _validate_stored_assessment(stored)


def _validate_stored_assessment(document: dict[str, Any]) -> ResumeAssessment:
    try:
        return ResumeAssessment.model_validate(document)
    except ValidationError:
        raise AssessmentError(
            "The stored assessment is invalid.", 500, "assessment_data_invalid"
        ) from None


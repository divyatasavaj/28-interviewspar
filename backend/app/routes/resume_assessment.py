"""Authenticated resume match and job-description assessment endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Path, Query, status
from pymongo.database import Database

from app.database import get_db
from app.resume_intelligence.assessment_errors import AssessmentError
from app.resume_intelligence.assessment_schemas import (
    AssessmentMode,
    JobDescriptionAssessmentRequest,
    ResumeAssessment,
    RoleAssessmentRequest,
)
from app.resume_intelligence.assessment_service import (
    create_job_description_assessment,
    create_role_assessment,
    get_assessment,
    get_latest_assessment,
)
from app.routes.resume import require_token


router = APIRouter(prefix="/resume/analysis", tags=["resume-assessment"])


def _assessment_http_error(exc: AssessmentError) -> HTTPException:
    return HTTPException(
        status_code=exc.status_code,
        detail={"code": exc.code, "message": exc.message},
    )


@router.post(
    "/match",
    response_model=ResumeAssessment,
    status_code=status.HTTP_201_CREATED,
)
def create_role_match(
    body: RoleAssessmentRequest,
    db: Database = Depends(get_db),
    user_id: str = Depends(require_token),
):
    try:
        return create_role_assessment(db, user_id, body.target_role_id)
    except AssessmentError as exc:
        raise _assessment_http_error(exc) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Resume assessment is temporarily unavailable.",
        ) from exc


@router.post(
    "/job-description",
    response_model=ResumeAssessment,
    status_code=status.HTTP_201_CREATED,
)
def create_job_description_match(
    body: JobDescriptionAssessmentRequest,
    db: Database = Depends(get_db),
    user_id: str = Depends(require_token),
):
    try:
        return create_job_description_assessment(
            db, user_id, body.job_description
        )
    except AssessmentError as exc:
        raise _assessment_http_error(exc) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Resume assessment is temporarily unavailable.",
        ) from exc


@router.get("/match/latest", response_model=ResumeAssessment)
def get_latest_match(
    mode: AssessmentMode | None = Query(default=None),
    target_role_id: str | None = Query(default=None, min_length=1, max_length=80),
    db: Database = Depends(get_db),
    user_id: str = Depends(require_token),
):
    try:
        return get_latest_assessment(
            db,
            user_id,
            mode=mode,
            target_role_id=target_role_id,
        )
    except AssessmentError as exc:
        raise _assessment_http_error(exc) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Resume assessment history is temporarily unavailable.",
        ) from exc


@router.get("/match/{assessment_id}", response_model=ResumeAssessment)
def get_match_by_id(
    assessment_id: str = Path(
        min_length=3,
        max_length=80,
        pattern=r"^ra_[a-f0-9]{24}$",
    ),
    db: Database = Depends(get_db),
    user_id: str = Depends(require_token),
):
    try:
        return get_assessment(db, user_id, assessment_id)
    except AssessmentError as exc:
        raise _assessment_http_error(exc) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail="Resume assessment history is temporarily unavailable.",
        ) from exc


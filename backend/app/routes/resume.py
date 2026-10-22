from typing import Optional
from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, Header, HTTPException, UploadFile, status
from pymongo.database import Database

from app.auth import decode_access_token
from app.database import get_db
from app.resume_intelligence.parser import (
    MAX_FILE_BYTES,
    ResumeParseError,
    analyze_extracted_document,
    build_resume_summary,
    extract_document,
    to_legacy_parsed_data,
)


router = APIRouter(prefix="/resume", tags=["resume"])


def require_token(authorization: Optional[str] = Header(default=None)) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


def _latest_resume(db: Database, user_id: str) -> Optional[dict]:
    cursor = (
        db.resumes.find({"user_id": user_id}).sort("_id", -1).limit(1)
    )
    try:
        return next(cursor)
    except StopIteration:
        return None


@router.post("/upload", status_code=status.HTTP_201_CREATED)
def upload_resume(
    file: UploadFile,
    db: Database = Depends(get_db),
    user_id: str = Depends(require_token),
):
    content = file.file.read(MAX_FILE_BYTES + 1)
    try:
        document = extract_document(
            file.filename,
            file.content_type,
            content,
        )
        analysis = analyze_extracted_document(document)
    except ResumeParseError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.message) from exc

    parsed_data = to_legacy_parsed_data(analysis)
    summary = build_resume_summary(analysis)
    analysis_document = analysis.model_dump(mode="json")

    result = db.resumes.insert_one(
        {
            "user_id": user_id,
            "raw_text": document.text,
            "parsed_data": parsed_data,
            "summary": summary,
            "analysis": analysis_document,
            "analysis_schema_version": analysis.schema_version,
            "parser_version": analysis.parser_version,
            "catalog_version": analysis.catalog_version,
        }
    )
    resume_id = result.inserted_id
    try:
        db.users.update_one(
            {"_id": ObjectId(user_id)},
            {
                "$set": {
                    "resume": {
                        "summary": summary,
                        "latest_resume_id": str(resume_id),
                        "analysis_schema_version": analysis.schema_version,
                        "analysis_catalog_version": analysis.catalog_version,
                    }
                }
            },
        )
    except Exception:
        db.resumes.delete_one({"_id": resume_id})
        raise

    return {
        "id": str(resume_id),
        "parsed_data": parsed_data,
        "summary": summary,
        "analysis": analysis_document,
    }


@router.get("/latest")
def get_latest_resume(
    db: Database = Depends(get_db),
    user_id: str = Depends(require_token),
):
    resume = _latest_resume(db, user_id)
    if resume is None:
        raise HTTPException(status_code=404, detail="No resume found")
    return {
        "id": str(resume["_id"]),
        "parsed_data": resume.get("parsed_data"),
        "raw_text": resume.get("raw_text", ""),
        "summary": resume.get("summary", ""),
        "analysis": resume.get("analysis"),
        "uploaded_at": str(resume["_id"].generation_time),
    }


@router.get("/analysis/latest")
def get_latest_resume_analysis(
    db: Database = Depends(get_db),
    user_id: str = Depends(require_token),
):
    resume = _latest_resume(db, user_id)
    if resume is None:
        raise HTTPException(status_code=404, detail="No resume found")
    analysis = resume.get("analysis")
    if not analysis:
        raise HTTPException(
            status_code=404,
            detail="No structured resume analysis found. Upload the resume again.",
        )
    return {
        "resume_id": str(resume["_id"]),
        "uploaded_at": str(resume["_id"].generation_time),
        "analysis": analysis,
    }


@router.get("/summary")
def get_resume_summary(
    db: Database = Depends(get_db),
    user_id: str = Depends(require_token),
):
    resume = _latest_resume(db, user_id)
    if resume is None:
        raise HTTPException(status_code=404, detail="No resume found")
    return {
        "summary": resume.get("summary", ""),
        "parsed_data": resume.get("parsed_data"),
        "analysis": resume.get("analysis"),
    }

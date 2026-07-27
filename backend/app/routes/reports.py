from datetime import datetime, timezone

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Header, status
from pymongo.database import Database

from app.auth import decode_access_token
from app.database import get_db
from app.schemas import ReportResponse

router = APIRouter(prefix="/reports", tags=["reports"])


def require_user_id(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


@router.post("/compile/{session_id}")
def compile_session_report(session_id: str, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    session = db.sessions.find_one({"_id": ObjectId(session_id), "user_id": user_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    answers = list(db.answers.find({"session_id": session_id}))

    scores = [a.get("correctness_result", {}).get("score", 50) for a in answers if a.get("correctness_result")]
    avg_score = sum(scores) / len(scores) if scores else 50

    fluency_scores = [a.get("fluency_score", {}).get("score", 1.0) for a in answers if a.get("fluency_score")]
    avg_fluency = sum(fluency_scores) / len(fluency_scores) if fluency_scores else 0.8

    ability = session.get("ability_profile") or {}
    overall = int(avg_score * 0.6 + avg_fluency * 40)

    report = {
        "session_id": session_id,
        "user_id": user_id,
        "compiled_report": {
            "overall_level": overall,
            "response_relevancy": round(avg_score / 100, 2),
            "communication": round(avg_fluency, 2),
            "confidence": round(ability.get("Communication", 0.5), 2),
        },
        "pdf_url": None,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }

    existing = db.reports.find_one({"session_id": session_id})
    if existing:
        db.reports.update_one({"_id": existing["_id"]}, {"$set": report})
        report_id = str(existing["_id"])
    else:
        result = db.reports.insert_one(report)
        report_id = str(result.inserted_id)

    return {**report, "id": report_id}


@router.get("/{session_id}")
def get_report(session_id: str, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    report = db.reports.find_one({"session_id": session_id, "user_id": user_id})
    if not report:
        raise HTTPException(status_code=404, detail="Report not found. Compile it first.")
    return ReportResponse(
        id=str(report["_id"]),
        session_id=report["session_id"],
        overall_level=report["compiled_report"]["overall_level"],
        response_relevancy=report["compiled_report"]["response_relevancy"],
        communication=report["compiled_report"]["communication"],
        confidence=report["compiled_report"]["confidence"],
        pdf_url=report.get("pdf_url"),
        generated_at=report["generated_at"],
    )


@router.get("/")
def list_reports(db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    reports = list(db.reports.find({"user_id": user_id}).sort("_id", -1))
    return [
        ReportResponse(
            id=str(r["_id"]),
            session_id=r["session_id"],
            overall_level=r["compiled_report"]["overall_level"],
            response_relevancy=r["compiled_report"]["response_relevancy"],
            communication=r["compiled_report"]["communication"],
            confidence=r["compiled_report"]["confidence"],
            pdf_url=r.get("pdf_url"),
            generated_at=r["generated_at"],
        )
        for r in reports
    ]

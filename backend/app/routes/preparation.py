"""Account-owned preparation plans, checklist progress, and question bookmarks."""

from datetime import date, timedelta
from hashlib import sha256
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from app.database import get_db
from app.routes.auth import require_user
from app.routes.interview_flow import owned_session
from app.interview_flow import DOMAINS
from app.coding_practice import CODING_DOMAINS

router = APIRouter(prefix="/preparation", tags=["preparation"])


def storage_key(value):
    return sha256(value.encode()).hexdigest()


class CheckRequest(BaseModel):
    key: str = Field(min_length=1, max_length=400)
    completed: bool


class BookmarkRequest(BaseModel):
    session_id: str
    question_id: str = Field(min_length=1, max_length=200)
    saved: bool


class PlanRequest(BaseModel):
    target_role: str = Field(min_length=1, max_length=120)
    domain: str
    start_date: date
    interview_date: date
    sessions_per_week: int = Field(ge=1, le=7)

    @field_validator("target_role")
    @classmethod
    def role_not_blank(cls, value):
        if not value.strip():
            raise ValueError("Enter a target role")
        return value.strip()

    @field_validator("domain")
    @classmethod
    def supported_domain(cls, value):
        if value not in DOMAINS:
            raise ValueError("Choose a supported practice domain")
        return value

    @model_validator(mode="after")
    def valid_dates(self):
        days = (self.interview_date - self.start_date).days
        if not 0 <= days <= 365:
            raise ValueError("Choose an interview date within a year of the plan start")
        return self


def build_plan(body):
    """Spread short sessions through each week, preserving date-only values."""
    tasks = []
    days = (body.interview_date - body.start_date).days
    tracks = [("technical", "Technical interview"), ("hr", "Behavioral interview"),
              ("resume", "Review your resume"), ("review", "Review saved feedback")]
    if body.domain in CODING_DOMAINS:
        tracks.insert(1, ("coding", "Coding exercises"))
    for offset in range(days + 1):
        weekday = offset % 7
        if weekday not in {i * 7 // body.sessions_per_week for i in range(body.sessions_per_week)}:
            continue
        track, title = tracks[len(tasks) % len(tracks)]
        tasks.append({
            "id": f"{body.start_date + timedelta(days=offset)}:{track}", "date": str(body.start_date + timedelta(days=offset)),
            "track": track, "title": title,
            "minutes": 15 if track in ("resume", "review") else 25,
        })
    return {"id": uuid4().hex, **body.model_dump(mode="json"), "tasks": tasks}


@router.get("")
def get_preparation(user=Depends(require_user), db=Depends(get_db)):
    data = user.get("preparation") or {}
    bookmarks = []
    # Store references only. Deleted interviews and another account's answers
    # cannot be recovered through the bookmark list.
    for reference in (data.get("bookmarks") or {}).values():
        try:
            session = owned_session(db, reference["session_id"], user)
        except HTTPException as error:
            if error.status_code == 404:
                continue
            raise
        row = next((answer for answer in session["answers"]
                    if answer["question_id"] == reference["question_id"]), None)
        if row:
            bookmarks.append({
                **reference, "question": row["question"], "hands_on": row.get("hands_on", False),
                "domain": session["domain"], "experience_level": session.get("experience_level", "mid"),
                "interview_type": session["persona"],
                "question_number": session["answers"].index(row) + 1,
            })
    return {"plan": data.get("plan"), "checks": list((data.get("checks") or {}).values()),
            "bookmarks": bookmarks}


@router.put("/check")
def save_check(body: CheckRequest, db=Depends(get_db), user=Depends(require_user)):
    value = body.model_dump()
    field = f"preparation.checks.{storage_key(body.key)}"
    db.users.update_one({"_id": user["_id"]}, {"$set": {field: value}})
    return value


@router.put("/bookmark")
def save_bookmark(body: BookmarkRequest, db=Depends(get_db), user=Depends(require_user)):
    session = owned_session(db, body.session_id, user)
    if not any(row["question_id"] == body.question_id for row in session["answers"]):
        raise HTTPException(404, "Answered question not found")
    field = f"preparation.bookmarks.{storage_key(body.session_id + ':' + body.question_id)}"
    update = {"$set": {field: {"session_id": body.session_id, "question_id": body.question_id}}}
    if not body.saved:
        update = {"$unset": {field: ""}}
    db.users.update_one({"_id": user["_id"]}, update)
    return body.model_dump()


@router.put("/plan")
def save_plan(body: PlanRequest, db=Depends(get_db), user=Depends(require_user)):
    plan = build_plan(body)
    previous = (user.get("preparation") or {}).get("plan")
    if previous and previous["target_role"] == plan["target_role"] and previous["domain"] == plan["domain"]:
        plan["id"] = previous["id"]
        plan["tasks"] = [task for task in previous["tasks"] if task["date"] < plan["start_date"]] + plan["tasks"]
    db.users.update_one({"_id": user["_id"]}, {"$set": {"preparation.plan": plan}})
    return plan

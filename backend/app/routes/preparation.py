"""Account-owned preparation plans, checklist progress, and question bookmarks."""

from datetime import date, timedelta
from hashlib import sha256
from uuid import uuid4
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from app.database import get_db
from app.mail import mail_ready
from app.reminders import ReminderSettings
from app.routes.auth import require_user
from app.routes.interview_flow import owned_session
from app.interview_flow import DOMAINS
from app.coding_practice import CODING_DOMAINS
from app.practice_topics import TOPICS
from app.job_preparation import preparation_topics, suggest_topics
from app.resume_intelligence.assessment_errors import AssessmentError
from app.resume_intelligence.assessment_schemas import MAX_JOB_DESCRIPTION_CHARS

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


class PlanTask(BaseModel):
    id: str = Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9:_-]+$")
    date: date
    track: Literal["technical", "hr", "coding", "resume", "review"]
    title: str = Field(min_length=1, max_length=160)
    minutes: int = Field(ge=5, le=120)
    topic: str | None = None

    @field_validator("title")
    @classmethod
    def nonblank_title(cls, value):
        if not value.strip():
            raise ValueError("Enter a session title")
        return value.strip()


class PlanRequest(BaseModel):
    target_role: str = Field(min_length=1, max_length=120)
    domain: str
    start_date: date
    interview_date: date
    sessions_per_week: int = Field(ge=1, le=7)

    topic_ids: list[str] | None = Field(default=None, min_length=1, max_length=12)
    tasks: list[PlanTask] | None = Field(default=None, min_length=1, max_length=366)

    @field_validator("topic_ids")
    @classmethod
    def supported_topics(cls, value):
        if value is not None and (len(set(value)) != len(value) or any(key not in TOPICS for key in value)):
            raise ValueError("Choose unique supported topics")
        return value

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
        if self.tasks is not None:
            if self.topic_ids is None:
                raise ValueError("Custom sessions require selected preparation topics")
            if len({task.id for task in self.tasks}) != len(self.tasks):
                raise ValueError("Session identifiers must be unique")
            for task in self.tasks:
                if not self.start_date <= task.date <= self.interview_date:
                    raise ValueError("Session dates must fall within the plan dates")
                if task.track != "technical" or task.topic not in self.topic_ids:
                    raise ValueError("Choose a selected topic for every job preparation session")
        return self


class JobPreparationRequest(PlanRequest):
    job_description: str = Field(min_length=40, max_length=MAX_JOB_DESCRIPTION_CHARS)


@router.get("/topics")
def get_topics(user=Depends(require_user)):
    return {"topics": preparation_topics()}


@router.post("/job-description")
def draft_job_preparation(body: JobPreparationRequest, user=Depends(require_user)):
    try:
        suggestions, uncovered = suggest_topics(body.job_description)
    except AssessmentError as error:
        raise HTTPException(error.status_code, error.message) from error
    if not suggestions:
        raise HTTPException(422, "No supported practice topics were found. Include the role's technical skills, or create a general preparation plan below.")
    settings = body.model_dump(exclude={"job_description", "tasks", "topic_ids"})
    plan = build_plan(PlanRequest(**settings, topic_ids=[item["id"] for item in suggestions]))
    return {"plan": plan, "suggestions": suggestions, "uncovered_skills": uncovered}


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
    if body.topic_ids:
        for index, task in enumerate(tasks):
            topic = body.topic_ids[index % len(body.topic_ids)]
            task.update(id=f"{task['date']}:{topic}", track="technical", topic=topic,
                        title=f"Practice {TOPICS[topic][0]}", minutes=25)
    if body.tasks is not None:
        tasks = sorted((task.model_dump(mode="json") for task in body.tasks), key=lambda task: task["date"])
    return {"id": uuid4().hex, **body.model_dump(mode="json", exclude={"tasks"}), "tasks": tasks}


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
    if previous and previous.get("topic_ids") == plan.get("topic_ids") and previous["target_role"] == plan["target_role"] and previous["domain"] == plan["domain"]:
        plan["id"] = previous["id"]
        if not plan.get("topic_ids"):
            plan["tasks"] = [task for task in previous["tasks"] if task["date"] < plan["start_date"]] + plan["tasks"]
    db.users.update_one({"_id": user["_id"]}, {"$set": {"preparation.plan": plan}})
    return plan


@router.get("/reminders")
def get_reminders(user=Depends(require_user)):
    settings = (user.get("preparation") or {}).get("reminder")
    return {"settings": ReminderSettings.model_validate(settings).model_dump() if settings else None,
            "email_available": mail_ready(), "email_verified": user.get("email_verified", False)}


@router.put("/reminders")
def save_reminders(body: ReminderSettings, db=Depends(get_db), user=Depends(require_user)):
    preparation = user.get("preparation") or {}
    if body.enabled:
        if not mail_ready():
            raise HTTPException(503, "Email delivery is unavailable.")
        if not user.get("email_verified"):
            raise HTTPException(409, "Verify your email to enable practice reminders.")
        if not preparation.get("plan") or not body.days:
            raise HTTPException(422, "Save a plan and choose at least one reminder day.")
    value = body.model_dump()
    db.users.update_one({"_id": user["_id"]}, {"$set": {
        f"preparation.reminder.{key}": setting for key, setting in value.items()
    }})
    return value

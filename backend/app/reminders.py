"""Local-time weekly reminder scheduling and atomic delivery claims."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from pydantic import BaseModel, Field, field_validator

from app.mail import app_url, mail_ready, send_email

logger = logging.getLogger(__name__)


class ReminderSettings(BaseModel):
    enabled: bool
    days: list[int] = Field(max_length=7)
    time: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    timezone: str = Field(max_length=80)

    @field_validator("days")
    @classmethod
    def valid_days(cls, value):
        if any(day not in range(7) for day in value):
            raise ValueError("Choose valid reminder days")
        return sorted(set(value))

    @field_validator("timezone")
    @classmethod
    def valid_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError):
            raise ValueError("Choose a valid time zone") from None
        return value


def due_slot(settings, now):
    zone = ZoneInfo(settings["timezone"])
    local = now.astimezone(zone)
    hour, minute = map(int, settings["time"].split(":"))
    for offset in (0, 1):
        day = local.date() - timedelta(days=offset)
        if day.weekday() not in settings["days"]:
            continue
        slot = datetime(day.year, day.month, day.day, hour, minute, tzinfo=zone).astimezone(timezone.utc)
        # A spring-forward time that does not exist is skipped.
        if slot.astimezone(zone).strftime("%H:%M") != settings["time"]:
            continue
        if timedelta(0) <= now - slot < timedelta(hours=1):
            return day.isoformat()
    return None


def deliver_due_reminders(db, now):
    if not mail_ready():
        return
    candidates = db.users.find({"email_verified": True, "preparation.reminder.enabled": True},
                              {"email": 1, "preparation.reminder": 1, "preparation.plan.interview_date": 1})
    for user in candidates:
        prep = user["preparation"]
        settings = prep["reminder"]
        today = now.astimezone(ZoneInfo(settings["timezone"])).date().isoformat()
        if (prep.get("plan") or {}).get("interview_date", "") < today:
            continue
        slot = due_slot(settings, now)
        if not slot or settings.get("last_slot") == slot:
            continue
        query = {"_id": user["_id"], "email_verified": True, "preparation.reminder": settings,
                 "preparation.plan.interview_date": {"$gte": today}}
        if not db.users.update_one(query, {"$set": {
            "preparation.reminder.last_slot": slot,
        }}).modified_count:
            continue
        try:
            send_email(user["email"], "Time for InterviewSpar practice",
                       f"Your preparation plan is ready when you are.\n{app_url('/preparation')}\n\nManage or turn off reminders from Preparation.")
        except Exception:
            logger.warning("Practice reminder delivery failed")


async def reminder_loop(db):
    while True:
        try:
            await asyncio.to_thread(deliver_due_reminders, db, datetime.now(timezone.utc))
        except Exception:
            logger.warning("Practice reminder check failed")
        await asyncio.sleep(60)

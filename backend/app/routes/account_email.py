"""Single-use account links stored as hashes on the account they belong to."""
import logging
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from secrets import token_urlsafe

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field, field_validator

from app.auth import hash_password
from app.database import get_db
from app.mail import app_url, mail_ready, send_email
from app.routes.auth import require_user
from app.schemas import SignupRequest

router = APIRouter(prefix="/auth", tags=["account email"])
logger = logging.getLogger(__name__)


class EmailRequest(BaseModel):
    email: EmailStr


class LinkRequest(BaseModel):
    token: str = Field(min_length=32, max_length=128)


class ResetRequest(LinkRequest):
    password: str

    @field_validator("password")
    @classmethod
    def password_rules(cls, value):
        return SignupRequest.validate_password(value)


def digest(token):
    return sha256(token.encode()).hexdigest()


def issue_link(db, user, purpose):
    if not user or (purpose == "verify" and user.get("email_verified")):
        return
    now = datetime.now(timezone.utc)
    token = token_urlsafe(32)
    field = f"email_links.{purpose}"
    query = {"_id": user["_id"], "$or": [
        {f"{field}.sent": {"$exists": False}},
        {f"{field}.sent": {"$lte": now - timedelta(minutes=2)}},
    ]}
    if purpose == "verify":
        query["email_verified"] = {"$ne": True}
    lifetime = 30 if purpose == "reset" else 24 * 60
    if not db.users.update_one(query, {"$set": {field: {
        "hash": digest(token), "sent": now, "expires": now + timedelta(minutes=lifetime),
        "password_version": user.get("hashed_password") if purpose == "reset" else None,
    }}}).modified_count:
        return
    path = "/reset-password" if purpose == "reset" else "/verify-email"
    subject = "Reset your InterviewSpar password" if purpose == "reset" else "Verify your InterviewSpar email"
    try:
        send_email(user["email"], subject, f"{subject}:\n{app_url(path)}#token={token}\n\nThis link expires in {lifetime} minutes.")
    except Exception:
        logger.warning("Account email delivery failed (%s)", purpose)


def require_mail():
    if not mail_ready():
        raise HTTPException(503, "Email delivery is unavailable. Please try again later.")


@router.post("/forgot-password", status_code=202)
def forgot_password(body: EmailRequest, background: BackgroundTasks, db=Depends(get_db)):
    require_mail()
    background.add_task(issue_link, db, db.users.find_one({"email": str(body.email).lower()}), "reset")
    return {"message": "If an account exists for this address, a password reset link will be sent."}


@router.post("/verification-email", status_code=202)
def verification_email(background: BackgroundTasks, db=Depends(get_db), user=Depends(require_user)):
    require_mail()
    background.add_task(issue_link, db, user, "verify")
    return {"message": "Check your inbox for a verification link. Allow a few minutes for delivery."}


def consume_link(db, token, purpose, updates):
    field = f"email_links.{purpose}"
    query = {f"{field}.hash": digest(token), f"{field}.expires": {"$gt": datetime.now(timezone.utc)}}
    if purpose == "reset":
        query["$expr"] = {"$eq": ["$hashed_password", f"${field}.password_version"]}
    updates["$unset"] = {field: ""}
    if db.users.update_one(query, updates).modified_count != 1:
        raise HTTPException(400, "This link is invalid, expired, or already used. Request a new link.")


@router.post("/reset-password")
def reset_password(body: ResetRequest, db=Depends(get_db)):
    consume_link(db, body.token, "reset", {
        "$set": {"hashed_password": hash_password(body.password)},
        "$inc": {"token_version": 1},
    })
    return {"message": "Password updated. Sign in with your new password."}


@router.post("/verify-email")
def verify_email(body: LinkRequest, db=Depends(get_db)):
    consume_link(db, body.token, "verify", {"$set": {"email_verified": True}})
    return {"message": "Email verified."}

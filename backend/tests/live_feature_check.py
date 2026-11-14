"""Exercise the additions on local MongoDB with an in-memory mail inbox.

Run from backend with MONGODB_URL=mongodb://127.0.0.1:27028.
"""
from datetime import datetime, timedelta, timezone
import os
from pathlib import Path
import sys
from unittest.mock import patch
from urllib.parse import urlsplit
from uuid import uuid4

from fastapi.testclient import TestClient
from pymongo import MongoClient

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
origin = os.environ["MONGODB_URL"]
assert urlsplit(origin).hostname in {"localhost", "127.0.0.1"}
database = f"interspars_features_{uuid4().hex}"
os.environ["MONGODB_DATABASE"] = database
os.environ["PUBLIC_APP_URL"] = "http://localhost:5173"
os.environ["SMTP_HOST"] = "captured.example"
os.environ["SMTP_FROM"] = "practice@example.com"

from main import app
from app.reminders import deliver_due_reminders


def run(client, db, inbox):
    email = "feature@example.com"
    password = "Initial-pass-229"
    response = client.post("/api/auth/signup", json={"email":email, "name":"Feature tester", "password":password})
    assert response.status_code == 201
    headers = {"Authorization": "Bearer " + response.json()["access_token"]}
    assert client.post("/api/auth/verification-email", headers=headers).status_code == 202
    verify = inbox[-1][2].split("#token=")[1].split()[0]
    assert client.post("/api/auth/verify-email", json={"token":verify}).status_code == 200
    assert client.post("/api/auth/verify-email", json={"token":verify}).status_code == 400
    assert client.get("/api/auth/me", headers=headers).json()["email_verified"]
    known = client.post("/api/auth/forgot-password", json={"email":email})
    unknown = client.post("/api/auth/forgot-password", json={"email":"missing@example.com"})
    assert known.status_code == unknown.status_code == 202 and known.json() == unknown.json()
    reset = inbox[-1][2].split("#token=")[1].split()[0]
    new_password = "Changed-pass-229"
    reset_body = {"token":reset, "password":new_password}
    assert client.post("/api/auth/reset-password", json=reset_body).status_code == 200
    assert client.post("/api/auth/reset-password", json=reset_body).status_code == 400
    assert client.get("/api/auth/me", headers=headers).status_code == 401
    assert client.post("/api/auth/login", json={"email":email,"password":password}).status_code == 401
    login = client.post("/api/auth/login", json={"email":email,"password":new_password})
    headers = {"Authorization":"Bearer " + login.json()["access_token"]}
    print("PASS verification, neutral recovery response, single-use links, and credential revocation")

    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    plan = {"target_role":"Backend developer","domain":"Backend","start_date":now.date().isoformat(),
            "interview_date":(now.date() + timedelta(days=7)).isoformat(),"sessions_per_week":3}
    assert client.put("/api/preparation/plan", headers=headers, json=plan).status_code == 200
    settings = {"enabled":True,"days":[now.weekday()],"time":now.strftime("%H:%M"),"timezone":"UTC"}
    assert client.put("/api/preparation/reminders", headers=headers, json=settings).status_code == 200
    assert client.get("/api/preparation/reminders", headers=headers).json()["settings"] == settings
    count = len(inbox)
    deliver_due_reminders(db, now)
    deliver_due_reminders(db, now)
    assert len(inbox) == count + 1
    assert client.put("/api/preparation/reminders", headers=headers, json={**settings,"enabled":False}).status_code == 200
    deliver_due_reminders(db, now + timedelta(days=7))
    assert len(inbox) == count + 1
    print("PASS opt-in reminder delivery, deduplication, and opt-out")

    start = {"save_consent":True,"domain":"Backend","focus_topic":"rest-apis"}
    session = client.post("/api/interview/start", headers=headers, json=start).json()
    question = session["current_question"]["id"]
    def submit(session, answer):
        return client.post("/api/interview/answer", headers=headers, json={
            "session_id":session["id"], "question_id":session["current_question"]["id"],
            "version":session["version"],"request_id":uuid4().hex,"answer":answer,
        })
    response = submit(session, "A request should use an idempotency key stored alongside the order in the database.")
    assert response.status_code == 200, response.text
    path = f"/api/interview/{session['id']}"
    assert client.post(path + "/complete", headers=headers).status_code == 200
    report = client.get(path + "/feedback", headers=headers).json()
    assert report["qa_pairs"][0]["guidance"]["example"]
    flag = {"question_id":question,"reason":"questionable-feedback","note":"Please review the wording."}
    assert client.post(path + "/question-flags",headers=headers,json=flag).status_code == 201
    assert client.post(path + "/question-flags",headers=headers,json=flag).status_code == 201
    assert db.question_flags.count_documents({}) == 1
    another = client.post("/api/auth/signup",json={"email":"other-feature@example.com","name":"Other","password":password}).json()
    assert client.post(path + "/question-flags",headers={"Authorization":"Bearer "+another["access_token"]},json=flag).status_code == 404
    retry = client.post("/api/interview/start",headers=headers,json={"save_consent":True,"domain":"Backend",
        "retry_session_id":session["id"],"retry_question_id":question}).json()
    assert submit(retry, "For example, I built a project with idempotency keys because retries can duplicate an order. I measured the result by replaying requests and checking for one record.").status_code == 200
    skills = client.get("/api/interview/skill-progress",headers=headers).json()["skills"]
    assert skills[0]["comparable_attempts"] == 2 and skills[0]["latest"] > skills[0]["previous"]
    print("PASS report guidance, flag ownership and deduplication, and comparable skill progress")


if __name__ == "__main__":
    mongo = MongoClient(origin)
    inbox = []
    def capture(*message):
        inbox.append(message)
    try:
        with patch("app.routes.account_email.send_email", capture), patch("app.reminders.send_email", capture):
            with TestClient(app) as client:
                run(client, mongo[database], inbox)
    finally:
        mongo.drop_database(database)
        mongo.close()

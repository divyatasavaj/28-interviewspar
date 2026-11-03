import os

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.server_api import ServerApi

load_dotenv()

MONGODB_URL = os.environ["MONGODB_URL"]

client = MongoClient(MONGODB_URL, server_api=ServerApi("1"))
db = client["interspars"]


def get_db():
    return db


def init_db():
    try:
        client.admin.command("ping")
        print("MongoDB connected successfully")

        db.users.create_index("email", unique=True)

        db.questions.create_index([("domain", 1), ("difficulty", 1)])

        db.sessions.create_index("user_id")
        db.sessions.create_index([("user_id", 1), ("status", 1)])

        db.answers.create_index("session_id")
        db.answers.create_index([("session_id", 1), ("question_id", 1)])

        db.integrity_logs.create_index("session_id")

        db.reports.create_index("session_id")
        db.reports.create_index("user_id")

        db.feedback.create_index("user_id")
        db.feedback.create_index("session_id")

        db.resumes.create_index([("user_id", 1), ("_id", -1)])

        db.resume_assessments.create_index("assessment_id", unique=True)
        db.resume_assessments.create_index([("user_id", 1), ("created_at", -1)])
        db.resume_assessments.create_index(
            [("user_id", 1), ("assessment_mode", 1), ("created_at", -1)]
        )
        db.resume_assessments.create_index(
            [("user_id", 1), ("target_role_id", 1), ("created_at", -1)]
        )

        db.job_postings.create_index("record_id", unique=True)
        db.job_postings.create_index("source_id")
        db.job_postings.create_index("content_fingerprint")
        db.job_postings.create_index([("normalized_role_id", 1), ("posted_at", -1)])
        db.job_market_ingestion_runs.create_index("run_id", unique=True)
        db.job_market_ingestion_runs.create_index("dataset_version")
        db.unknown_job_skills.create_index("normalized_term", unique=True)
        db.role_rubrics.create_index([("role_id", 1), ("version", 1)], unique=True)

        db.video_sessions.create_index("user_id")
        db.video_sessions.create_index("interview_session_id")

        print("MongoDB indexes created")
    except Exception as e:
        print(f"MongoDB connection failed: {e}")

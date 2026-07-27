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

        db.video_sessions.create_index("user_id")
        db.video_sessions.create_index("interview_session_id")

        print("MongoDB indexes created")
    except Exception as e:
        print(f"MongoDB connection failed: {e}")

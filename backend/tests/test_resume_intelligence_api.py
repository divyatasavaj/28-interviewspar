from __future__ import annotations

import io
import json
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017/interviewspar_test")
os.environ.setdefault("JWT_SECRET", "resume-intelligence-test-secret")

import docx
from bson.objectid import ObjectId
from fastapi import HTTPException

from app.auth import create_access_token
from app.routes.resume import (
    get_latest_resume,
    get_latest_resume_analysis,
    require_token,
    upload_resume,
)


def make_docx(paragraphs: list[str]) -> bytes:
    document = docx.Document()
    for value in paragraphs:
        document.add_paragraph(value)
    buffer = io.BytesIO()
    document.save(buffer)
    return buffer.getvalue()


class FakeUpload:
    def __init__(
        self,
        filename: str,
        content: bytes,
        content_type: str | None = None,
    ):
        self.filename = filename
        self.content_type = content_type
        self.file = io.BytesIO(content)


class FakeCursor:
    def __init__(self, documents: list[dict]):
        self.documents = documents

    def sort(self, key: str, direction: int):
        self.documents.sort(key=lambda item: item[key], reverse=direction < 0)
        return self

    def limit(self, count: int):
        self.documents = self.documents[:count]
        return self

    def __iter__(self):
        return iter(self.documents)

    def __next__(self):
        if not self.documents:
            raise StopIteration
        return self.documents.pop(0)


class FakeResumes:
    def __init__(self, documents: list[dict] | None = None):
        self.documents = documents or []
        self.last_query = None

    def find(self, query: dict):
        self.last_query = query
        return FakeCursor(
            [document for document in self.documents if document["user_id"] == query["user_id"]]
        )

    def insert_one(self, document: dict):
        stored = dict(document)
        stored["_id"] = ObjectId()
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])

    def delete_one(self, query: dict):
        self.documents = [
            document for document in self.documents if document["_id"] != query["_id"]
        ]
        return SimpleNamespace(deleted_count=1)


class FakeUsers:
    def __init__(self):
        self.last_filter = None
        self.last_update = None

    def update_one(self, query: dict, update: dict):
        self.last_filter = query
        self.last_update = update
        return SimpleNamespace(modified_count=1)


class FakeDatabase:
    def __init__(self, documents: list[dict] | None = None):
        self.resumes = FakeResumes(documents)
        self.users = FakeUsers()


class ResumeApiTests(unittest.TestCase):
    def test_upload_uses_parser_and_stores_analysis(self) -> None:
        content = make_docx(
            [
                "john@example.com",
                "TECHNICAL SKILLS",
                "Python, React",
                "PROJECTS",
                "Built a Python API.",
            ]
        )
        db = FakeDatabase()
        user_id = str(ObjectId())
        response = upload_resume(
            FakeUpload(
                "resume.docx",
                content,
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ),
            db,
            user_id,
        )
        self.assertTrue(response["id"])
        self.assertEqual(response["analysis"]["schema_version"], "resume-intelligence-v1")
        self.assertIn("Python", response["parsed_data"]["skills"])
        self.assertNotIn("raw_text", response)
        stored = db.resumes.documents[0]
        self.assertEqual(stored["user_id"], user_id)
        self.assertIn("john@example.com", stored["raw_text"])
        self.assertNotIn("john@example.com", json.dumps(stored["analysis"]))
        self.assertEqual(db.users.last_filter["_id"], ObjectId(user_id))
        user_resume = db.users.last_update["$set"]["resume"]
        self.assertEqual(user_resume["latest_resume_id"], response["id"])
        self.assertNotIn("raw_text", user_resume)
        self.assertNotIn("john@example.com", user_resume["summary"])

    def test_invalid_upload_returns_client_error_and_stores_nothing(self) -> None:
        db = FakeDatabase()
        with self.assertRaises(HTTPException) as raised:
            upload_resume(FakeUpload("resume.txt", b"hello"), db, str(ObjectId()))
        self.assertEqual(raised.exception.status_code, 415)
        self.assertEqual(db.resumes.documents, [])

    def test_analysis_endpoint_is_scoped_to_the_authenticated_user(self) -> None:
        owner_id = str(ObjectId())
        other_id = str(ObjectId())
        document = {
            "_id": ObjectId(),
            "user_id": owner_id,
            "raw_text": "private resume",
            "parsed_data": {},
            "summary": "summary",
            "analysis": {"schema_version": "resume-intelligence-v1"},
        }
        db = FakeDatabase([document])
        response = get_latest_resume_analysis(db, owner_id)
        self.assertEqual(response["analysis"]["schema_version"], "resume-intelligence-v1")
        self.assertEqual(db.resumes.last_query, {"user_id": owner_id})
        with self.assertRaises(HTTPException) as raised:
            get_latest_resume_analysis(db, other_id)
        self.assertEqual(raised.exception.status_code, 404)
        with self.assertRaises(HTTPException):
            get_latest_resume(db, other_id)

    def test_old_resume_without_analysis_returns_clear_error(self) -> None:
        user_id = str(ObjectId())
        db = FakeDatabase(
            [{"_id": ObjectId(), "user_id": user_id, "parsed_data": {}}]
        )
        with self.assertRaises(HTTPException) as raised:
            get_latest_resume_analysis(db, user_id)
        self.assertEqual(raised.exception.status_code, 404)
        self.assertIn("Upload the resume again", raised.exception.detail)

    def test_existing_jwt_auth_is_reused(self) -> None:
        user_id = str(ObjectId())
        token = create_access_token(user_id)
        self.assertEqual(require_token(f"Bearer {token}"), user_id)
        with self.assertRaises(HTTPException) as invalid:
            require_token("Bearer invalid-token")
        self.assertEqual(invalid.exception.status_code, 401)
        with self.assertRaises(HTTPException):
            require_token("Basic credentials")


if __name__ == "__main__":
    unittest.main()

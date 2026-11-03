from __future__ import annotations

import json
import os
import sys
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

os.environ.setdefault("MONGODB_URL", "mongodb://localhost:27017/interviewspar_test")
os.environ.setdefault("JWT_SECRET", "resume-intelligence-test-secret")

from bson.objectid import ObjectId
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.auth import create_access_token
from app.database import get_db
from app.resume_intelligence.assessment_schemas import (
    JobDescriptionAssessmentRequest,
    RoleAssessmentRequest,
)
from app.resume_intelligence.assessment_service import (
    create_job_description_assessment,
    create_role_assessment,
    get_assessment,
    get_latest_assessment,
)
from app.resume_intelligence.catalog import load_catalog
from app.routes.resume import require_token
from app.routes.resume_assessment import (
    create_job_description_match,
    create_role_match,
    get_latest_match,
    get_match_by_id,
    router,
)
from assessment_helpers import FakeDatabase, make_analysis, synthetic_resume_document


USER_ID = str(ObjectId())
OTHER_USER_ID = str(ObjectId())
JOB_DESCRIPTION = (
    "Required skills: Python, SQL. Preferred skills: Docker. "
    "This role supports a confidential initiative and is a synthetic API fixture."
)


class AssessmentApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalog = load_catalog()

    def _db(self) -> FakeDatabase:
        analysis = make_analysis(
            self.catalog,
            [("python", "demonstrated_outcome"), ("sql", "listed")],
            project_descriptions=["Built a synthetic service and reduced runtime by 20%."],
        )
        return FakeDatabase([synthetic_resume_document(USER_ID, analysis)])

    def test_role_assessment_uses_authenticated_user_and_stores_no_raw_resume(self) -> None:
        db = self._db()
        response = create_role_match(
            RoleAssessmentRequest(target_role_id="software-engineer-sde"),
            db,
            USER_ID,
        )

        self.assertEqual(response.target_role_id, "software-engineer-sde")
        self.assertIsNone(response.score)
        self.assertEqual(len(db.resume_assessments.documents), 1)
        stored = db.resume_assessments.documents[0]
        self.assertEqual(stored["user_id"], USER_ID)
        self.assertEqual(stored["assessment_id"], response.assessment_id)
        serialized = json.dumps(stored, default=str)
        self.assertNotIn("Synthetic fixture text", serialized)
        self.assertNotIn("raw_text", stored)
        self.assertNotIn("raw job description", serialized)

    def test_repeated_role_request_is_idempotent(self) -> None:
        db = self._db()
        body = RoleAssessmentRequest(target_role_id="frontend-developer")

        first = create_role_match(body, db, USER_ID)
        second = create_role_match(body, db, USER_ID)

        self.assertEqual(first.assessment_id, second.assessment_id)
        self.assertEqual(len(db.resume_assessments.documents), 1)

    def test_job_description_is_stored_as_a_hash_only(self) -> None:
        db = self._db()
        response = create_job_description_match(
            JobDescriptionAssessmentRequest(job_description=JOB_DESCRIPTION),
            db,
            USER_ID,
        )

        self.assertIsNotNone(response.job_description_reference)
        assert response.job_description_reference is not None
        self.assertEqual(response.job_description_reference.character_count, len(JOB_DESCRIPTION))
        self.assertEqual(response.job_description_reference.retention, "hash_only")
        serialized = json.dumps(db.resume_assessments.documents[0], default=str)
        self.assertNotIn("confidential initiative", serialized)
        self.assertIn(response.job_description_reference.sha256, serialized)

    def test_history_and_mode_filters_are_user_scoped(self) -> None:
        db = self._db()
        role = create_role_assessment(db, USER_ID, "data-analyst", catalog=self.catalog)
        job = create_job_description_assessment(
            db, USER_ID, JOB_DESCRIPTION, catalog=self.catalog
        )

        latest = get_latest_assessment(db, USER_ID)
        latest_role = get_latest_assessment(db, USER_ID, mode="role")
        latest_role_filtered = get_latest_assessment(
            db, USER_ID, mode="role", target_role_id="data-analyst"
        )
        self.assertIn(latest.assessment_id, {role.assessment_id, job.assessment_id})
        self.assertEqual(latest_role.assessment_id, role.assessment_id)
        self.assertEqual(latest_role_filtered.assessment_id, role.assessment_id)
        with self.assertRaises(Exception) as other:
            get_latest_assessment(db, OTHER_USER_ID)
        self.assertEqual(getattr(other.exception, "status_code", None), 404)

    def test_specific_assessment_cannot_be_read_by_another_user(self) -> None:
        db = self._db()
        assessment = create_role_assessment(
            db, USER_ID, "backend-developer", catalog=self.catalog
        )
        self.assertEqual(
            get_assessment(db, USER_ID, assessment.assessment_id).assessment_id,
            assessment.assessment_id,
        )
        with self.assertRaises(HTTPException) as raised:
            get_match_by_id(assessment.assessment_id, db, OTHER_USER_ID)
        self.assertEqual(raised.exception.status_code, 404)

    def test_missing_resume_returns_clear_404(self) -> None:
        db = FakeDatabase()
        with self.assertRaises(HTTPException) as raised:
            create_role_match(
                RoleAssessmentRequest(target_role_id="frontend-developer"),
                db,
                USER_ID,
            )
        self.assertEqual(raised.exception.status_code, 404)
        self.assertIn("No resume found", raised.exception.detail["message"])

    def test_missing_or_malformed_stored_analysis_returns_409(self) -> None:
        missing_db = FakeDatabase(
            [{"_id": ObjectId(), "user_id": USER_ID, "raw_text": "synthetic"}]
        )
        with self.assertRaises(HTTPException) as missing:
            create_role_match(
                RoleAssessmentRequest(target_role_id="frontend-developer"),
                missing_db,
                USER_ID,
            )
        self.assertEqual(missing.exception.status_code, 409)

        malformed_db = FakeDatabase(
            [
                {
                    "_id": ObjectId(),
                    "user_id": USER_ID,
                    "analysis": {"schema_version": "resume-intelligence-v1"},
                }
            ]
        )
        with self.assertRaises(HTTPException) as malformed:
            create_role_match(
                RoleAssessmentRequest(target_role_id="frontend-developer"),
                malformed_db,
                USER_ID,
            )
        self.assertEqual(malformed.exception.status_code, 409)
        self.assertEqual(
            malformed.exception.detail["code"], "resume_analysis_invalid"
        )

    def test_invalid_or_unavailable_role_is_rejected(self) -> None:
        db = self._db()
        with self.assertRaises(HTTPException) as unknown:
            create_role_match(
                RoleAssessmentRequest(target_role_id="not-a-real-role"),
                db,
                USER_ID,
            )
        self.assertEqual(unknown.exception.status_code, 404)
        with self.assertRaises(HTTPException) as no_rubric:
            create_role_match(
                RoleAssessmentRequest(target_role_id="qa-engineer"),
                db,
                USER_ID,
            )
        self.assertEqual(no_rubric.exception.status_code, 404)

    def test_malformed_request_bodies_are_rejected_before_assessment(self) -> None:
        with self.assertRaises(ValidationError):
            RoleAssessmentRequest(target_role_id="not a valid id")
        with self.assertRaises(ValidationError):
            RoleAssessmentRequest(target_role_id="frontend-developer", user_id=USER_ID)
        with self.assertRaises(ValidationError):
            JobDescriptionAssessmentRequest(job_description="   ")
        with self.assertRaises(ValidationError):
            JobDescriptionAssessmentRequest(job_description="Python " * 3000)

    def test_job_description_with_unknown_only_terms_returns_no_score(self) -> None:
        db = self._db()
        response = create_job_description_match(
            JobDescriptionAssessmentRequest(
                job_description="Experience with Zig for systems work in an engineering team."
            ),
            db,
            USER_ID,
        )
        self.assertIsNone(response.score)
        self.assertEqual(response.unknown_requirements[0].source_term, "Zig")

    def test_storage_failure_does_not_leak_internals(self) -> None:
        db = self._db()
        db.resume_assessments.fail_writes = True
        with self.assertRaises(HTTPException) as raised:
            create_role_match(
                RoleAssessmentRequest(target_role_id="software-engineer-sde"),
                db,
                USER_ID,
            )
        self.assertEqual(raised.exception.status_code, 503)
        self.assertEqual(
            raised.exception.detail, "Resume assessment is temporarily unavailable."
        )

    def test_missing_and_invalid_jwt_headers_return_401(self) -> None:
        with self.assertRaises(HTTPException) as missing:
            require_token(None)
        self.assertEqual(missing.exception.status_code, 401)
        with self.assertRaises(HTTPException) as invalid:
            require_token("Bearer invalid-token")
        self.assertEqual(invalid.exception.status_code, 401)

    def test_http_route_requires_authentication(self) -> None:
        db = self._db()
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_db] = lambda: db
        with TestClient(app) as client:
            response = client.post(
                "/resume/analysis/match",
                json={"target_role_id": "frontend-developer"},
            )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(db.resume_assessments.documents, [])

    def test_http_route_accepts_existing_jwt_and_returns_typed_response(self) -> None:
        db = self._db()
        app = FastAPI()
        app.include_router(router)
        app.dependency_overrides[get_db] = lambda: db
        token = create_access_token(USER_ID)
        with TestClient(app) as client:
            response = client.post(
                "/resume/analysis/match",
                json={"target_role_id": "software-engineer-sde"},
                headers={"Authorization": f"Bearer {token}"},
            )
        self.assertEqual(response.status_code, 201, response.text)
        payload = response.json()
        self.assertEqual(payload["schema_version"], "resume-assessment-v1")
        self.assertIsNone(payload["score"])
        self.assertEqual(payload["target_role_id"], "software-engineer-sde")

    def test_latest_route_returns_404_when_history_is_empty(self) -> None:
        db = self._db()
        with self.assertRaises(HTTPException) as raised:
            get_latest_match(None, None, db, USER_ID)
        self.assertEqual(raised.exception.status_code, 404)

    def test_backward_compatibility_with_existing_resume_endpoints(self) -> None:
        db = self._db()
        from app.routes.resume import get_latest_resume, get_latest_resume_analysis
        latest_res = get_latest_resume(db, USER_ID)
        self.assertIsNotNone(latest_res["parsed_data"])
        self.assertIsNotNone(latest_res["analysis"])

        latest_analysis = get_latest_resume_analysis(db, USER_ID)
        self.assertIsNotNone(latest_analysis["analysis"])
        self.assertEqual(latest_analysis["resume_id"], str(db.resumes.documents[0]["_id"]))

    def test_all_five_roles_via_match_endpoint(self) -> None:
        db = self._db()
        target_roles = [
            "software-engineer-sde",
            "frontend-developer",
            "backend-developer",
            "data-analyst",
            "machine-learning-engineer",
        ]
        for role_id in target_roles:
            response = create_role_match(
                RoleAssessmentRequest(target_role_id=role_id),
                db,
                USER_ID,
            )
            self.assertEqual(response.target_role_id, role_id)
            self.assertIsNone(response.score)
            self.assertEqual(response.assessment_status.value, "preliminary")


if __name__ == "__main__":
    unittest.main()


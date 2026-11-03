"""HTTP regressions against synthetic memory collections; never a live database."""

import copy, io, os, sys, unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ.update(
    MONGODB_URL="mongodb://127.0.0.1:27017/interviewspar_test",
    JWT_SECRET="test-only-key-with-sufficient-entropy",
    GROQ_API_KEY="",
    JUDGE0_API_URL="",
)
from bson import ObjectId
from fastapi.testclient import TestClient
import docx
from main import app, requests
from app.database import get_db
from app.interview_flow import make_questions, DOMAINS
from app.safe_execution import run_problem


class Cursor:
    def __init__(self, docs):
        self.docs = docs

    def sort(self, key, direction):
        self.docs.sort(key=lambda d: d[key], reverse=direction < 0)
        return self

    def limit(self, count):
        self.docs = self.docs[:count]
        return self

    def __iter__(self):
        return self

    def __next__(self):
        if not self.docs:
            raise StopIteration
        return self.docs.pop(0)


class Collection:
    def __init__(self):
        self.docs = []

    def matches(self, doc, query):
        return all(doc.get(k) == v for k, v in query.items())

    def find(self, query):
        return Cursor([copy.deepcopy(d) for d in self.docs if self.matches(d, query)])

    def find_one(self, query):
        return next(iter(self.find(query)), None)

    def insert_one(self, doc):
        doc = copy.deepcopy(doc)
        doc.setdefault("_id", ObjectId())
        self.docs.append(doc)
        return SimpleNamespace(inserted_id=doc["_id"])

    def update_one(self, query, update, **kwargs):
        for d in self.docs:
            if self.matches(d, query):
                d.update(copy.deepcopy(update.get("$set", {})))
                for k, v in update.get("$inc", {}).items():
                    d[k] = d.get(k, 0) + v
                return SimpleNamespace(modified_count=1)
        return SimpleNamespace(modified_count=0)

    def delete_one(self, query):
        self.docs = [d for d in self.docs if not self.matches(d, query)]

    delete_many = delete_one


class InterviewApiTests(unittest.TestCase):
    def test_skipping_does_not_create_evaluation_or_report_weaknesses(self):
        session = self.start()
        with patch("app.routes.interview_flow.evaluate_answer") as evaluate:
            response, _ = self.submit(session, answer="", skipped=True)
            self.assertEqual(response.status_code, 200)
            evaluate.assert_not_called()
        report = self.client.get(
            "/api/interview/" + session["id"] + "/feedback", headers=self.headers
        ).json()
        self.assertEqual(report["weaknesses"], [])
        self.assertIsNone(report["overall_score"])

    def test_communication_alone_does_not_increase_technical_difficulty(self):
        session = self.start()
        while session["current_round"] != "technical":
            session = self.submit(session)[0].json()
        answer = (
            "For example I built a project because it mattered and the result improved. "
            * 5
        )
        session = self.submit(session, answer=answer)[0].json()
        self.assertEqual(session["current_question"]["difficulty"], "medium")
        self.assertNotIn("technical", session["ability"])

    def test_password_change_cannot_overwrite_a_concurrent_revocation(self):
        previous_hash = self.db.users.docs[0]["hashed_password"]

        def revoke(*args):
            self.db.users.docs[0]["token_version"] += 1
            return True

        with patch("app.routes.auth.verify_password", side_effect=revoke):
            response = self.client.post(
                "/api/auth/change-password",
                headers=self.headers,
                json={
                    "old_password": "old-password",
                    "new_password": "New-test-password-321",
                },
            )
        self.assertEqual(response.status_code, 409)
        self.assertEqual(self.db.users.docs[0]["hashed_password"], previous_hash)

    def setUp(self):
        self.db = SimpleNamespace(
            **{
                name: Collection()
                for name in [
                    "users",
                    "resumes",
                    "interview_sessions",
                    "resume_assessments",
                    "integrity_logs",
                ]
            }
        )
        app.dependency_overrides[get_db] = lambda: self.db
        requests.clear()
        self.client = TestClient(app)
        response = self.client.post(
            "/api/auth/signup",
            json={
                "name": "Synthetic Candidate",
                "email": "candidate@example.com",
                "password": "Test-only-pass-824",
            },
        )
        self.assertEqual(response.status_code, 201, response.text)
        self.headers = {"Authorization": "Bearer " + response.json()["access_token"]}

    def tearDown(self):
        self.client.close()
        app.dependency_overrides.clear()

    def start(self, **extra):
        response = self.client.post(
            "/api/interview/start",
            headers=self.headers,
            json={"save_consent": True, **extra},
        )
        self.assertEqual(response.status_code, 201, response.text)
        return response.json()

    def submit(self, session, **extra):
        body = {
            "session_id": session["id"],
            "question_id": session["current_question"]["id"],
            "version": session["version"],
            "request_id": str(ObjectId()),
            "answer": "For example, I built a project because users needed reliable access. The result reduced failures by 20%.",
            **extra,
        }
        return (
            self.client.post("/api/interview/answer", headers=self.headers, json=body),
            body,
        )

    def test_complete_every_round_and_report(self):
        session = self.start()
        seen = []
        while session["status"] == "active":
            question = session["current_question"]
            self.assertNotIn(question["id"], seen)
            seen.append(question["id"])
            result, _ = self.submit(
                session,
                code=(
                    "function solve(nums,target) { return []; }"
                    if question["type"] == "coding"
                    else ""
                ),
            )
            self.assertEqual(result.status_code, 200, result.text)
            session = result.json()
        report = self.client.get(
            f"/api/interview/{session['id']}/feedback", headers=self.headers
        ).json()
        self.assertEqual(report["answered"], report["total"])
        self.assertGreater(len(seen), 10)
        self.assertIn("behavioral", report["round_scores"])
        self.assertIn("final", report["round_scores"])
        self.assertIsNone(report["round_scores"]["technical"]["correctness_score"])
        self.assertEqual(
            self.client.get("/api/interview/sessions", headers=self.headers).json()[0][
                "id"
            ],
            session["id"],
        )

    def test_history_is_a_summary_without_transcripts(self):
        session = self.start()
        self.submit(session)
        history = self.client.get(
            "/api/interview/sessions", headers=self.headers
        ).json()
        self.assertNotIn("answers", history[0])
        self.assertNotIn("current_question", history[0])
        self.assertIsInstance(history[0]["overall_score"], int)
        detail = self.client.get(
            "/api/interview/" + session["id"], headers=self.headers
        ).json()
        self.assertEqual(len(detail["answers"]), 1)

    def test_duplicate_and_stale_submissions(self):
        session = self.start()
        first, body = self.submit(session)
        duplicate = self.client.post(
            "/api/interview/answer", headers=self.headers, json=body
        )
        self.assertEqual(duplicate.json()["version"], first.json()["version"])
        body["request_id"] = str(ObjectId())
        self.assertEqual(
            self.client.post(
                "/api/interview/answer", headers=self.headers, json=body
            ).status_code,
            409,
        )

    def test_ownership_and_authentication(self):
        session = self.start()
        other = self.client.post(
            "/api/auth/signup",
            json={
                "name": "Other",
                "email": "other@example.com",
                "password": "Other-pass-825",
            },
        ).json()
        headers = {"Authorization": "Bearer " + other["access_token"]}
        for suffix in ["", "/feedback"]:
            self.assertEqual(
                self.client.get(
                    "/api/interview/" + session["id"] + suffix, headers=headers
                ).status_code,
                404,
            )
        self.assertEqual(
            self.client.post(
                "/api/interview/" + session["id"] + "/complete", headers=headers
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.delete(
                "/api/interview/" + session["id"], headers=headers
            ).status_code,
            404,
        )
        self.assertEqual(
            self.client.post(
                "/api/interview/start", json={"save_consent": True}
            ).status_code,
            401,
        )
        self.assertEqual(
            self.client.post(
                "/api/code/run",
                json={
                    "session_id": session["id"],
                    "problem_id": "two-sum",
                    "language": "python",
                    "code": "print(1)",
                },
            ).status_code,
            401,
        )

    def test_consent_skip_delete(self):
        self.assertEqual(
            self.client.post(
                "/api/interview/start", headers=self.headers, json={}
            ).status_code,
            400,
        )
        session = self.start(persona="hr")
        self.assertEqual(self.submit(session, answer=" ")[0].status_code, 422)
        self.assertEqual(
            self.submit(session, answer="", skipped=True)[0].status_code, 200
        )
        self.assertEqual(
            self.client.delete(
                "/api/interview/" + session["id"], headers=self.headers
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.get(
                "/api/interview/" + session["id"], headers=self.headers
            ).status_code,
            404,
        )

    def test_password_and_logout_revocation(self):
        response = self.client.post(
            "/api/auth/change-password",
            headers=self.headers,
            json={
                "old_password": "Test-only-pass-824",
                "new_password": "New-test-pass-827",
            },
        )
        self.assertEqual(response.status_code, 200, response.text)
        self.assertEqual(
            self.client.get("/api/auth/me", headers=self.headers).status_code, 401
        )
        new_headers = {"Authorization": "Bearer " + response.json()["access_token"]}
        self.assertEqual(
            self.client.get("/api/auth/me", headers=new_headers).status_code, 200
        )
        self.client.post("/api/auth/logout", headers=new_headers)
        self.assertEqual(
            self.client.get("/api/auth/me", headers=new_headers).status_code, 401
        )

    def test_blank_name_and_wrong_current_password(self):
        self.assertEqual(
            self.client.post(
                "/api/auth/signup",
                json={
                    "name": "  ",
                    "email": "blank@example.com",
                    "password": "Synthetic-pass-123",
                },
            ).status_code,
            422,
        )
        self.assertEqual(
            self.client.put(
                "/api/auth/profile", headers=self.headers, json={"name": "  "}
            ).status_code,
            422,
        )
        self.assertEqual(
            self.client.post(
                "/api/auth/change-password",
                headers=self.headers,
                json={"old_password": "wrong", "new_password": "Synthetic-pass-123"},
            ).status_code,
            400,
        )
        self.assertEqual(
            self.client.get("/api/auth/me", headers=self.headers).status_code, 200
        )

    def test_resume_upload_delete_and_question_context(self):
        document = docx.Document()
        for text in [
            "SYNTHETIC CANDIDATE",
            "SKILLS",
            "Python, React, SQL",
            "PROJECTS",
            "Inventory Dashboard",
            "Built a React dashboard using SQL and Python to display inventory data.",
            "EDUCATION",
            "BSc Computer Science",
        ]:
            document.add_paragraph(text)
        buffer = io.BytesIO()
        document.save(buffer)
        files = {
            "file": (
                "resume.docx",
                buffer.getvalue(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        }
        self.assertEqual(
            self.client.post(
                "/api/resume/upload", headers=self.headers, files=files
            ).status_code,
            400,
        )
        response = self.client.post(
            "/api/resume/upload",
            headers={**self.headers, "X-Data-Consent": "true"},
            files=files,
        )
        self.assertEqual(response.status_code, 201, response.text)
        self.assertEqual(
            self.client.get("/api/auth/me", headers=self.headers).json()[
                "resume_status"
            ],
            "present",
        )
        session = self.start()
        stored = self.db.interview_sessions.find_one({"_id": ObjectId(session["id"])})
        self.assertTrue(any(q.get("source") == "resume" for q in stored["questions"]))
        self.assertEqual(
            self.client.delete("/api/resume/", headers=self.headers).status_code, 200
        )
        self.assertEqual(
            self.client.get("/api/resume/latest", headers=self.headers).status_code, 404
        )

    def test_conflicting_routes_are_retired(self):
        for path in [
            "/api/questions/",
            "/api/answers/capture-code",
            "/api/interview/v2/start",
            "/api/video/analyze-frame",
        ]:
            self.assertIn(
                self.client.post(path, headers=self.headers, json={}).status_code,
                [404, 405],
            )


class PureFlowTests(unittest.TestCase):
    def test_hr_calibration_never_receives_technical_correctness(self):
        from app.interview_flow import evaluate_answer

        question = make_questions("Software Engineering", "hr")[2]
        with patch.dict(os.environ, {"GROQ_API_KEY": "synthetic-test-key"}), patch(
            "groq.Groq"
        ) as groq:
            groq.return_value.chat.completions.create.return_value = SimpleNamespace(
                choices=[
                    SimpleNamespace(
                        message=SimpleNamespace(
                            content='{"correctness_score":99,"feedback":"Synthetic feedback"}'
                        )
                    )
                ]
            )
            result = evaluate_answer(question, "A behavioral example", allow_ai=True)
        self.assertIsNone(result["correctness_score"])

    def test_hr_track_uses_behavioral_calibration(self):
        questions = make_questions("Software Engineering", "hr")
        self.assertIn("background", questions[2]["prompt"])
        self.assertFalse(any(q["round"] in ("technical", "coding") for q in questions))

    def test_all_domains_have_unique_complete_rounds(self):
        for domain in DOMAINS:
            questions = make_questions(domain, "technical")
            self.assertEqual(len(questions), len(set(q["id"] for q in questions)))
            self.assertEqual(len(questions), len(set(q["prompt"] for q in questions)))
            self.assertEqual(questions[-1]["round"], "final")

    def test_code_never_runs_locally(self):
        with patch.dict(os.environ, {"JUDGE0_API_URL": ""}), patch(
            "subprocess.run"
        ) as execute:
            self.assertEqual(
                run_problem("two-sum", 'raise RuntimeError("must not run")', "python")[
                    "status"
                ],
                "unavailable",
            )
            execute.assert_not_called()

    def test_fluency_empty_and_punctuation(self):
        from app.fluency import compute_fluency_score

        self.assertEqual(compute_fluency_score("")["score"], 0)
        self.assertEqual(
            compute_fluency_score("This is complete.")["grammar_errors"], 0
        )

    def test_classifier_preserves_zero_and_seconds(self):
        from app.ml_service import predict

        result = predict(
            {
                "answer_text": "A short answer",
                "fluency_score": 0,
                "response_latency": 2.5,
            }
        )
        self.assertEqual(result["features"]["fluency_score"], 0)
        self.assertEqual(result["features"]["response_latency"], 2.5)
        self.assertNotEqual(result["label"], "resume-gap")


if __name__ == "__main__":
    unittest.main()

"""Owned preparation state, exact retries, and calendar regressions."""
import copy
import unittest
from datetime import date
import test_interview_flow as flow_tests
from app.routes.preparation import build_plan, PlanRequest


class NestedCollection(flow_tests.Collection):
    def update_one(self, query, update, **kwargs):
        for doc in self.docs:
            if self.matches(doc, query):
                for operation, values in update.items():
                    for path, value in values.items():
                        keys = path.split(".")
                        target = doc
                        for key in keys[:-1]:
                            target = target.setdefault(key, {})
                        if operation == "$set":
                            target[keys[-1]] = copy.deepcopy(value)
                        elif operation == "$unset":
                            target.pop(keys[-1], None)
                return
        raise AssertionError("Update must target the authenticated account")


class PreparationTests(unittest.TestCase):
    setUp = flow_tests.InterviewApiTests.setUp
    tearDown = flow_tests.InterviewApiTests.tearDown
    start = flow_tests.InterviewApiTests.start
    submit = flow_tests.InterviewApiTests.submit

    def enable_nested_updates(self):
        users = NestedCollection()
        users.docs = self.db.users.docs
        self.db.users = users

    def test_default_state_and_independent_check_updates(self):
        self.enable_nested_updates()
        self.assertEqual(self.client.get("/api/preparation", headers=self.headers).json(),
                         {"plan": None, "checks": [], "bookmarks": []})
        for key in ["resume:assessment-one:gap-a", "plan:one:task-b"]:
            response = self.client.put("/api/preparation/check", headers=self.headers,
                                       json={"key": key, "completed": True})
            self.assertEqual(response.status_code, 200)
        self.client.put("/api/preparation/check", headers=self.headers,
                        json={"key": "resume:assessment-one:gap-a", "completed": False})
        checks = self.client.get("/api/preparation", headers=self.headers).json()["checks"]
        self.assertEqual(len(checks), 2)
        self.assertFalse(next(c for c in checks if c["key"].startswith("resume"))["completed"])
        self.assertEqual(self.client.get("/api/preparation").status_code, 401)

    def test_bookmarks_persist_resolve_and_follow_session_deletion(self):
        self.enable_nested_updates()
        session = self.start()
        question = session["current_question"]
        body = {"session_id": session["id"], "question_id": question["id"], "saved": True}
        self.assertEqual(self.client.put("/api/preparation/bookmark", json=body, headers=self.headers).status_code, 404)
        self.submit(session)
        for _ in range(2):
            self.assertEqual(self.client.put("/api/preparation/bookmark", json=body, headers=self.headers).status_code, 200)
        saved = self.client.get("/api/preparation", headers=self.headers).json()["bookmarks"]
        self.assertEqual(len(saved), 1)
        self.assertEqual(saved[0]["question_id"], question["id"])
        self.client.delete(f'/api/interview/{session["id"]}', headers=self.headers)
        self.assertEqual(self.client.get("/api/preparation", headers=self.headers).json()["bookmarks"], [])

    def test_bookmark_removal_and_cross_account_isolation(self):
        self.enable_nested_updates()
        session = self.start()
        question = session["current_question"]
        self.submit(session)
        body = {"session_id": session["id"], "question_id": question["id"], "saved": True}
        self.client.put("/api/preparation/bookmark", json=body, headers=self.headers)
        other = self.client.post("/api/auth/signup", json={
            "name": "Other", "email": "other@example.com", "password": "Different-pass-823",
        }).json()
        headers = {"Authorization": "Bearer " + other["access_token"]}
        self.assertEqual(self.client.get("/api/preparation", headers=headers).json()["bookmarks"], [])
        self.assertEqual(self.client.put("/api/preparation/bookmark", json=body, headers=headers).status_code, 404)
        retry = self.client.post("/api/interview/start", headers=headers, json={
            "save_consent": True, "retry_session_id": session["id"], "retry_question_id": question["id"],
        })
        self.assertEqual(retry.status_code, 404)
        self.client.put("/api/preparation/bookmark", json={**body, "saved": False}, headers=self.headers)
        self.assertEqual(self.client.get("/api/preparation", headers=self.headers).json()["bookmarks"], [])

    def test_retry_keeps_exact_question_and_completes_after_one_answer(self):
        session = self.start(domain="Backend", focus_topic="rest-apis")
        question = session["current_question"]
        self.submit(session)
        retry = self.start(domain="Backend", retry_session_id=session["id"],
                           retry_question_id=question["id"])
        self.assertEqual(retry["progress"]["total"], 1)
        self.assertEqual(retry["current_question"]["prompt"], question["prompt"])
        self.assertEqual(self.submit(retry)[0].json()["status"], "completed")

    def test_coding_retry_and_invalid_source(self):
        session = self.start(domain="Frontend", coding_only=True)
        question = session["current_question"]
        self.assertEqual(self.submit(session, answer="", code="function solve(){return [];}")[0].status_code, 200)
        retry = self.start(domain="Frontend", coding_only=True, retry_session_id=session["id"],
                           retry_question_id=question["id"])
        self.assertEqual(retry["current_question"]["problem_id"], question["problem_id"])
        self.assertEqual(retry["progress"]["total"], 1)
        bad = self.client.post("/api/interview/start", headers=self.headers, json={
            "save_consent": True, "retry_session_id": session["id"],
        })
        self.assertEqual(bad.status_code, 400)

    def test_schedule_boundaries_and_ownership(self):
        self.enable_nested_updates()
        body = {"target_role": "Backend developer", "domain": "Backend", "start_date": "2028-02-28",
                "interview_date": "2028-03-06", "sessions_per_week": 3}
        first = self.client.put("/api/preparation/plan", headers=self.headers, json=body).json()
        self.assertEqual([task["date"] for task in first["tasks"]], ["2028-02-28", "2028-03-01", "2028-03-03", "2028-03-06"])
        changed = self.client.put("/api/preparation/plan", headers=self.headers,
                                  json={**body, "interview_date": "2028-03-08"}).json()
        self.assertEqual(first["id"], changed["id"])
        self.assertEqual(self.client.get("/api/preparation", headers=self.headers).json()["plan"], changed)
        for updates in [{"interview_date": "2028-02-27"}, {"sessions_per_week": 0}, {"domain": "invalid"}, {"target_role": " "}]:
            self.assertEqual(self.client.put("/api/preparation/plan", headers=self.headers,
                                             json={**body, **updates}).status_code, 422)
        today = PlanRequest(target_role="Engineer", domain="Backend", start_date=date(2028,2,29),
                            interview_date=date(2028,2,29), sessions_per_week=7)
        self.assertEqual(len(build_plan(today)["tasks"]), 1)


if __name__ == "__main__":
    unittest.main()

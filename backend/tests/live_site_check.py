"""Opt-in live API journey through Vite, using a newly created disposable MongoDB.

Run from backend with the virtual environment active and Vite on port 5173:
    python tests/live_site_check.py [--check-providers]
No real application collection is accessed. Credentials and API payloads are not logged.
"""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor
import io
import json
import os
from pathlib import Path
import secrets
import subprocess
import sys
import tempfile
import time
import uuid
from urllib.parse import urlsplit

import docx
from dotenv import dotenv_values
import httpx
from pymongo import MongoClient
from test_resume_intelligence_parser import make_pdf

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base-url", default="http://127.0.0.1:5173/api")
    parser.add_argument("--api-port", type=int, default=8000, help="Free local port for the disposable API")
    parser.add_argument("--check-providers", action="store_true")
    parser.add_argument(
        "--browser",
        action="store_true",
        help="Also run real Chrome UI checks with synthetic data",
    )
    parser.add_argument(
        "--browser-only",
        action="store_true",
        help="Run Chrome checks without repeating the API journeys",
    )
    parser.add_argument(
        "--headful", action="store_true", help="Show the temporary Chrome test window"
    )
    args = parser.parse_args()
    if not 1024 <= args.api_port <= 65535:
        parser.error("--api-port must be between 1024 and 65535")
    target = urlsplit(args.base_url)
    if (
        target.scheme != "http"
        or target.hostname not in {"127.0.0.1", "localhost"}
        or target.username is not None
        or target.password is not None
        or target.path != "/api"
        or target.query
        or target.fragment
    ):
        raise SystemExit("Only a local test API URL is supported.")
    config = dotenv_values(ROOT / "backend/.env")
    mongo_url = os.getenv("MONGODB_URL") or config.get("MONGODB_URL")
    if not mongo_url:
        raise SystemExit(
            "MONGODB_URL is required; connection values will not be printed."
        )
    # Atlas imposes a 38-byte limit on database names.
    database_name = "site_" + uuid.uuid4().hex
    try:
        mongo = MongoClient(
            mongo_url, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000
        )
    except Exception as exc:
        print(
            f"Database connection setup failed: {type(exc).__name__}; no database was created."
        )
        return 1
    server = None
    checks = []
    results = {
        "database": database_name,
        "checks": checks,
        "providers": {},
        "database_cleaned": False,
    }
    stdout = tempfile.TemporaryFile()
    client = httpx.Client(base_url=args.base_url, timeout=35, follow_redirects=True)

    def check(label, predicate):
        if not predicate:
            raise AssertionError(label)
        checks.append(label)
        print("PASS " + label, flush=True)

    def call(method, path, status=200, **kwargs):
        response = client.request(method, path, **kwargs)
        if response.status_code != status:
            raise AssertionError(
                f'{method} {path.split("?")[0]}: expected {status}, got {response.status_code}'
            )
        return response

    def stop_server():
        if server is not None:
            server.terminate()
            try:
                server.wait(timeout=10)
            except subprocess.TimeoutExpired:
                server.kill()
                server.wait()

    def boot_server(env):
        nonlocal server
        server = subprocess.Popen(
            [
                sys.executable,
                "-m",
                "uvicorn",
                "main:app",
                "--host",
                "127.0.0.1",
                "--port",
                str(args.api_port),
                "--no-access-log",
            ],
            cwd=ROOT / "backend",
            env=env,
            stdout=stdout,
            stderr=stdout,
        )
        deadline = time.monotonic() + 30
        while time.monotonic() < deadline:
            if server.poll() is not None:
                raise RuntimeError(
                    "Isolated API startup failed; server logs suppressed to protect configuration."
                )
            try:
                if client.get("/health").status_code == 200:
                    return
            except httpx.HTTPError:
                pass
            time.sleep(0.2)
        raise RuntimeError("Isolated API did not become ready through the Vite proxy.")

    try:
        mongo.admin.command("ping")
        if database_name in mongo.list_database_names():
            raise RuntimeError(
                "Disposable database name collision; no data was changed."
            )
        # Refuse to reuse an existing API process on this port.
        import socket

        with socket.socket() as probe:
            if probe.connect_ex(("127.0.0.1", args.api_port)) == 0:
                raise RuntimeError(
                    f"Port {args.api_port} is occupied; do not test an unknown API process."
                )
        env = {
            **os.environ,
            "MONGODB_URL": mongo_url,
            "MONGODB_DATABASE": database_name,
            "JWT_SECRET": secrets.token_urlsafe(48),
            "JUDGE0_API_URL": "",
            "GROQ_API_KEY": "",
            "CLIENT_ORIGIN": f"http://localhost:{target.port},http://127.0.0.1:{target.port}",
        }
        if args.check_providers:
            env["GROQ_API_KEY"] = (
                os.getenv("GROQ_API_KEY") or config.get("GROQ_API_KEY") or ""
            )
            env["GROQ_MODEL"] = (
                os.getenv("GROQ_MODEL")
                or config.get("GROQ_MODEL")
                or "llama-3.3-70b-versatile"
            )
        boot_server(env)
        if not args.browser_only:
            check(
                "Vite proxy reaches live API",
                call("GET", "/health").json()["status"] == "ok",
            )
            check(
                "MongoDB indexes created",
                "email_1" in mongo[database_name].users.index_information(),
            )
            check(
                "Private API headers",
                call("GET", "/health").headers.get("cache-control") == "no-store",
            )
            # Vite answers OPTIONS itself; test the API's CORS policy directly.
            preflight = client.options(
                f"http://127.0.0.1:{args.api_port}/api/auth/signup",
                headers={
                    "Origin": f"http://localhost:{target.port}",
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "content-type",
                },
            )
            check(
                "CORS allows configured frontend",
                preflight.status_code == 200
                and preflight.headers.get("access-control-allow-origin")
                == f"http://localhost:{target.port}",
            )
            payload = {
                "name": "Synthetic Site Tester",
                "email": "candidate@example.com",
                "password": "Test-only-password-936",
            }
            token = call("POST", "/auth/signup", 201, json=payload).json()[
                "access_token"
            ]
            headers = {"Authorization": "Bearer " + token}
            call("POST", "/auth/signup", 409, json=payload)
            call(
                "POST",
                "/auth/login",
                401,
                json={**payload, "password": "wrong-password"},
            )
            login = call("POST", "/auth/login", json=payload).json()
            headers = {"Authorization": "Bearer " + login["access_token"]}
            check(
                "Signup, duplicate email, login and invalid credentials",
                call("GET", "/auth/me", headers=headers).json()["name"]
                == payload["name"],
            )
            updated = call(
                "PUT",
                "/auth/profile",
                headers=headers,
                json={"name": "Synthetic Updated", "target_role": "Backend Developer"},
            )
            check(
                "Profile persists", updated.json()["target_role"] == "Backend Developer"
            )
            call("GET", "/auth/me", 401)
            call("GET", "/resume/latest", 404, headers=headers)
            call("POST", "/interview/start", 400, headers=headers, json={})
            call(
                "POST",
                "/interview/start",
                400,
                headers=headers,
                json={"save_consent": True, "domain": "Unknown"},
            )
            check("Auth, missing-resume and consent boundaries", True)

            document = docx.Document()
            paragraphs = [
                "SYNTHETIC TEST CANDIDATE",
                "SKILLS",
                "Python, React, SQL, REST APIs",
                "PROJECTS",
                "Inventory Dashboard",
                "Built a React dashboard using Python and SQL to display inventory data.",
                "EDUCATION",
                "BSc Computer Science",
            ]
            for paragraph in paragraphs:
                document.add_paragraph(paragraph)
            buffer = io.BytesIO()
            document.save(buffer)
            files = {
                "file": (
                    "synthetic.docx",
                    buffer.getvalue(),
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                )
            }
            call("POST", "/resume/upload", 400, headers=headers, files=files)
            consent = {**headers, "X-Data-Consent": "true"}
            upload = call(
                "POST", "/resume/upload", 201, headers=consent, files=files
            ).json()
            check(
                "DOCX consent, extraction and persistence",
                bool(upload["analysis"]["skills"])
                and call("GET", "/auth/me", headers=headers).json()["resume_status"]
                == "present",
            )
            call(
                "POST",
                "/resume/upload",
                422,
                headers=consent,
                files={
                    "file": ("corrupt.pdf", b"%PDF-1.4 corrupted", "application/pdf")
                },
            )
            check(
                "Corrupt document rejected",
                call("GET", "/resume/latest", headers=headers).json()["id"]
                == upload["id"],
            )
            upload = call(
                "POST",
                "/resume/upload",
                201,
                headers=consent,
                files={
                    "file": ("synthetic.pdf", make_pdf(paragraphs), "application/pdf")
                },
            ).json()
            check(
                "PDF extraction and latest-resume replacement",
                call("GET", "/resume/analysis/latest", headers=headers).json()[
                    "resume_id"
                ]
                == upload["id"]
                and "Python"
                in call("GET", "/resume/summary", headers=headers).json()[
                    "parsed_data"
                ]["skills"],
            )
            call(
                "POST",
                "/resume/upload",
                422,
                headers=consent,
                files={"file": ("scan.pdf", make_pdf([]), "application/pdf")},
            )
            check(
                "PDF without extractable text rejected without replacing resume",
                call("GET", "/resume/latest", headers=headers).json()["id"]
                == upload["id"],
            )
            for role in [
                "software-engineer-sde",
                "frontend-developer",
                "backend-developer",
                "data-analyst",
                "machine-learning-engineer",
            ]:
                assessment = call(
                    "POST",
                    "/resume/analysis/match",
                    201,
                    headers=headers,
                    json={"target_role_id": role},
                ).json()
                check(
                    "Provisional role findings: " + role,
                    assessment["score"] is None and assessment["assessment_id"],
                )
            jd = "Required: Python, SQL, React and REST API development. Build dashboards and backend services with clear tests and documentation."
            assessment = call(
                "POST",
                "/resume/analysis/job-description",
                201,
                headers=headers,
                json={"job_description": jd},
            ).json()
            repeated = call(
                "POST",
                "/resume/analysis/job-description",
                201,
                headers=headers,
                json={"job_description": jd},
            ).json()
            check(
                "JD matching and idempotent assessment persistence",
                assessment["assessment_id"] == repeated["assessment_id"]
                and assessment["score"] is not None,
            )
            check(
                "Latest assessment sorting on real MongoDB",
                call("GET", "/resume/analysis/match/latest", headers=headers).json()[
                    "assessment_id"
                ]
                == assessment["assessment_id"],
            )
            call(
                "GET",
                "/resume/analysis/match/" + assessment["assessment_id"],
                headers=headers,
            )

            other = call(
                "POST",
                "/auth/signup",
                201,
                json={
                    "name": "Synthetic Other",
                    "email": "other@example.com",
                    "password": "Other-test-password-836",
                },
            ).json()
            other_headers = {"Authorization": "Bearer " + other["access_token"]}
            call(
                "GET",
                "/resume/analysis/match/" + assessment["assessment_id"],
                404,
                headers=other_headers,
            )
            call("GET", "/resume/latest", 404, headers=other_headers)
            check("Resume and assessment ownership", True)

            def start(persona="technical", mode="practice", allow_ai=False):
                return call(
                    "POST",
                    "/interview/start",
                    201,
                    headers=headers,
                    json={
                        "save_consent": True,
                        "persona": persona,
                        "mode": mode,
                        "allow_ai": allow_ai,
                    },
                ).json()

            def answer_body(session):
                return {
                    "session_id": session["id"],
                    "question_id": session["current_question"]["id"],
                    "request_id": uuid.uuid4().hex,
                    "version": session["version"],
                    "answer": "For example I built an inventory dashboard because the team needed stock visibility. The result reduced repeated manual checks.",
                    "code": "function solve(nums, target) { return [0,1]; }",
                    "language": "javascript",
                    "latency_ms": 15000,
                }

            for persona, expected_count in [("hr", 9), ("technical", 13)]:
                session = start(
                    persona, "assessment" if persona == "hr" else "practice"
                )
                check(
                    persona + " session stored",
                    mongo[database_name].interview_sessions.count_documents(
                        {
                            "user_id": call("GET", "/auth/me", headers=headers).json()[
                                "id"
                            ]
                        }
                    )
                    > 0,
                )
                call("GET", "/interview/" + session["id"], 404, headers=other_headers)
                seen = []
                while session["status"] == "active":
                    if len(seen) >= expected_count:
                        raise AssertionError(
                            persona + " interview exceeded its question count"
                        )
                    q = session["current_question"]
                    seen.append(q["round"])
                    if q["type"] == "coding":
                        execution = call(
                            "POST",
                            "/code/run",
                            headers=headers,
                            json={
                                "session_id": session["id"],
                                "problem_id": q["problem_id"],
                                "language": "javascript",
                                "code": "function solve(){return []; }",
                            },
                        ).json()
                        check(
                            "Unconfigured coding provider stays unavailable",
                            execution["status"] == "unavailable",
                        )
                    body = answer_body(session)
                    next_session = call(
                        "POST", "/interview/answer", headers=headers, json=body
                    ).json()
                    if session["version"] == 0:
                        duplicate = call(
                            "POST", "/interview/answer", headers=headers, json=body
                        ).json()
                        check(
                            persona + " answer retry does not advance twice",
                            duplicate["version"] == next_session["version"],
                        )
                        call(
                            "POST",
                            "/interview/answer",
                            409,
                            headers=headers,
                            json={**body, "request_id": uuid.uuid4().hex},
                        )
                    session = next_session
                report = call(
                    "GET", "/interview/" + session["id"] + "/feedback", headers=headers
                ).json()
                check(
                    persona + " full round journey and report",
                    len(seen) == expected_count
                    and report["answered"] == expected_count
                    and "behavioral" in seen
                    and seen[-1] == "final",
                )
                check(
                    persona + " resume context used",
                    any("Your resume" in row["question"] for row in report["qa_pairs"]),
                )
                check(
                    persona + " completion persisted across reload",
                    call("GET", "/interview/" + session["id"], headers=headers).json()[
                        "status"
                    ]
                    == "completed",
                )
            history = call("GET", "/interview/sessions", headers=headers).json()
            check(
                "History is owned and excludes transcripts",
                len(history) == 2 and all("answers" not in item for item in history),
            )

            completed_id = session["id"]
            stop_server()
            boot_server(env)
            check(
                "Account, resume, assessment and report survive API restart",
                call("GET", "/auth/me", headers=headers).json()["name"]
                == "Synthetic Updated"
                and call("GET", "/resume/latest", headers=headers).json()["id"]
                == upload["id"]
                and call(
                    "GET", "/resume/analysis/match/latest", headers=headers
                ).json()["assessment_id"]
                == assessment["assessment_id"]
                and call(
                    "GET", "/interview/" + completed_id + "/feedback", headers=headers
                ).json()["answered"]
                == 13,
            )

            session = start()
            body = answer_body(session)

            def competing_answer():
                return client.post(
                    "/interview/answer",
                    headers=headers,
                    json={**body, "request_id": uuid.uuid4().hex},
                ).status_code

            with ThreadPoolExecutor(max_workers=2) as pool:
                statuses = list(pool.map(lambda _: competing_answer(), range(2)))
            check(
                "Concurrent MongoDB answer updates advance exactly once",
                sorted(statuses) == [200, 409]
                and call("GET", "/interview/" + session["id"], headers=headers).json()[
                    "version"
                ]
                == 1,
            )
            call("POST", "/interview/" + session["id"] + "/complete", headers=headers)
            call("DELETE", "/interview/" + session["id"], 404, headers=other_headers)
            call("DELETE", "/interview/" + session["id"], headers=headers)
            call("GET", "/interview/" + session["id"], 404, headers=headers)
            check("Early completion and owned session deletion", True)

            if args.check_providers:
                session = start(allow_ai=True)
                while session["current_round"] == "screening":
                    session = call(
                        "POST",
                        "/interview/answer",
                        headers=headers,
                        json=answer_body(session),
                    ).json()
                result = call(
                    "POST",
                    "/interview/answer",
                    headers=headers,
                    json=answer_body(session),
                ).json()["answers"][-1]["evaluation"]
                results["providers"]["groq"] = (
                    "passed" if result["source"] == "llm-assessment" else "unavailable"
                )
                speech = client.post(
                    "/tts/synthesize",
                    headers=headers,
                    json={"text": "This is a synthetic InterviewSpar speech test."},
                )
                results["providers"]["tts"] = (
                    "passed"
                    if speech.status_code == 200
                    and speech.headers.get("content-type", "").startswith("audio/mpeg")
                    and len(speech.content) > 100
                    else "unavailable"
                )
                print(
                    "Provider results: " + json.dumps(results["providers"]), flush=True
                )
            results["providers"][
                "judge0"
            ] = "not configured; unavailable-state test passed"
            check(
                "Voice catalog endpoint",
                bool(call("GET", "/tts/voices", headers=headers).json()["voices"]),
            )
            call("POST", "/tts/synthesize", 401, json={"text": "Synthetic test"})
            call("DELETE", "/resume/", headers=headers)
            call("GET", "/resume/latest", 404, headers=headers)
            call("GET", "/resume/analysis/match/latest", 404, headers=headers)
            check(
                "Resume deletion clears assessments and profile pointer",
                call("GET", "/auth/me", headers=headers).json()["resume_status"]
                == "none",
            )
            changed = call(
                "POST",
                "/auth/change-password",
                headers=headers,
                json={
                    "old_password": payload["password"],
                    "new_password": "Changed-test-password-739",
                },
            ).json()
            call("GET", "/auth/me", 401, headers=headers)
            headers = {"Authorization": "Bearer " + changed["access_token"]}
            call("GET", "/auth/me", headers=headers)
            call("POST", "/auth/logout", headers=headers)
            call("GET", "/auth/me", 401, headers=headers)
            check("Password change and logout revoke persisted tokens", True)
        if args.browser or args.browser_only:
            with tempfile.TemporaryDirectory(
                prefix="interspars-browser-fixtures-"
            ) as fixtures:
                pdf_path = Path(fixtures) / "synthetic.pdf"
                pdf_path.write_bytes(
                    make_pdf(
                        [
                            "SYNTHETIC BROWSER TESTER",
                            "SKILLS",
                            "Python, React, SQL, REST APIs",
                            "PROJECTS",
                            "Inventory Dashboard",
                            "Built a React dashboard using Python and SQL to display inventory data.",
                            "EDUCATION",
                            "BSc Computer Science",
                        ]
                    )
                )
                browser = subprocess.run(
                    [
                        "node",
                        "tests/browser_site_check.mjs",
                        args.base_url.removesuffix("/api"),
                        str(pdf_path),
                    ],
                    cwd=ROOT / "frontend",
                    env={**os.environ, "CHROME_HEADLESS": "0" if args.headful else "1"},
                    timeout=900,
                )
                check("Chrome browser acceptance suite", browser.returncode == 0)
        results["status"] = "passed"
    except Exception as exc:
        results["status"] = "failed"
        results["failure"] = (
            str(exc)
            if isinstance(exc, (AssertionError, RuntimeError))
            else type(exc).__name__
        )
        print("FAIL " + results["failure"], flush=True)
    finally:
        client.close()
        if server is not None:
            stop_server()
            # This database name is unique, generated here and never user-supplied.
            try:
                mongo.drop_database(database_name)
                results["database_cleaned"] = (
                    database_name not in mongo.list_database_names()
                )
            except Exception as exc:
                # Print only the generated name above and the error type so a
                # cleanup failure can be recovered without leaking connection data.
                results["cleanup_error"] = type(exc).__name__
        stdout.close()
        mongo.close()
        print(json.dumps(results, indent=2), flush=True)
    return 0 if results.get("status") == "passed" and results["database_cleaned"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

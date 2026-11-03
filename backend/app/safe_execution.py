"""Run submissions only in a configured isolated Judge0 service, never on this host."""

from __future__ import annotations
import base64
import json
import os
import re
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen

LANGUAGES = {"javascript": 63, "python": 71}


def same_json_value(actual, expected):
    """Compare JSON values without treating booleans as numbers."""
    if isinstance(actual, bool) or isinstance(expected, bool):
        return type(actual) is type(expected) and actual == expected
    if isinstance(expected, list):
        return (
            isinstance(actual, list)
            and len(actual) == len(expected)
            and all(same_json_value(a, e) for a, e in zip(actual, expected))
        )
    if isinstance(expected, dict):
        return (
            isinstance(actual, dict)
            and actual.keys() == expected.keys()
            and all(
                same_json_value(actual[key], value) for key, value in expected.items()
            )
        )
    return actual == expected


def execute_cases(code, language, cases, function_name="solve"):
    endpoint = os.getenv("JUDGE0_API_URL", "").rstrip("/")
    unavailable = {
        "status": "unavailable",
        "passed": 0,
        "total": len(cases),
        "results": [],
        "message": "Code execution is not configured. Your code can still be saved for review.",
    }
    if not endpoint or not endpoint.startswith(("https://", "http://")):
        return unavailable
    if language not in LANGUAGES or not re.fullmatch(
        r"[A-Za-z_][A-Za-z0-9_]*", function_name
    ):
        return {
            **unavailable,
            "status": "invalid",
            "message": "Unsupported language or function signature.",
        }
    if not cases or len(cases) > 10 or len(code) > 50000:
        return {
            **unavailable,
            "status": "invalid",
            "message": "Invalid code or test cases.",
        }
    results = []
    for case in cases:
        args = case["args"]
        if language == "javascript":
            source = (
                code
                + "\nPromise.resolve("
                + function_name
                + "(..."
                + json.dumps(args)
                + ")).then(x=>console.log(JSON.stringify(x))).catch(()=>process.exit(1));"
            )
        else:
            source = (
                code
                + "\nimport json\nprint(json.dumps("
                + function_name
                + "(*json.loads("
                + repr(json.dumps(args))
                + "))))\n"
            )
        body = {
            "source_code": base64.b64encode(source.encode()).decode(),
            "language_id": LANGUAGES[language],
            "cpu_time_limit": 2,
            "wall_time_limit": 5,
            "memory_limit": 128000,
            "max_processes_and_or_threads": 16,
            "enable_network": False,
            "max_file_size": 128,
        }
        headers = {"Content-Type": "application/json"}
        if os.getenv("JUDGE0_API_KEY"):
            headers["X-Auth-Token"] = os.environ["JUDGE0_API_KEY"]
        request = Request(
            endpoint + "/submissions?base64_encoded=true&wait=true",
            data=json.dumps(body).encode(),
            headers=headers,
        )
        try:
            with urlopen(request, timeout=8) as response:
                raw = response.read(131073)
            if len(raw) > 131072:
                raise ValueError("Provider response too large")
            data = json.loads(raw)
            status = data["status"]["id"]
            if status not in range(3, 13):
                raise ValueError("Provider did not finish evaluation")
            output = (
                base64.b64decode(data.get("stdout") or "", validate=True)
                .decode("utf8", errors="replace")
                .strip()
            )
        except (
            URLError,
            HTTPError,
            TimeoutError,
            ValueError,
            KeyError,
            OSError,
            TypeError,
        ):
            return {
                **unavailable,
                "message": "The isolated execution service is unavailable. No correctness score was assigned.",
            }
        actual = None
        valid_output = False
        if status == 3 and output:
            try:
                actual = json.loads(output.splitlines()[-1])
                valid_output = True
            except ValueError:
                pass
        matches = same_json_value(actual, case["expected"])
        if case.get("unordered_pair") and isinstance(actual, list) and len(actual) == 2:
            matches = matches or same_json_value(actual[::-1], case["expected"])
        success = status == 3 and valid_output and matches
        results.append(
            {
                "passed": success,
                "actual": actual,
                "status": data["status"].get("description", "Unknown"),
            }
        )
    return {
        "status": "evaluated",
        "passed": sum(r["passed"] for r in results),
        "total": len(results),
        "results": results,
    }


def run_problem(problem_id, code, language):
    from app.interview_flow import PROBLEMS

    problem = PROBLEMS.get(problem_id)
    if not problem:
        return {
            "status": "invalid",
            "passed": 0,
            "total": 0,
            "results": [],
            "message": "Unknown problem.",
        }
    cases = []
    for case in problem["testCases"]:
        value = json.loads(case["input"])
        cases.append(
            {
                "args": value if isinstance(value, list) else [value],
                "expected": json.loads(case["expected"]),
                "unordered_pair": problem_id == "two-sum",
            }
        )
    return execute_cases(code, language, cases)


if __name__ == "__main__":
    import sys

    payload = json.loads(sys.stdin.read())
    print(
        json.dumps(
            execute_cases(payload["code"], payload["language"], payload["cases"])
        )
    )

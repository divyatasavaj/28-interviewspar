"""Run curated answer checks and trusted code fixtures; never run user code locally.

From backend: python tests/feedback_benchmark.py [--judge0] [--ai]
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys

from dotenv import load_dotenv

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
load_dotenv(BACKEND / ".env")

from app.coding_practice import EXERCISES, grade_code
from app.interview_flow import evaluate_answer, report_answer
from app.safe_execution import same_json_value

PROMPT = "How would you prevent a retry from accidentally creating a duplicate order?"
SPOKEN = [
    ("Sound reasoning", "Require an idempotency key per logical order. Store the key and the order ID atomically with the order and enforce uniqueness on the key. On retry, return the existing order after checking the payload matches. Concurrent retries must share that uniqueness constraint.", "correct"),
    ("Incorrect reasoning", "I would ask clients to retry with a fresh random idempotency key every time. That way the key cannot collide, so each request can create the order independently without checking the database.", "incorrect"),
    ("Too little evidence", "Use a cache.", "insufficient"),
    ("Keyword gaming", "For example, I built a project because there was a trade-off. I measured the result and improved it. The project used a project workflow because a project should get the best result. There were many things I learned and measured.", "irrelevant"),
]

# Python executed locally is limited to these source-controlled fixtures.
CODE = [
    ("frontend-classes", "def solve(names): return list(dict.fromkeys(x.strip() for x in names if x.strip()))", True),
    ("frontend-classes", "def solve(names): return sorted(set(names))", False),
    ("backend-rate", """def solve(times, width):
    left = best = 0
    for right, time in enumerate(times):
        while time - times[left] >= width:
            left += 1
        best = max(best, right - left + 1)
    return best""", True),
    ("backend-rate", """def solve(times, width):
    return max((sum(t <= x <= t + width for x in times) for t in times), default=0)""", False),
    ("data-window", "def solve(values, width): return [sum(values[i:i+width]) for i in range(len(values)-width+1)]", True),
    ("data-window", "def solve(values, width): return [sum(values[:width])]", False),
    ("common-count", """def solve(values):
    from collections import Counter
    counts = Counter(values)
    return next((item for item in values if counts[item] == 1), None)""", True),
    ("common-count", "def solve(values): return values[0] if values else None", False),
]


def local_grade(source, cases):
    harness = source + "\nimport json, sys\nprint(json.dumps([solve(*case) for case in json.load(sys.stdin)]))"
    process = subprocess.run([sys.executable, "-I", "-c", harness],
                             input=json.dumps([case["args"] for case in cases]),
                             capture_output=True, text=True, timeout=5, check=True)
    values = json.loads(process.stdout)
    assert len(values) == len(cases)
    return sum(same_json_value(value, case["expected"]) for value, case in zip(values, cases))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--judge0", action="store_true")
    parser.add_argument("--ai", action="store_true")
    args = parser.parse_args()
    question = {"prompt": PROMPT, "round": "technical", "type": "spoken", "evaluation_kind": "technical"}
    ai_gaps = 0
    for label, answer, reviewed in SPOKEN:
        evaluation = evaluate_answer(question, answer, allow_ai=args.ai)
        row = report_answer({"evaluation": evaluation}, question, 1)
        correctness = evaluation["correctness_score"]
        if reviewed == "insufficient":
            assert row["evaluation"]["communication_score"] is None and correctness is None
        if args.ai and reviewed != "insufficient":
            ai_gaps += correctness is None or (correctness >= 70) != (reviewed == "correct")
        elif not args.ai:
            assert correctness is None
        print(f"{label}: reviewed={reviewed}, structure={evaluation['communication_score']}, correctness={correctness}")
    for exercise_id, source, valid in CODE:
        exercise = EXERCISES[exercise_id]
        cases = exercise["samples"] + exercise["hidden"]
        passed = local_grade(source, cases)
        assert (passed == len(cases)) == valid, (exercise_id, passed)
        if args.judge0:
            result = grade_code(exercise_id, source, "python")
            assert result["status"] == "evaluated" and result["passed"] == passed, (exercise_id, result["status"])
        print(f"{exercise['title']}: {passed}/{len(cases)} pass, expected {'all' if valid else 'some failures'}")
    if args.ai:
        print(f"AI disagreements or missing scores: {ai_gaps}/3 (small fixture set)")
        if ai_gaps:
            raise SystemExit(1)


if __name__ == "__main__":
    main()

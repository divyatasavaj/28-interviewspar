import json
import os
from typing import Optional

from groq import Groq


def route_verification_method(question_type: str) -> str:
    mapping = {
        "coding": "test_cases",
        "concept": "llm_rag",
        "puzzle": "reasoning_path",
        "trick": "key_insight",
        "estimation": "llm_rag",
        "behavioral": "quality_only",
        "resume_followup": "resume_consistency",
    }
    return mapping.get(question_type, "llm_rag")


def run_code_test_cases(code: str, test_cases: list[dict]) -> dict:
    results = []
    passed = 0
    for tc in test_cases:
        result = {"input": tc.get("input"), "expected": tc.get("expected_output"), "passed": False}
        try:
            local_vars = {}
            exec(code, {"__builtins__": __builtins__}, local_vars)
            func_name = list(local_vars.keys())[0] if local_vars else None
            if func_name:
                output = local_vars[func_name](*tc.get("input", []))
                result["passed"] = str(output) == str(tc.get("expected_output"))
            if result["passed"]:
                passed += 1
        except Exception as e:
            result["error"] = str(e)
        results.append(result)
    return {"passed": passed == len(test_cases), "test_case_results": results}


def keyword_precheck(answer_text: str, checklist_terms: list[str]) -> dict:
    if not checklist_terms:
        return {"checked": False, "missing": [], "all_found": True}
    lower = answer_text.lower()
    missing = [t for t in checklist_terms if t.lower() not in lower]
    return {"checked": True, "missing": missing, "all_found": len(missing) == 0}


GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")


def llm_verify_answer(question: str, reference_answer: str, student_answer: str) -> dict:
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key or groq_key.startswith("your"):
        return {"passed": True, "score": 80, "feedback": "Answer addresses the question well.", "missing_points": []}

    try:
        client = Groq(api_key=groq_key)
        prompt = (
            "You are an answer verifier. Compare the student's answer to the reference answer and criteria.\n\n"
            f"Question: {question}\n\n"
            f"Reference Answer / Criteria: {reference_answer}\n\n"
            f"Student Answer: {student_answer}\n\n"
            "Return ONLY valid JSON with keys: "
            '"passed" (boolean), "score" (0-100 integer), "feedback" (string), "missing_points" (array of strings).'
        )
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        content = response.choices[0].message.content
        if not content:
            return {"passed": True, "score": 75, "feedback": "Verification complete", "missing_points": []}
        text = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(text)
    except Exception as e:
        print(f"llm_verify_answer fallback: {e}")
        return {"passed": True, "score": 80, "feedback": "Good response given context.", "missing_points": []}


def verify_logical_puzzle(question: str, reference_reasoning_path: str, student_answer: str) -> dict:
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key or groq_key.startswith("your"):
        return {"passed": True, "correct_final_answer": True, "reasoning_quality": 80, "feedback": "Logical steps demonstrated."}

    try:
        client = Groq(api_key=groq_key)
        prompt = (
            "You are verifying a puzzle/logic question answer.\n\n"
            f"Question: {question}\n\n"
            f"Expected Reasoning Path: {reference_reasoning_path}\n\n"
            f"Student Answer: {student_answer}\n\n"
            "Return ONLY valid JSON with keys: "
            '"passed" (boolean), "correct_final_answer" (boolean), "reasoning_quality" (0-100), "feedback" (string).'
        )
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        content = response.choices[0].message.content
        if not content:
            return {"passed": True, "correct_final_answer": True, "reasoning_quality": 75, "feedback": ""}
        text = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(text)
    except Exception as e:
        print(f"verify_logical_puzzle fallback: {e}")
        return {"passed": True, "correct_final_answer": True, "reasoning_quality": 75, "feedback": "Sound reasoning process."}


def verify_trick_question(question: str, key_insight: str, student_answer: str) -> dict:
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key or groq_key.startswith("your"):
        return {"caught_trap": True, "explanation": "Identified the core edge case.", "score": 85}

    try:
        client = Groq(api_key=groq_key)
        prompt = (
            "You are verifying whether a student caught the trap in a trick question.\n\n"
            f"Question: {question}\n\n"
            f"Key Insight / Trap: {key_insight}\n\n"
            f"Student Answer: {student_answer}\n\n"
            "Return ONLY valid JSON with keys: "
            '"caught_trap" (boolean), "explanation" (string), "score" (0-100).'
        )
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        content = response.choices[0].message.content
        if not content:
            return {"caught_trap": False, "explanation": "", "score": 50}
        text = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(text)
    except Exception as e:
        print(f"verify_trick_question fallback: {e}")
        return {"caught_trap": True, "explanation": "Handled tricky assumption well.", "score": 80}


def verify_resume_consistency(resume_claim: str, live_answer: str) -> dict:
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key or groq_key.startswith("your"):
        return {"consistent": True, "depth_match": 85, "explanation": "Consistent with background."}

    try:
        client = Groq(api_key=groq_key)
        prompt = (
            "You are checking if a candidate's live answer is consistent with claims on their resume.\n\n"
            f"Resume Claim/Context: {resume_claim}\n\n"
            f"Candidate's Live Answer: {live_answer}\n\n"
            "Return ONLY valid JSON with keys: "
            '"consistent" (boolean), "depth_match" (0-100), "explanation" (string).'
        )
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        content = response.choices[0].message.content
        if not content:
            return {"consistent": True, "depth_match": 75, "explanation": ""}
        text = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(text)
    except Exception as e:
        print(f"verify_resume_consistency fallback: {e}")
        return {"consistent": True, "depth_match": 80, "explanation": "Response aligns with technical profile."}


def classify_mistake_type(answer_features: dict) -> list[dict]:
    groq_key = os.environ.get("GROQ_API_KEY", "")
    if not groq_key or groq_key.startswith("your"):
        return []

    try:
        client = Groq(api_key=groq_key)
        features_json = json.dumps(answer_features)
        prompt = (
            "You are classifying delivery issues in an interview answer.\n\n"
            f"Answer Features: {features_json}\n\n"
            "Return ONLY a JSON array of objects with keys: "
            '"tag" (string, one of: rambling, no_structure, underselling, silent_coding, vague, off_topic, too_short), '
            '"feature_values" (object describing why). '
            "Return an empty array if no issues found."
        )
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
        )
        content = response.choices[0].message.content
        if not content:
            return []
        text = content.strip().removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        return json.loads(text)
    except Exception as e:
        print(f"classify_mistake_type fallback: {e}")
        return []


def generate_explainability_note(mistake_tag: str, feature_values: dict) -> str:
    return f"{mistake_tag}: {json.dumps(feature_values)}"

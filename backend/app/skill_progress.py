"""Compare repeated prompts at the same level and with the same evidence source."""
from collections import defaultdict

from app.practice_topics import TOPICS


def summarize_skills(sessions):
    groups = defaultdict(list)
    for session in sessions:
        questions = {item["id"]: item for item in session["questions"]}
        for answer in session.get("answers", []):
            if answer.get("skipped"):
                continue
            question = questions.get(answer["question_id"], {})
            evaluation = answer.get("evaluation", {})
            topic = answer.get("skill_topic") or question.get("skill_topic")
            if question.get("evaluation_kind") == "behavioral" and question.get("round") in {"hr", "behavioral"}:
                topic = "behavioral"
            if topic not in TOPICS and topic != "behavioral":
                continue
            if question.get("type") == "coding":
                if evaluation.get("source") != "isolated-code-tests":
                    continue
                method, score = "Test pass rate", evaluation.get("correctness_score")
            else:
                method, score = "Answer structure", evaluation.get("communication_score")
                if evaluation.get("evidence", {}).get("word_count", 0) < 8:
                    continue
            if score is None:
                continue
            key = (topic, method, session["domain"], session.get("experience_level", "mid"),
                   question.get("difficulty"), question.get("problem_id") or answer["question"],
                   answer.get("language") if method == "Test pass rate" else None)
            groups[key].append(score)
    results = {}
    for (topic, method, domain, level, _difficulty, _prompt, _language), scores in groups.items():
        label = "Behavioral interviews" if topic == "behavioral" else TOPICS[topic][0]
        record = {"topic": topic, "label": label, "method": method, "domain": domain, "level": level,
                  "latest": scores[0], "previous": scores[1] if len(scores) > 1 else None,
                  "comparable_attempts": len(scores)}
        key = topic, method
        if key not in results or (len(scores) > 1 and results[key]["previous"] is None):
            results[key] = record
    return list(results.values())

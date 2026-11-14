"""Job-description suggestions backed by the existing skill and question catalogs."""
from functools import lru_cache

from app.practice_topics import SKILL_TOPICS, TOPICS
from app.resume_intelligence.catalog import load_catalog
from app.resume_intelligence.job_description import extract_job_description_requirements


@lru_cache(maxsize=1)
def preparation_catalog():
    return load_catalog()


def preparation_topics():
    return {key: {"id": key, "label": label, "domain": domain, "questions": list(prompts)}
            for key, (label, domain, _, prompts) in TOPICS.items()}


def suggest_topics(description):
    extraction = extract_job_description_requirements(description, preparation_catalog())
    matched = {}
    uncovered = []
    for requirement in extraction.requirements:
        topic = SKILL_TOPICS.get(requirement.skill_id)
        if not topic:
            uncovered.append(requirement.canonical_name)
            continue
        entry = matched.setdefault(topic, {"id": topic, "skills": [],
                                          "priority": requirement.requirement_type.value})
        entry["skills"].append(requirement.canonical_name)
    uncovered.extend(item.source_term for item in extraction.unknown_requirements)
    return list(matched.values()), list(dict.fromkeys(uncovered))[:20]

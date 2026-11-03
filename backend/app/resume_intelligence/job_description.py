"""Deterministic extraction of skill requirements from untrusted job text."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

from .assessment_errors import AssessmentError
from .assessment_schemas import (
    MAX_JOB_DESCRIPTION_CHARS,
    RequirementType,
)
from .catalog import ResumeIntelligenceCatalog
from .normalization import SkillNormalizer


MIN_JOB_DESCRIPTION_CHARS = 40
_TYPE_PRIORITY = {
    RequirementType.UNSPECIFIED: 0,
    RequirementType.PREFERRED: 1,
    RequirementType.REQUIRED: 2,
}
_PREFERRED_RE = re.compile(
    r"\b(?:preferred|nice[\s-]+to[\s-]+have|good[\s-]+to[\s-]+have|bonus|desirable|a\s+plus)\b",
    re.IGNORECASE,
)
_REQUIRED_RE = re.compile(
    r"\b(?:required|requirements?|must[\s-]+have|mandatory|minimum\s+qualifications?)\b",
    re.IGNORECASE,
)
_PREFERRED_HEADING_RE = re.compile(
    r"^\s*(?:preferred|nice[\s-]+to[\s-]+have|good[\s-]+to[\s-]+have)\b",
    re.IGNORECASE,
)
_REQUIRED_HEADING_RE = re.compile(
    r"^\s*(?:required|minimum\s+qualifications?|requirements?|must[\s-]+have)\b",
    re.IGNORECASE,
)
_NEUTRAL_HEADING_RE = re.compile(
    r"^\s*(?:responsibilities|what\s+you(?:'|’)ll\s+do|about\s+(?:us|the\s+role)|"
    r"benefits|perks|who\s+we\s+are|company\s+overview)\b",
    re.IGNORECASE,
)
_INSTRUCTION_LIKE_RE = re.compile(
    r"\b(?:ignore\s+(?:all\s+)?(?:previous|prior)\s+instructions|system\s+prompt|"
    r"developer\s+message|return\s+(?:a\s+)?score\s+of|set\s+the\s+score|"
    r"you\s+are\s+now\s+an?\b)",
    re.IGNORECASE,
)
_CHUNK_DELIMITER_RE = re.compile(r"[,;|]|\band\b", re.IGNORECASE)
_CUE_PREFIX_RE = re.compile(
    r"^(?:(?:hands[\s-]+on\s+)?(?:experience|proficiency|knowledge|familiarity|"
    r"understanding|exposure|ability)\s+(?:with|in|of)|"
    r"(?:must|should)\s+have|(?:required|preferred)(?:\s+skills?)?|"
    r"strong|good|working\s+knowledge\s+of|skills?)\s*[:\-]?\s+",
    re.IGNORECASE,
)
_TRAILING_QUALIFIER_RE = re.compile(
    r"\s+(?:is\s+)?(?:required|preferred|a\s+plus|is\s+desirable|"
    r"nice[\s-]+to[\s-]+have|good[\s-]+to[\s-]+have)\s*[.!]?$",
    re.IGNORECASE,
)
_TRAILING_PREPOSITION_RE = re.compile(
    r"\s+(?:for|in|at|to|with|on|using|across|within)\s+.*$",
    re.IGNORECASE,
)
_NON_SKILL_TOKENS = frozenset(
    {
        "applicant",
        "applicants",
        "bachelor",
        "bachelors",
        "benefits",
        "candidate",
        "candidates",
        "company",
        "could",
        "degree",
        "description",
        "engineering",
        "english",
        "experience",
        "example",
        "fixture",
        "fresher",
        "freshers",
        "hiring",
        "internship",
        "job",
        "looking",
        "location",
        "master",
        "masters",
        "office",
        "our",
        "phd",
        "preferred",
        "qualification",
        "qualifications",
        "required",
        "requirement",
        "requirements",
        "role",
        "salary",
        "sample",
        "skill",
        "skills",
        "synthetic",
        "team",
        "teams",
        "test",
        "that",
        "their",
        "they",
        "this",
        "value",
        "values",
        "we",
        "year",
        "years",
        "you",
        "your",
    }
)
_TECH_HINTS = frozenset(
    {
        "api",
        "cloud",
        "database",
        "db",
        "framework",
        "js",
        "language",
        "library",
        "ops",
        "platform",
        "sql",
        "tool",
    }
)


@dataclass(frozen=True)
class ExtractedJobRequirement:
    skill_id: str
    canonical_name: str
    matched_alias: str
    requirement_type: RequirementType
    start: int
    end: int
    confidence: float


@dataclass(frozen=True)
class ExtractedUnknownRequirement:
    source_term: str
    requirement_type: RequirementType
    start: int
    end: int


@dataclass(frozen=True)
class JobDescriptionExtraction:
    text_sha256: str
    character_count: int
    requirements: tuple[ExtractedJobRequirement, ...]
    unknown_requirements: tuple[ExtractedUnknownRequirement, ...]
    instruction_like_text_detected: bool


def extract_job_description_requirements(
    text: str,
    catalog: ResumeIntelligenceCatalog,
    *,
    normalizer: SkillNormalizer | None = None,
) -> JobDescriptionExtraction:
    """Extract only catalog-backed requirements and conservative unknown terms."""

    if not isinstance(text, str):
        raise AssessmentError(
            "The job description must be plain text.", 422, "invalid_job_description"
        )
    if not text.strip():
        raise AssessmentError(
            "The job description cannot be empty.", 422, "empty_job_description"
        )
    if len(text) > MAX_JOB_DESCRIPTION_CHARS:
        raise AssessmentError(
            f"The job description exceeds the {MAX_JOB_DESCRIPTION_CHARS}-character limit.",
            422,
            "job_description_too_long",
        )
    if len(text.strip()) < MIN_JOB_DESCRIPTION_CHARS:
        raise AssessmentError(
            f"The job description is too short to evaluate (minimum {MIN_JOB_DESCRIPTION_CHARS} characters).",
            422,
            "job_description_too_short",
        )

    active_normalizer = normalizer or SkillNormalizer(catalog.skills.values())
    known: dict[str, ExtractedJobRequirement] = {}
    unknown: dict[str, ExtractedUnknownRequirement] = {}
    section_type = RequirementType.UNSPECIFIED

    for line_match in re.finditer(r"[^\n]+", text):
        line = line_match.group()
        line_start = line_match.start()
        section_type = _next_section_type(line, section_type)

        for clause_start, clause_text in _iter_clauses(line):
            section_type = _next_section_type(clause_text, section_type)
            if _INSTRUCTION_LIKE_RE.search(clause_text):
                continue
            clause_type = _requirement_type(clause_text, section_type)
            global_start = line_start + clause_start
            matches = active_normalizer.normalize(clause_text)
            occupied = [(match.start, match.end) for match in matches]

            for match in matches:
                candidate = ExtractedJobRequirement(
                    skill_id=match.skill_id,
                    canonical_name=match.canonical_name,
                    matched_alias=match.matched_alias,
                    requirement_type=clause_type,
                    start=global_start + match.start,
                    end=global_start + match.end,
                    confidence=match.confidence,
                )
                existing = known.get(match.skill_id)
                if existing is None or _TYPE_PRIORITY[clause_type] > _TYPE_PRIORITY[existing.requirement_type]:
                    known[match.skill_id] = candidate

            for relative_start, candidate_text in _iter_unknown_chunks(clause_text, occupied):
                candidate_text, start_trim, end_trim, had_cue = _clean_unknown_candidate(candidate_text)
                if not _looks_like_skill_term(candidate_text, had_cue, active_normalizer):
                    continue
                normalized_key = candidate_text.casefold()
                start = global_start + relative_start + start_trim
                end = global_start + relative_start + end_trim
                existing = unknown.get(normalized_key)
                if existing is None or _TYPE_PRIORITY[clause_type] > _TYPE_PRIORITY[existing.requirement_type]:
                    unknown[normalized_key] = ExtractedUnknownRequirement(
                        source_term=candidate_text,
                        requirement_type=clause_type,
                        start=start,
                        end=end,
                    )

    if not known and not unknown:
        raise AssessmentError(
            "No recognizable skill requirements were found in the job description. "
            "Include the skills or technologies the role explicitly asks for.",
            422,
            "no_requirements_detected",
        )

    requirements = tuple(
        sorted(
            known.values(),
            key=lambda item: (
                -_TYPE_PRIORITY[item.requirement_type],
                item.canonical_name.casefold(),
                item.start,
            ),
        )
    )
    unknown_requirements = tuple(
        sorted(
            unknown.values(),
            key=lambda item: (
                -_TYPE_PRIORITY[item.requirement_type],
                item.source_term.casefold(),
            ),
        )
    )
    normalized = re.sub(r"\s+", " ", text.strip())
    return JobDescriptionExtraction(
        text_sha256=hash_job_description(normalized),
        character_count=len(text),
        requirements=requirements,
        unknown_requirements=unknown_requirements,
        instruction_like_text_detected=bool(_INSTRUCTION_LIKE_RE.search(text)),
    )


def hash_job_description(text: str) -> str:
    """Return the stable hash used instead of retaining raw job-description text."""

    normalized = re.sub(r"\s+", " ", text.strip())
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def _next_section_type(line: str, current: RequirementType) -> RequirementType:
    if _PREFERRED_HEADING_RE.search(line):
        return RequirementType.PREFERRED
    if _REQUIRED_HEADING_RE.search(line):
        return RequirementType.REQUIRED
    if _NEUTRAL_HEADING_RE.search(line):
        return RequirementType.UNSPECIFIED
    return current


def _requirement_type(text: str, fallback: RequirementType) -> RequirementType:
    if _PREFERRED_RE.search(text):
        return RequirementType.PREFERRED
    if _REQUIRED_RE.search(text):
        return RequirementType.REQUIRED
    return fallback


def _iter_clauses(line: str):
    boundaries = [0]
    for match in re.finditer(r"[,;]|(?<=[.!?])\s+(?=[A-Z])", line):
        boundaries.append(match.end())
    boundaries.append(len(line))
    for start, end in zip(boundaries, boundaries[1:]):
        value = line[start:end]
        if value.strip():
            yield start, value


def _iter_unknown_chunks(text: str, occupied: list[tuple[int, int]]):
    cursor = 0
    for delimiter in _CHUNK_DELIMITER_RE.finditer(text):
        yield from _yield_chunk(text, cursor, delimiter.start(), occupied)
        cursor = delimiter.end()
    yield from _yield_chunk(text, cursor, len(text), occupied)


def _yield_chunk(text: str, start: int, end: int, occupied: list[tuple[int, int]]):
    if start >= end:
        return
    if any(match_start < end and match_end > start for match_start, match_end in occupied):
        return
    yield start, text[start:end]


def _clean_unknown_candidate(value: str) -> tuple[str, int, int, bool]:
    left = len(value) - len(value.lstrip(" \t-*•:."))
    right = len(value.rstrip(" \t-*•:.;"))
    text = value[left:right]
    had_cue = False
    while True:
        revised = _CUE_PREFIX_RE.sub("", text, count=1)
        if revised == text:
            break
        had_cue = True
        text = revised
        left += len(value[left:right]) - len(text)
    text = _TRAILING_PREPOSITION_RE.sub("", text).strip()
    previous = text
    text = _TRAILING_QUALIFIER_RE.sub("", text).strip()
    if text != previous:
        right -= len(previous) - len(text)
    stripped_left = len(text) - len(text.lstrip())
    stripped_right = len(text.rstrip())
    text = text.strip()
    left += stripped_left
    right = left + len(text) if text else right
    return text, left, max(right, left), had_cue


def _looks_like_skill_term(
    text: str, had_cue: bool, normalizer: SkillNormalizer
) -> bool:
    if not text or len(text) > 60:
        return False
    if re.search(r"[\d@:/\\]", text):
        return False
    if normalizer.normalize(text):
        return False
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9+#.-]*", text)
    if not tokens or len(tokens) > 4:
        return False
    lowered = {token.rstrip(".").casefold() for token in tokens}
    if lowered & _NON_SKILL_TOKENS:
        return False
    if all(len(token) <= 2 for token in tokens):
        return False
    first = tokens[0]
    technical_shape = (
        first[0].isupper()
        or any(token.isupper() and len(token) >= 2 for token in tokens[1:])
        or any(token.casefold() in _TECH_HINTS for token in tokens)
    )
    return had_cue or technical_shape


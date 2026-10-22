"""Deterministic skill-term normalization and resume text matching."""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Iterable, Protocol, Sequence


_WHITESPACE_RE = re.compile(r"\s+")
_TOKEN_LEFT = r"(?<![a-z0-9_+#&])"
_TOKEN_RIGHT = r"(?![a-z0-9_+#&])"


class SkillLike(Protocol):
    skill_id: str
    canonical_name: str
    aliases: Sequence[str]
    context_required_aliases: Sequence[str]


@dataclass(frozen=True)
class SkillMatch:
    """A skill occurrence with an offset into the original input text."""

    skill_id: str
    canonical_name: str
    matched_alias: str
    start: int
    end: int
    confidence: float
    method: str
    context_validated: bool = False


@dataclass(frozen=True)
class _AliasCandidate:
    alias: str
    normalized_alias: str
    skill: SkillLike
    method: str
    confidence: float
    requires_context: bool
    pattern: re.Pattern[str]


_CONTEXT_TERMS: dict[str, tuple[str, ...]] = {
    "c": (
        "c language",
        "c programming",
        "c++",
        "programming",
        "programming languages",
        "data structures",
        "dsa",
        "embedded",
        "pointers",
        "compiler",
        "firmware",
        "algorithms",
    ),
    "r": (
        "r language",
        "r programming",
        "rstudio",
        "programming",
        "programming languages",
        "statistics",
        "statistical",
        "data analysis",
        "ggplot",
        "data frame",
        "biostatistics",
    ),
    "go": (
        "golang",
        "programming",
        "programming languages",
        "backend",
        "microservice",
        "microservices",
        "concurrency",
        "goroutine",
        "kubernetes",
        "cloud",
        "api",
    ),
    "operating-systems": (
        "operating system",
        "operating systems",
        "linux",
        "unix",
        "windows",
        "kernel",
        "process scheduling",
        "memory management",
        "system programming",
        "os concepts",
    ),
}


def normalize_term(value: str) -> str:
    """Return a stable comparison key without discarding technical punctuation."""

    if not isinstance(value, str):
        raise TypeError("value must be a string")
    normalized = unicodedata.normalize("NFKC", value).casefold()
    normalized = normalized.replace("\u2018", "'").replace("\u2019", "'")
    return _WHITESPACE_RE.sub(" ", normalized).strip()


def _normalize_with_offsets(value: str) -> tuple[str, list[int]]:
    pieces: list[str] = []
    offsets: list[int] = []
    previous_was_space = True
    for index, character in enumerate(value):
        piece = unicodedata.normalize("NFKC", character).casefold()
        piece = piece.replace("\u2018", "'").replace("\u2019", "'")
        if piece.isspace():
            if pieces and not previous_was_space:
                pieces.append(" ")
                offsets.append(index)
            previous_was_space = True
            continue
        for normalized_character in piece:
            pieces.append(normalized_character)
            offsets.append(index)
        previous_was_space = False
    while pieces and pieces[-1] == " ":
        pieces.pop()
        offsets.pop()
    return "".join(pieces), offsets


class SkillNormalizer:
    """Match canonical skills using longest, non-overlapping aliases only."""

    def __init__(self, skills: Iterable[SkillLike]):
        self._candidates: list[_AliasCandidate] = []
        alias_owners: dict[str, str] = {}
        for skill in skills:
            terms: dict[str, tuple[str, str, bool]] = {}
            canonical_key = normalize_term(skill.canonical_name)
            context_keys = {
                normalize_term(alias) for alias in skill.context_required_aliases
            }
            terms[canonical_key] = (
                skill.canonical_name,
                "canonical",
                1.0,
            )
            for alias in skill.aliases:
                alias_key = normalize_term(alias)
                if alias_key != canonical_key:
                    terms.setdefault(
                        alias_key,
                        (
                            alias,
                            "alias",
                            0.95,
                        ),
                    )
            for alias_key in context_keys:
                alias_text, method, confidence = terms.get(
                    alias_key, (alias_key, "context_alias", 0.78)
                )
                terms[alias_key] = (alias_text, "context_alias", 0.78)

            for alias_key, (alias_text, method, confidence) in terms.items():
                if not alias_key:
                    continue
                owner = alias_owners.get(alias_key)
                if owner is not None and owner != skill.skill_id:
                    raise ValueError(
                        f"normalized alias {alias_key!r} is shared by "
                        f"{owner!r} and {skill.skill_id!r}"
                    )
                alias_owners[alias_key] = skill.skill_id
                pattern = re.compile(_TOKEN_LEFT + re.escape(alias_key) + _TOKEN_RIGHT)
                self._candidates.append(
                    _AliasCandidate(
                        alias=alias_text,
                        normalized_alias=alias_key,
                        skill=skill,
                        method=method,
                        confidence=confidence,
                        requires_context=alias_key in context_keys,
                        pattern=pattern,
                    )
                )
        self._candidates.sort(
            key=lambda item: (-len(item.normalized_alias), item.normalized_alias)
        )

    def normalize(self, text: str) -> tuple[SkillMatch, ...]:
        if not isinstance(text, str):
            raise TypeError("text must be a string")
        normalized_text, offsets = _normalize_with_offsets(text)
        if not normalized_text:
            return ()

        occurrences: list[tuple[int, int, _AliasCandidate]] = []
        for candidate in self._candidates:
            for match in candidate.pattern.finditer(normalized_text):
                occurrences.append((match.start(), match.end(), candidate))
        occurrences.sort(
            key=lambda item: (
                item[0],
                -(item[1] - item[0]),
                item[2].skill.skill_id,
            )
        )

        matches: list[SkillMatch] = []
        occupied_until = -1
        for start, end, candidate in occurrences:
            if start < occupied_until:
                continue
            if candidate.requires_context and not _has_context(
                candidate.skill.skill_id, normalized_text, start, end
            ):
                continue
            original_start = offsets[start]
            original_end = offsets[end - 1] + 1
            matches.append(
                SkillMatch(
                    skill_id=candidate.skill.skill_id,
                    canonical_name=candidate.skill.canonical_name,
                    matched_alias=candidate.alias,
                    start=original_start,
                    end=original_end,
                    confidence=candidate.confidence,
                    method=candidate.method,
                    context_validated=candidate.requires_context,
                )
            )
            occupied_until = end
        return tuple(matches)


def _has_context(skill_id: str, text: str, start: int, end: int) -> bool:
    window_start = max(0, start - 100)
    window_end = min(len(text), end + 100)
    window = text[window_start:window_end]
    for term in _CONTEXT_TERMS.get(skill_id, ()):
        if re.search(_TOKEN_LEFT + re.escape(term) + _TOKEN_RIGHT, window):
            return True
    return False

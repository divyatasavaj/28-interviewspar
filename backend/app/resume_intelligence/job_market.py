"""Reproducible ingestion of permitted job-posting evidence.

The module never downloads data. Callers must obtain records lawfully and pass
CSV/JSON rows or an authorized API response to ``ingest_records``.
"""

from __future__ import annotations

import csv
import hashlib
import json
import re
from collections import Counter
from dataclasses import dataclass
from datetime import date
from pathlib import Path
from typing import Any, Iterable, Mapping, Sequence

from pydantic import ValidationError

from .catalog import ResumeIntelligenceCatalog, SourceRecord
from .job_market_schemas import (
    IngestionResult,
    IngestionSummary,
    JobPostingInput,
    NormalizedJobPosting,
    NormalizedLocation,
    NormalizedSkillEvidence,
    QuarantinedRecord,
    UnknownSkillReview,
)
from .normalization import SkillNormalizer, normalize_term


TARGET_ROLE_IDS = (
    "software-engineer-sde",
    "frontend-developer",
    "backend-developer",
    "data-analyst",
    "machine-learning-engineer",
)

_DATASET_VERSION_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$")
_SENIORITY_RE = re.compile(
    r"\b(?:senior|sr\.?|lead|principal|staff|manager|head|director|architect|"
    r"vice\s+president|vp)\b",
    re.IGNORECASE,
)
_INTERNSHIP_RE = re.compile(r"\bintern(?:ship)?\b", re.IGNORECASE)
_LEVEL_SUFFIX_RE = re.compile(
    r"(?:\s*[-|]\s*|\s+)(?:i{1,3}|iv|v|[1-5])$", re.IGNORECASE
)
_LEADING_ENTRY_RE = re.compile(
    r"^(?:jr\.?|junior|associate|entry[- ]level|graduate|trainee)\s+",
    re.IGNORECASE,
)
_TRAILING_ENTRY_RE = re.compile(
    r"\s+(?:fresher|graduate|trainee)$", re.IGNORECASE
)
_PARENTHETICAL_RE = re.compile(r"\([^)]*\)")
_TITLE_SEPARATOR_RE = re.compile(r"\s+[-–—|]\s+")
_SKILL_SPLIT_RE = re.compile(r"\s*(?:;|\||,)\s*")
_NON_ROLE_KEY_RE = re.compile(r"[^a-z0-9+#&. ]+")

_INDIAN_STATES = frozenset(
    {
        "andaman and nicobar islands",
        "andhra pradesh",
        "arunachal pradesh",
        "assam",
        "bihar",
        "chandigarh",
        "chhattisgarh",
        "dadra and nagar haveli and daman and diu",
        "delhi",
        "goa",
        "gujarat",
        "haryana",
        "himachal pradesh",
        "jammu and kashmir",
        "jharkhand",
        "karnataka",
        "kerala",
        "ladakh",
        "lakshadweep",
        "madhya pradesh",
        "maharashtra",
        "manipur",
        "meghalaya",
        "mizoram",
        "nagaland",
        "odisha",
        "puducherry",
        "punjab",
        "rajasthan",
        "sikkim",
        "tamil nadu",
        "telangana",
        "tripura",
        "uttar pradesh",
        "uttarakhand",
        "west bengal",
    }
)
_INDIAN_CITIES = frozenset(
    {
        "ahmedabad",
        "bangalore",
        "bengaluru",
        "bhopal",
        "bhubaneswar",
        "chandigarh",
        "chennai",
        "coimbatore",
        "dehradun",
        "delhi",
        "gurgaon",
        "gurugram",
        "hyderabad",
        "indore",
        "jaipur",
        "kochi",
        "kolkata",
        "lucknow",
        "mangalore",
        "mangaluru",
        "mumbai",
        "mysore",
        "mysuru",
        "nagpur",
        "nashik",
        "noida",
        "pune",
        "surat",
        "vadodara",
        "vijayawada",
        "visakhapatnam",
    }
)


class JobMarketInputError(ValueError):
    """A user-safe error raised before row-level ingestion begins."""


@dataclass
class _Candidate:
    posting: NormalizedJobPosting
    unknown_terms: dict[str, str]


def load_input_records(path: str | Path) -> list[tuple[int, Mapping[str, Any]]]:
    """Read CSV or JSON rows without mutating or persisting the source file."""

    input_path = Path(path)
    if not input_path.is_file():
        raise JobMarketInputError("The job-market input file does not exist.")
    suffix = input_path.suffix.casefold()
    try:
        if suffix == ".json":
            document = json.loads(input_path.read_text(encoding="utf-8"))
            if isinstance(document, dict):
                document = document.get("records")
            if not isinstance(document, list):
                raise JobMarketInputError(
                    "JSON input must be an array or an object with a records array."
                )
            records = [
                (index, value)
                for index, value in enumerate(document, start=1)
                if isinstance(value, dict)
            ]
            if len(records) != len(document):
                raise JobMarketInputError(
                    "Every JSON record must be an object."
                )
            return records
        if suffix == ".csv":
            with input_path.open("r", encoding="utf-8-sig", newline="") as stream:
                reader = csv.DictReader(stream)
                if not reader.fieldnames:
                    raise JobMarketInputError("CSV input must include a header row.")
                return [
                    (index, _parse_csv_row(row))
                    for index, row in enumerate(reader, start=1)
                ]
    except (OSError, json.JSONDecodeError, csv.Error) as exc:
        raise JobMarketInputError(
            "The job-market input file could not be read as valid CSV or JSON."
        ) from exc
    raise JobMarketInputError("Only CSV and JSON job-market inputs are supported.")


def ingest_file(
    path: str | Path,
    catalog: ResumeIntelligenceCatalog,
    *,
    dataset_version: str,
    dry_run: bool = True,
) -> IngestionResult:
    rows = load_input_records(path)
    return ingest_records(
        ((row_number, row) for row_number, row in rows),
        catalog,
        dataset_version=dataset_version,
        dry_run=dry_run,
    )


def ingest_records(
    records: Iterable[tuple[int, Mapping[str, Any]]],
    catalog: ResumeIntelligenceCatalog,
    *,
    dataset_version: str,
    dry_run: bool = True,
) -> IngestionResult:
    """Validate, normalize, deduplicate, and summarize permitted posting rows."""

    _validate_dataset_version(dataset_version)
    normalizer = SkillNormalizer(catalog.skills.values())
    candidates: list[_Candidate] = []
    quarantined: list[QuarantinedRecord] = []

    for row_number, raw in records:
        try:
            posting_input = JobPostingInput.model_validate(raw)
        except ValidationError as exc:
            errors = exc.errors(include_url=False, include_input=False)
            field_paths = sorted(
                {
                    ".".join(str(part) for part in error["loc"])
                    for error in errors
                    if error["loc"]
                }
            )
            messages = sorted({str(error["msg"]) for error in errors})
            reason = "Record failed input validation"
            if field_paths:
                reason += f": {', '.join(field_paths)}"
            if messages:
                reason += f". {'; '.join(messages)}"
            quarantined.append(
                QuarantinedRecord(
                    row_number=row_number,
                    source_id=_safe_source_id(raw),
                    reason_code="invalid_schema",
                    reason=reason[:500],
                )
            )
            continue

        source, source_error = _eligible_source(catalog, posting_input.source_id)
        if source_error is not None:
            quarantined.append(
                QuarantinedRecord(
                    row_number=row_number,
                    source_id=posting_input.source_id,
                    reason_code=source_error[0],
                    reason=source_error[1],
                )
            )
            continue
        assert source is not None

        role_id, role_error = resolve_job_role(
            catalog,
            posting_input.title,
            experience_min_years=posting_input.experience_min_years,
            employment_type=posting_input.employment_type,
        )
        if role_error is not None:
            quarantined.append(
                QuarantinedRecord(
                    row_number=row_number,
                    source_id=posting_input.source_id,
                    reason_code=role_error[0],
                    reason=role_error[1],
                )
            )
            continue
        assert role_id is not None

        skill_ids, skill_evidence, unknown_terms, confidence = _extract_skills(
            posting_input, catalog, normalizer
        )
        location = _normalize_location(
            posting_input.location, source.geographic_scope
        )
        fingerprint = _content_fingerprint(
            posting_input, role_id, location, skill_ids
        )
        record_id = _record_id(
            posting_input.source_id,
            posting_input.source_posting_id,
            fingerprint,
        )
        normalized = NormalizedJobPosting(
            record_id=record_id,
            content_fingerprint=fingerprint,
            source_id=posting_input.source_id,
            source_posting_id=posting_input.source_posting_id,
            source_reference_url=posting_input.source_reference_url,
            title=posting_input.title,
            normalized_role_id=role_id,
            employer_name=posting_input.employer_name or "",
            location=location,
            required_skill_ids=skill_ids["required"],
            preferred_skill_ids=skill_ids["preferred"],
            mentioned_skill_ids=skill_ids["mentioned"],
            skill_evidence=skill_evidence,
            skill_extraction_confidence=confidence,
            experience_min_years=posting_input.experience_min_years,
            experience_max_years=posting_input.experience_max_years,
            education=posting_input.education or "",
            employment_type=posting_input.employment_type or "",
            posted_at=posting_input.posted_at,
            collected_at=posting_input.collected_at,
            source_license_status=source.status,
            source_license_name=str(source.license.get("name", "")),
            source_content_kind="job_postings",
            dataset_version=dataset_version,
        )
        candidates.append(_Candidate(normalized, unknown_terms))

    candidates.sort(
        key=lambda item: (
            item.posting.source_id,
            item.posting.source_posting_id or "",
            item.posting.record_id,
        )
    )
    _mark_duplicates(candidates)
    unknown_skills = _aggregate_unknown_skills(candidates, dataset_version)

    unique_candidates = [item for item in candidates if not item.posting.duplicate_of]
    postings = sorted(
        (item.posting for item in candidates), key=lambda item: item.record_id
    )
    role_counts = Counter(item.posting.normalized_role_id for item in unique_candidates)
    source_counts = Counter(item.posting.source_id for item in unique_candidates)
    summary = IngestionSummary(
        input_record_count=len(candidates) + len(quarantined),
        accepted_record_count=len(candidates),
        unique_record_count=len(unique_candidates),
        duplicate_record_count=len(candidates) - len(unique_candidates),
        quarantined_record_count=len(quarantined),
        unknown_skill_count=len(unknown_skills),
        role_counts=dict(sorted(role_counts.items())),
        source_counts=dict(sorted(source_counts.items())),
    )
    result_payload = {
        "dataset_version": dataset_version,
        "postings": [item.model_dump(mode="json") for item in postings],
        "unknown_skills": [
            item.model_dump(mode="json") for item in unknown_skills
        ],
        "quarantined": [
            item.model_dump(mode="json")
            for item in sorted(quarantined, key=lambda item: item.row_number)
        ],
        "summary": summary.model_dump(mode="json"),
    }
    run_id = hashlib.sha256(
        json.dumps(result_payload, sort_keys=True, separators=(",", ":")).encode(
            "utf-8"
        )
    ).hexdigest()
    return IngestionResult(
        run_id=run_id,
        dataset_version=dataset_version,
        dry_run=dry_run,
        postings=postings,
        unknown_skills=unknown_skills,
        quarantined=sorted(quarantined, key=lambda item: item.row_number),
        summary=summary,
    )


def apply_ingestion(database: Any, result: IngestionResult) -> None:
    """Idempotently upsert normalized postings, review terms, and the run record."""

    for posting in result.postings:
        document = posting.model_dump(mode="json")
        database.job_postings.update_one(
            {"record_id": posting.record_id}, {"$set": document}, upsert=True
        )

    for unknown in result.unknown_skills:
        document = unknown.model_dump(mode="json")
        database.unknown_job_skills.update_one(
            {"normalized_term": unknown.normalized_term},
            {
                "$set": {
                    "status": document["status"],
                    "last_seen_dataset_version": document[
                        "last_seen_dataset_version"
                    ],
                },
                "$setOnInsert": {
                    "first_seen_dataset_version": document[
                        "first_seen_dataset_version"
                    ]
                },
                "$addToSet": {
                    "display_terms": {"$each": document["display_terms"]},
                    "source_ids": {"$each": document["source_ids"]},
                    "role_ids": {"$each": document["role_ids"]},
                    "posting_record_ids": {
                        "$each": document["posting_record_ids"]
                    },
                },
            },
            upsert=True,
        )

    quarantine_counts = Counter(item.reason_code for item in result.quarantined)
    run_document = {
        "run_id": result.run_id,
        "schema_version": result.schema_version,
        "dataset_version": result.dataset_version,
        "dry_run": result.dry_run,
        "summary": result.summary.model_dump(mode="json"),
        "quarantine_reasons": dict(sorted(quarantine_counts.items())),
        "quarantined_records": [
            item.model_dump(mode="json") for item in result.quarantined
        ],
    }
    database.job_market_ingestion_runs.update_one(
        {"run_id": result.run_id}, {"$set": run_document}, upsert=True
    )


def resolve_job_role(
    catalog: ResumeIntelligenceCatalog,
    title: str,
    *,
    experience_min_years: float | None = None,
    employment_type: str | None = None,
) -> tuple[str | None, tuple[str, str] | None]:
    """Map a published title to an existing entry-level role ID."""

    if _SENIORITY_RE.search(title):
        return None, (
            "out_of_scope_seniority",
            "Senior, lead, manager, architect, and similar titles are outside the entry-level scope.",
        )
    if _INTERNSHIP_RE.search(title) or (
        employment_type and _INTERNSHIP_RE.search(employment_type)
    ):
        return None, (
            "out_of_scope_employment",
            "Internship postings are excluded so they do not define full-time role requirements.",
        )

    for candidate in _role_title_candidates(title):
        role = catalog.resolve_role(candidate)
        if role is None:
            continue
        if (
            experience_min_years is not None
            and experience_min_years > role.entry_level_max_years
        ):
            return None, (
                "out_of_scope_experience",
                "The stated minimum experience exceeds the role's entry-level range.",
            )
        return role.role_id, None
    return None, (
        "unmapped_role",
        "The job title did not map unambiguously to an existing role ID.",
    )


def _eligible_source(
    catalog: ResumeIntelligenceCatalog, source_id: str
) -> tuple[SourceRecord | None, tuple[str, str] | None]:
    source = catalog.sources.get(source_id)
    if source is None:
        return None, (
            "unknown_source",
            "The source is not present in the approved source registry.",
        )
    if source.status != "approved_for_import":
        return None, (
            "source_not_approved",
            "The source has not been approved for import.",
        )
    if (
        source.content_kind != "job_postings"
        or not source.job_posting_import_allowed
    ):
        return None, (
            "source_not_permitted_for_job_postings",
            "The source is not approved to supply job-posting evidence.",
        )
    restricted = {
        "unverified",
        "not_allowed",
        "restricted",
        "license_required",
        "prohibited_without_written_permission",
        "per_dataset",
        "per_repository",
    }
    if (
        source.license.get("redistribution") in restricted
        or source.license.get("commercial_use") in restricted
    ):
        return None, (
            "source_license_restricted",
            "The source license does not permit this import and retention.",
        )
    return source, None


def _role_title_candidates(title: str) -> list[str]:
    base = _PARENTHETICAL_RE.sub(" ", title)
    base = re.sub(r"\s+", " ", base).strip()
    candidates: list[str] = [base]
    without_leading = _LEADING_ENTRY_RE.sub("", base)
    candidates.append(without_leading)
    candidates.append(_TRAILING_ENTRY_RE.sub("", without_leading))
    for value in list(candidates):
        candidates.extend(
            part.strip()
            for part in _TITLE_SEPARATOR_RE.split(value)
            if part.strip()
        )
    for value in list(candidates):
        candidates.append(_LEVEL_SUFFIX_RE.sub("", value).strip())
    result: list[str] = []
    for value in candidates:
        key = _role_key(value)
        if key and key not in result:
            result.append(key)
    return result


def _role_key(value: str) -> str:
    key = _NON_ROLE_KEY_RE.sub(" ", normalize_term(value))
    return re.sub(r"\s+", " ", key).strip()


def _extract_skills(
    posting: JobPostingInput,
    catalog: ResumeIntelligenceCatalog,
    normalizer: SkillNormalizer,
) -> tuple[dict[str, list[str]], list[NormalizedSkillEvidence], dict[str, str], float]:
    evidence: dict[str, NormalizedSkillEvidence] = {}
    unknown_terms: dict[str, str] = {}
    priority = {"required": 0, "preferred": 1, "mentioned": 2}

    def add_terms(terms: Sequence[str], importance: str) -> None:
        for term in terms:
            exact = catalog.resolve_skill(term)
            matches: list[tuple[str, str, str, float]] = []
            if exact is not None:
                matches.append((exact.skill_id, term, "catalog_exact", 1.0))
            else:
                matches.extend(
                    (
                        match.skill_id,
                        match.matched_alias,
                        match.method,
                        match.confidence,
                    )
                    for match in normalizer.normalize(term)
                )
            if not matches:
                unknown_terms.setdefault(normalize_term(term), term.strip())
                continue
            for skill_id, matched_term, method, confidence in matches:
                existing = evidence.get(skill_id)
                if existing is not None and priority[existing.importance] <= priority[importance]:
                    continue
                evidence[skill_id] = NormalizedSkillEvidence(
                    skill_id=skill_id,
                    matched_term=matched_term[:120],
                    importance=importance,  # type: ignore[arg-type]
                    extraction_method=method[:80],
                    confidence=round(confidence, 3),
                )

    add_terms(posting.required_skills, "required")
    add_terms(posting.preferred_skills, "preferred")
    if posting.description:
        for match in normalizer.normalize(posting.description):
            existing = evidence.get(match.skill_id)
            if existing is not None:
                continue
            evidence[match.skill_id] = NormalizedSkillEvidence(
                skill_id=match.skill_id,
                matched_term=match.matched_alias[:120],
                importance="mentioned",
                extraction_method=match.method[:80],
                confidence=round(match.confidence, 3),
            )

    ordered = [evidence[key] for key in sorted(evidence)]
    by_importance = {
        importance: sorted(
            item.skill_id for item in ordered if item.importance == importance
        )
        for importance in ("required", "preferred", "mentioned")
    }
    confidence = (
        round(sum(item.confidence for item in ordered) / len(ordered), 3)
        if ordered
        else 0.0
    )
    return by_importance, ordered, unknown_terms, confidence


def _content_fingerprint(
    posting: JobPostingInput,
    role_id: str,
    location: NormalizedLocation,
    skill_ids: Mapping[str, list[str]],
) -> str:
    payload = {
        "role_id": role_id,
        "title": _role_key(posting.title),
        "employer": normalize_term(posting.employer_name or ""),
        "city": normalize_term(location.city),
        "state": normalize_term(location.state),
        "required": skill_ids["required"],
        "preferred": skill_ids["preferred"],
        "experience_min": posting.experience_min_years,
        "experience_max": posting.experience_max_years,
        "education": normalize_term(posting.education or ""),
        "employment_type": normalize_term(posting.employment_type or ""),
    }
    return hashlib.sha256(
        json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    ).hexdigest()


def _record_id(
    source_id: str, source_posting_id: str | None, fingerprint: str
) -> str:
    identity = (
        f"{source_id}\x1f{source_posting_id}"
        if source_posting_id
        else f"{source_id}\x1f{fingerprint}"
    )
    return hashlib.sha256(identity.encode("utf-8")).hexdigest()


def _mark_duplicates(candidates: list[_Candidate]) -> None:
    seen_record_ids: dict[str, str] = {}
    seen_fingerprints: dict[str, str] = {}
    for candidate in candidates:
        posting = candidate.posting
        existing_record = seen_record_ids.get(posting.record_id)
        if existing_record is not None:
            posting.duplicate_of = existing_record
            posting.duplicate_kind = "source_record"
            continue
        existing_content = seen_fingerprints.get(posting.content_fingerprint)
        if existing_content is not None:
            posting.duplicate_of = existing_content
            posting.duplicate_kind = "content"
            continue
        seen_record_ids[posting.record_id] = posting.record_id
        seen_fingerprints[posting.content_fingerprint] = posting.record_id


def _aggregate_unknown_skills(
    candidates: list[_Candidate], dataset_version: str
) -> list[UnknownSkillReview]:
    terms: dict[str, dict[str, set[str]]] = {}
    for candidate in candidates:
        if candidate.posting.duplicate_of:
            continue
        for normalized, display in candidate.unknown_terms.items():
            record = terms.setdefault(
                normalized,
                {
                    "display_terms": set(),
                    "source_ids": set(),
                    "role_ids": set(),
                    "posting_record_ids": set(),
                },
            )
            record["display_terms"].add(display)
            record["source_ids"].add(candidate.posting.source_id)
            record["role_ids"].add(candidate.posting.normalized_role_id)
            record["posting_record_ids"].add(candidate.posting.record_id)
    return [
        UnknownSkillReview(
            normalized_term=normalized,
            display_terms=sorted(values["display_terms"]),
            source_ids=sorted(values["source_ids"]),
            role_ids=sorted(values["role_ids"]),
            posting_record_ids=sorted(values["posting_record_ids"]),
            first_seen_dataset_version=dataset_version,
            last_seen_dataset_version=dataset_version,
        )
        for normalized, values in sorted(terms.items())
    ]


def _normalize_location(value: str | None, source_scope: str) -> NormalizedLocation:
    raw = (value or "").strip()
    is_remote = bool(re.search(r"\bremote\b", raw, re.IGNORECASE))
    parts = [part.strip() for part in raw.split(",") if part.strip()]
    country = ""
    if any(normalize_term(part) == "india" for part in parts):
        country = "India"
    state = ""
    for part in parts:
        key = normalize_term(part)
        if key in _INDIAN_STATES:
            state = part
            break
    city = ""
    for part in parts:
        key = normalize_term(part)
        if key in {"india", "remote"} or key in _INDIAN_STATES:
            continue
        city = part
        break
    if not country and (state or normalize_term(city) in _INDIAN_CITIES):
        country = "India"
    if (
        not country
        and "india" in normalize_term(source_scope)
        and (not parts or normalize_term(city) in _INDIAN_CITIES)
    ):
        country = "India"
    return NormalizedLocation(
        city=city[:120],
        state=state[:120],
        country=country[:80],
        is_remote=is_remote,
        india_evidence=country == "India",
    )


def _parse_csv_row(row: Mapping[str, str]) -> dict[str, Any]:
    parsed: dict[str, Any] = {}
    for key, value in row.items():
        if key is None:
            continue
        name = key.strip()
        cleaned = value.strip() if isinstance(value, str) else value
        if cleaned in {None, ""}:
            continue
        if name in {"required_skills", "preferred_skills"}:
            parsed[name] = _parse_skill_cell(cleaned)
        elif name in {"experience_min_years", "experience_max_years"}:
            try:
                parsed[name] = float(cleaned)
            except (TypeError, ValueError):
                parsed[name] = cleaned
        elif name in {"posted_at", "collected_at"}:
            try:
                parsed[name] = date.fromisoformat(str(cleaned))
            except ValueError:
                parsed[name] = cleaned
        else:
            parsed[name] = cleaned
    return parsed


def _parse_skill_cell(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(item) for item in value]
    text = str(value).strip()
    if not text:
        return []
    if text.startswith("["):
        try:
            decoded = json.loads(text)
        except json.JSONDecodeError:
            return [text]
        if isinstance(decoded, list):
            return [str(item) for item in decoded]
    return [part for part in _SKILL_SPLIT_RE.split(text) if part]


def _safe_source_id(raw: Mapping[str, Any]) -> str | None:
    value = raw.get("source_id")
    return value[:100] if isinstance(value, str) and value else None


def _validate_dataset_version(value: str) -> None:
    if not isinstance(value, str) or not _DATASET_VERSION_RE.fullmatch(value):
        raise JobMarketInputError(
            "dataset_version must be 1-80 characters using letters, numbers, dots, underscores, or hyphens."
        )

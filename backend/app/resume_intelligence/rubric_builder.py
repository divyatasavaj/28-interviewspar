"""Evidence assessment and deterministic role-rubric generation."""

from __future__ import annotations

import calendar
import json
from collections import Counter
from datetime import date
from pathlib import Path
from typing import Any, Iterable, Sequence

from .catalog import ResumeIntelligenceCatalog
from .job_market import TARGET_ROLE_IDS
from .job_market_schemas import (
    EvidenceThresholds,
    GeneratedRoleRubric,
    GeneratedRubricRequirement,
    NormalizedJobPosting,
    RubricConfidencePolicy,
    RubricEvidence,
    RubricThresholdDocument,
)


class RubricGenerationError(ValueError):
    """Raised when evidence cannot produce a defensible rubric."""


def load_thresholds(
    data_dir: str | Path | None = None,
) -> tuple[RubricThresholdDocument, EvidenceThresholds]:
    """Load and validate the project-owned evidence thresholds."""

    path = (
        Path(data_dir)
        if data_dir is not None
        else Path(__file__).resolve().parents[2] / "data" / "resume_intelligence"
    ) / "rubric_thresholds.v1.json"
    try:
        document = RubricThresholdDocument.model_validate_json(
            path.read_text(encoding="utf-8")
        )
    except OSError as exc:
        raise RubricGenerationError(
            "The rubric threshold configuration could not be read."
        ) from exc
    return document, document.thresholds


def assess_role_evidence(
    catalog: ResumeIntelligenceCatalog,
    role_id: str,
    postings: Sequence[NormalizedJobPosting],
    thresholds: EvidenceThresholds,
    *,
    threshold_version: str,
    as_of_date: date,
) -> RubricEvidence:
    """Calculate evidence coverage without converting frequency into weights."""

    role_postings = [item for item in postings if item.normalized_role_id == role_id]
    eligible = [item for item in role_postings if item.duplicate_of is None]
    eligible_count = len(eligible)
    source_counts = Counter(item.source_id for item in eligible)
    employer_keys = {
        item.employer_name.strip().casefold()
        for item in eligible
        if item.employer_name.strip()
    }
    city_counts = Counter(
        item.location.city.casefold() for item in eligible if item.location.city
    )
    state_counts = Counter(
        item.location.state.casefold() for item in eligible if item.location.state
    )
    posted_dates = [item.posted_at for item in eligible if item.posted_at is not None]
    cutoff = _subtract_months(as_of_date, thresholds.recency_window_months)
    recent_count = sum(
        1 for value in posted_dates if cutoff <= value <= as_of_date
    )
    duplicate_rate = (
        round(1 - eligible_count / len(role_postings), 3)
        if role_postings
        else 0.0
    )
    required_coverage = (
        round(
            sum(1 for item in eligible if item.required_skill_ids) / eligible_count,
            3,
        )
        if eligible_count
        else 0.0
    )
    mean_confidence = (
        round(
            sum(item.skill_extraction_confidence for item in eligible)
            / eligible_count,
            3,
        )
        if eligible_count
        else 0.0
    )
    india_ratio = (
        round(
            sum(1 for item in eligible if item.location.india_evidence)
            / eligible_count,
            3,
        )
        if eligible_count
        else 0.0
    )
    source_count = len(source_counts)
    maximum_source_share = (
        round(max(source_counts.values()) / eligible_count, 3)
        if source_counts and eligible_count
        else 1.0
    )
    recency_ratio = (
        round(recent_count / eligible_count, 3) if eligible_count else 0.0
    )
    temporal_start = min(posted_dates) if posted_dates else None
    temporal_end = max(posted_dates) if posted_dates else None
    temporal_span_days = (
        (temporal_end - temporal_start).days
        if temporal_start is not None and temporal_end is not None
        else 0
    )
    licensed_sources = all(
        (catalog.sources.get(source_id) is not None)
        and catalog.sources[source_id].status == "approved_for_import"
        for source_id in source_counts
    )

    checks = {
        "eligible_postings": eligible_count >= thresholds.minimum_eligible_postings,
        "unique_employers": len(employer_keys)
        >= thresholds.minimum_unique_employers,
        "distinct_sources": source_count >= thresholds.minimum_distinct_sources,
        "recency": recency_ratio >= thresholds.minimum_recency_ratio,
        "duplicate_rate": duplicate_rate <= thresholds.maximum_duplicate_rate,
        "required_skill_coverage": required_coverage
        >= thresholds.minimum_required_skill_coverage,
        "skill_extraction_confidence": mean_confidence
        >= thresholds.minimum_mean_skill_extraction_confidence,
        "india_location_coverage": india_ratio
        >= thresholds.minimum_india_location_ratio,
        "temporal_span": temporal_span_days
        >= thresholds.minimum_temporal_span_days,
        "single_source_share": maximum_source_share
        <= thresholds.maximum_single_source_share,
        "licensed_sources": licensed_sources,
    }
    thresholds_met = bool(checks) and all(checks.values())
    blockers = [
        _threshold_blocker(key, thresholds)
        for key, passed in checks.items()
        if not passed
    ]
    evidence_tier = (
        "threshold_met_pending_review"
        if thresholds_met and eligible_count
        else "insufficient_market_evidence"
    )
    limitations = [
        "Posting frequency describes market demand; it is not a hiring probability or proof of skill importance.",
        "The rubric remains provisional until a documented human review approves it.",
    ]
    if not posted_dates:
        limitations.append("No posting dates were available, so recency could not be established.")
    if not employer_keys:
        limitations.append("Employer names were unavailable, so employer concentration is unknown.")
    if source_count < thresholds.minimum_distinct_sources:
        limitations.append("Evidence comes from fewer than the configured number of distinct sources.")

    return RubricEvidence(
        evidence_tier=evidence_tier,
        eligible_posting_count=eligible_count,
        unique_employer_count=len(employer_keys),
        source_distribution=dict(sorted(source_counts.items())),
        geographic_coverage={
            "cities": dict(sorted(city_counts.items())),
            "states": dict(sorted(state_counts.items())),
            "india_location_ratio": india_ratio,
        },
        temporal_coverage={
            "from": temporal_start.isoformat() if temporal_start else None,
            "to": temporal_end.isoformat() if temporal_end else None,
            "span_days": temporal_span_days,
            "recency_ratio": recency_ratio,
        },
        duplicate_rate=duplicate_rate,
        required_skill_coverage=required_coverage,
        mean_skill_extraction_confidence=mean_confidence,
        india_location_ratio=india_ratio,
        maximum_single_source_share=maximum_source_share,
        threshold_version=threshold_version,
        thresholds_met=thresholds_met,
        checks=checks,
        blockers=blockers,
        limitations=limitations,
    )


def build_role_rubric(
    catalog: ResumeIntelligenceCatalog,
    role_id: str,
    postings: Sequence[NormalizedJobPosting],
    thresholds: EvidenceThresholds,
    *,
    dataset_version: str,
    threshold_version: str,
    as_of_date: date,
    confidence_policy: RubricConfidencePolicy | None = None,
) -> GeneratedRoleRubric | None:
    """Generate a provisional rubric from accepted, unique role postings."""

    if role_id not in TARGET_ROLE_IDS:
        raise RubricGenerationError(f"{role_id!r} is not an enabled Phase 3 role.")
    if role_id not in catalog.roles:
        raise RubricGenerationError(f"{role_id!r} is not present in the role catalog.")
    existing_rubric = catalog.rubric_for_role(role_id)
    candidate_rubric_id = f"{role_id}@{dataset_version}"
    if existing_rubric is not None and existing_rubric.rubric_id == candidate_rubric_id:
        raise RubricGenerationError(
            "dataset_version collides with an existing rubric ID; choose a new dataset version."
        )
    evidence = assess_role_evidence(
        catalog,
        role_id,
        postings,
        thresholds,
        threshold_version=threshold_version,
        as_of_date=as_of_date,
    )
    eligible = [
        item
        for item in postings
        if item.normalized_role_id == role_id and item.duplicate_of is None
    ]
    if not eligible:
        return None

    required_counts: Counter[str] = Counter()
    preferred_counts: Counter[str] = Counter()
    source_skill: dict[str, dict[str, int]] = {}
    for posting in eligible:
        for skill_id in posting.required_skill_ids:
            required_counts[skill_id] += 1
            source_counts = source_skill.setdefault(skill_id, {})
            source_counts[posting.source_id] = source_counts.get(posting.source_id, 0) + 1
        for skill_id in posting.preferred_skill_ids:
            preferred_counts[skill_id] += 1
            source_counts = source_skill.setdefault(skill_id, {})
            source_counts[posting.source_id] = source_counts.get(posting.source_id, 0) + 1
    skill_ids = sorted(set(required_counts) | set(preferred_counts))
    if not skill_ids:
        raise RubricGenerationError(
            "The evidence contains no required or preferred skills for this role."
        )

    requirements: list[GeneratedRubricRequirement] = []
    for skill_id in skill_ids:
        required_count = required_counts[skill_id]
        preferred_count = preferred_counts[skill_id]
        importance = "core" if required_count else "preferred"
        if required_count:
            rationale = (
                f"Classified as required in {required_count} of {len(eligible)} "
                "eligible postings. Frequency is descriptive; no scoring weight is inferred."
            )
            support_label = "required"
        else:
            rationale = (
                f"Classified as preferred in {preferred_count} of {len(eligible)} "
                "eligible postings. Frequency is descriptive; no scoring weight is inferred."
            )
            support_label = "preferred"
        refs: list[dict[str, object]] = []
        for source_id, source_support in sorted(source_skill[skill_id].items()):
            refs.append(
                {
                    "source_id": source_id,
                    "source_record_id": None,
                    "note": (
                        f"{support_label} in {source_support} eligible posting(s) "
                        "from this source; frequency is not a weight."
                    ),
                }
            )
        requirements.append(
            GeneratedRubricRequirement(
                requirement_id=f"market-{skill_id}",
                skill_ids=[skill_id],
                importance=importance,
                rationale=rationale,
                source_refs=refs,
            )
        )

    confidence = _rubric_confidence(
        evidence, thresholds, len(eligible), confidence_policy
    )
    confidence_reasons = [
        f"Based on {len(eligible)} eligible, unique postings after deduplication.",
        (
            "Configured evidence thresholds were met; the rubric still requires manual review."
            if evidence.thresholds_met
            else "One or more configured evidence thresholds were not met."
        ),
        f"Source distribution: {json.dumps(evidence.source_distribution, sort_keys=True)}.",
    ]
    role = catalog.roles[role_id]
    return GeneratedRoleRubric(
        rubric_id=f"{role_id}@{dataset_version}",
        role_id=role_id,
        version=dataset_version,
        created_at=as_of_date,
        source_snapshot_ids=sorted(evidence.source_distribution),
        sample_size=len(eligible),
        confidence=confidence,
        confidence_reasons=confidence_reasons,
        dimensions=[
            {
                "dimension_id": "market_required",
                "label": "Employer-required technical evidence",
                "description": "Skills explicitly classified as required in eligible postings.",
                "weight": None,
                "weight_status": "pending_manual_validation",
            },
            {
                "dimension_id": "market_preferred",
                "label": "Employer-preferred technical evidence",
                "description": "Skills explicitly classified as preferred in eligible postings.",
                "weight": None,
                "weight_status": "pending_manual_validation",
            },
            {
                "dimension_id": "resume_evidence",
                "label": "Resume evidence strength",
                "description": "Reserved for the separate deterministic scoring phase.",
                "weight": None,
                "weight_status": "pending_manual_validation",
            },
        ],
        validation={
            "status": "not_reviewed",
            "reviewer_count": 0,
            "notes": (
                f"Generated from {role.canonical_title} postings for dataset "
                f"{dataset_version}. Manual validation is required before approval."
            ),
        },
        requirements=requirements,
        evidence=evidence,
    )


def build_target_rubrics(
    catalog: ResumeIntelligenceCatalog,
    postings: Sequence[NormalizedJobPosting],
    thresholds: EvidenceThresholds,
    *,
    dataset_version: str,
    threshold_version: str,
    as_of_date: date,
    role_ids: Iterable[str] = TARGET_ROLE_IDS,
    confidence_policy: RubricConfidencePolicy | None = None,
) -> list[GeneratedRoleRubric]:
    rubrics: list[GeneratedRoleRubric] = []
    for role_id in role_ids:
        rubric = build_role_rubric(
            catalog,
            role_id,
            postings,
            thresholds,
            dataset_version=dataset_version,
            threshold_version=threshold_version,
            as_of_date=as_of_date,
            confidence_policy=confidence_policy,
        )
        if rubric is not None:
            rubrics.append(rubric)
    return rubrics


def apply_generated_rubrics(database: Any, rubrics: Sequence[GeneratedRoleRubric]) -> None:
    """Store generated versions without making them active or approved."""

    for rubric in rubrics:
        document = rubric.model_dump(mode="json")
        document["is_published"] = False
        document["validation_status"] = rubric.validation["status"]
        document["evidence_tier"] = rubric.evidence.evidence_tier
        database.role_rubrics.update_one(
            {"rubric_id": rubric.rubric_id}, {"$set": document}, upsert=True
        )


def write_rubric_documents(
    directory: str | Path, rubrics: Sequence[GeneratedRoleRubric]
) -> list[Path]:
    output = Path(directory)
    output.mkdir(parents=True, exist_ok=True)
    paths: list[Path] = []
    for rubric in sorted(rubrics, key=lambda item: item.rubric_id):
        path = output / f"{rubric.role_id}.{rubric.version}.json"
        path.write_text(
            json.dumps(rubric.model_dump(mode="json"), indent=2) + "\n",
            encoding="utf-8",
        )
        paths.append(path)
    return paths


def _rubric_confidence(
    evidence: RubricEvidence,
    thresholds: EvidenceThresholds,
    eligible_count: int,
    confidence_policy: RubricConfidencePolicy | None,
) -> str:
    policy = (
        (
            confidence_policy.minimum_medium_confidence_postings,
            confidence_policy.minimum_high_confidence_postings,
        )
        if confidence_policy is not None
        else _confidence_policy_from_thresholds(thresholds)
    )
    if evidence.thresholds_met and eligible_count >= policy[1]:
        return "high"
    if eligible_count >= policy[0]:
        return "medium"
    return "low"


def _confidence_policy_from_thresholds(
    thresholds: EvidenceThresholds,
) -> tuple[int, int]:
    # Kept deterministic when only the threshold model is supplied to tests.
    return (
        max(1, thresholds.minimum_eligible_postings // 2),
        thresholds.minimum_eligible_postings,
    )


def _subtract_months(value: date, months: int) -> date:
    month_index = value.year * 12 + value.month - 1 - months
    year, month = divmod(month_index, 12)
    month += 1
    day = min(value.day, calendar.monthrange(year, month)[1])
    return date(year, month, day)


def _threshold_blocker(key: str, thresholds: EvidenceThresholds) -> str:
    statements = {
        "eligible_postings": (
            f"Fewer than {thresholds.minimum_eligible_postings} eligible postings."
        ),
        "unique_employers": (
            f"Fewer than {thresholds.minimum_unique_employers} unique employers."
        ),
        "distinct_sources": (
            f"Fewer than {thresholds.minimum_distinct_sources} distinct sources."
        ),
        "recency": (
            "Fewer than the configured share of postings fall within the recency window."
        ),
        "duplicate_rate": "The duplicate rate exceeds the configured maximum.",
        "required_skill_coverage": (
            "Too few postings distinguish required skills."
        ),
        "skill_extraction_confidence": (
            "Mean skill-extraction confidence is below the configured minimum."
        ),
        "india_location_coverage": (
            "India location evidence is below the configured minimum share."
        ),
        "temporal_span": "Posting dates do not cover the configured time span.",
        "single_source_share": "A single source contributes too much of the evidence.",
        "licensed_sources": "At least one contributing source is not approved and licensed.",
    }
    return statements[key]

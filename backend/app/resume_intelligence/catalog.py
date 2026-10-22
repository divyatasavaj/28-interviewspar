"""Load and validate versioned resume-intelligence reference data."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import date
from pathlib import Path
from typing import Any, Mapping

from .normalization import normalize_term


CATALOG_SCHEMA_VERSION = "1.0.0"

SOURCE_STATUSES = frozenset(
    {
        "approved_for_import",
        "manual_review_required",
        "access_pending",
        "reference_only",
        "license_required",
        "per_item_review",
        "rejected",
    }
)
SKILL_CATEGORIES = frozenset(
    {
        "programming_language",
        "frontend",
        "backend",
        "database",
        "cloud_devops",
        "data_analytics",
        "ai_ml",
        "cs_fundamentals",
        "testing",
        "security",
        "tooling",
        "methodology",
        "soft_skill",
    }
)
MATCH_POLICIES = frozenset({"standard", "context_required"})
SKILL_VERIFICATION_STATUSES = frozenset(
    {"curated_alias_reviewed", "source_verified", "provisional"}
)
ROLE_STATUSES = frozenset({"active", "retired"})
ROLE_RUBRIC_STATUSES = frozenset(
    {"not_available", "seeded_provisional", "validated", "stale"}
)
RUBRIC_STATUSES = frozenset({"draft", "provisional", "approved", "retired"})
RUBRIC_CONFIDENCE_LEVELS = frozenset({"low", "medium", "high"})
REQUIREMENT_IMPORTANCE_LEVELS = frozenset(
    {"core", "important", "preferred", "optional"}
)
REQUIREMENT_MATCH_MODES = frozenset({"all", "any"})
WEIGHT_STATUSES = frozenset(
    {"pending_manual_validation", "validated", "not_applicable"}
)
VALIDATION_STATUSES = frozenset(
    {"not_reviewed", "in_review", "approved", "rejected"}
)
LICENSE_PERMISSION_VALUES = frozenset(
    {
        "allowed",
        "allowed_with_attribution",
        "not_allowed",
        "unverified",
        "per_dataset",
        "per_repository",
        "restricted",
        "license_required",
        "prohibited_without_written_permission",
        "not_applicable",
    }
)
TAXONOMY_MAPPING_QUALITIES = frozenset(
    {"direct", "closest", "job_title_alias", "manual_crosswalk", "related"}
)
SOURCE_CONTENT_KINDS = frozenset(
    {
        "job_postings",
        "occupation_taxonomy",
        "curated_taxonomy",
        "dataset_catalog",
        "unknown",
    }
)


class DataValidationError(ValueError):
    """Raised when catalog or rubric data violates the published contract."""


@dataclass(frozen=True)
class ProvenanceRecord:
    provenance_id: str
    type: str
    source_id: str
    version: str
    retrieved_at: str
    note: str


@dataclass(frozen=True)
class SourceRecord:
    source_id: str
    name: str
    official_url: str | None
    format: str
    acquisition_method: str
    version: str
    geographic_scope: str
    license: Mapping[str, Any]
    permitted_use: str
    retention_scope: str
    status: str
    limitations: tuple[str, ...]
    verified_on: str
    verification_note: str
    content_kind: str = "unknown"
    job_posting_import_allowed: bool = False


@dataclass(frozen=True)
class Skill:
    skill_id: str
    canonical_name: str
    aliases: tuple[str, ...]
    category: str
    related_skill_ids: tuple[str, ...]
    taxonomy_refs: tuple[Mapping[str, Any], ...]
    match_policy: str
    context_required_aliases: tuple[str, ...]
    verification_status: str
    provenance_ids: tuple[str, ...]


@dataclass(frozen=True)
class Role:
    role_id: str
    canonical_title: str
    family_id: str
    family_title: str
    aliases: tuple[str, ...]
    description: str
    entry_level_min_years: int
    entry_level_max_years: int
    taxonomy_refs: tuple[Mapping[str, Any], ...]
    rubric_status: str
    rubric_id: str | None
    status: str
    provenance_ids: tuple[str, ...]


@dataclass(frozen=True)
class RubricRequirement:
    requirement_id: str
    skill_ids: tuple[str, ...]
    match_mode: str
    importance: str
    weight: float | None
    weight_status: str
    rationale: str
    source_refs: tuple[Mapping[str, Any], ...]


@dataclass(frozen=True)
class Rubric:
    schema_version: str
    rubric_id: str
    role_id: str
    version: str
    status: str
    created_at: str
    approved_at: str | None
    source_snapshot_ids: tuple[str, ...]
    sample_size: int
    confidence: str
    confidence_reasons: tuple[str, ...]
    provenance_mode: str
    score_policy_version: str
    dimensions: tuple[Mapping[str, Any], ...]
    validation: Mapping[str, Any]
    requirements: tuple[RubricRequirement, ...]
    evidence: Mapping[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class ResumeIntelligenceCatalog:
    schema_version: str
    data_dir: Path
    source_registry_version: str
    skills_catalog_version: str
    roles_catalog_version: str
    sources: Mapping[str, SourceRecord]
    provenance: Mapping[str, ProvenanceRecord]
    skills: Mapping[str, Skill]
    roles: Mapping[str, Role]
    rubrics: Mapping[str, Rubric]
    _skill_alias_index: Mapping[str, Skill] = field(
        init=False, repr=False, compare=False
    )
    _role_alias_index: Mapping[str, Role] = field(
        init=False, repr=False, compare=False
    )

    def __post_init__(self) -> None:
        _validate_catalog(self)
        object.__setattr__(self, "_skill_alias_index", _build_skill_alias_index(self))
        object.__setattr__(self, "_role_alias_index", _build_role_alias_index(self))

    def rubric_for_role(self, role_id: str) -> Rubric | None:
        role = self.roles.get(role_id)
        if role is None or not role.rubric_id:
            return None
        return self.rubrics.get(role.rubric_id)

    def published_rubric_for_role(self, role_id: str) -> Rubric | None:
        rubric = self.rubric_for_role(role_id)
        if rubric is None or rubric.status not in {"provisional", "approved"}:
            return None
        return rubric

    def resolve_skill(self, term: str) -> Skill | None:
        return self._skill_alias_index.get(normalize_term(term))

    def resolve_role(self, term: str) -> Role | None:
        return self._role_alias_index.get(normalize_term(term))


def load_catalog(data_dir: str | Path | None = None) -> ResumeIntelligenceCatalog:
    """Load the active catalog using one file per schema family."""

    root = (
        Path(data_dir)
        if data_dir is not None
        else Path(__file__).resolve().parents[2] / "data" / "resume_intelligence"
    ).resolve()
    if not root.is_dir():
        raise DataValidationError(f"catalog directory does not exist: {root}")

    source_document = _read_json(_single_data_file(root, "sources.v*.json"))
    skill_document = _read_json(_single_data_file(root, "skills.v*.json"))
    role_document = _read_json(_single_data_file(root, "roles.v*.json"))

    for label, document in (
        ("sources", source_document),
        ("skills", skill_document),
        ("roles", role_document),
    ):
        version = _required_str(document, "schema_version", f"{label} document")
        if version != CATALOG_SCHEMA_VERSION:
            raise DataValidationError(
                f"{label} schema_version must be {CATALOG_SCHEMA_VERSION}, got {version!r}"
            )

    source_records = _parse_sources(source_document)
    provenance: dict[str, ProvenanceRecord] = {}
    for document, label in (
        (skill_document, "skills"),
        (role_document, "roles"),
    ):
        for provenance_record in _parse_provenance(document, label):
            existing = provenance.get(provenance_record.provenance_id)
            if existing is not None:
                identity = (
                    existing.type,
                    existing.source_id,
                    existing.version,
                    existing.retrieved_at,
                )
                new_identity = (
                    provenance_record.type,
                    provenance_record.source_id,
                    provenance_record.version,
                    provenance_record.retrieved_at,
                )
                if identity != new_identity:
                    raise DataValidationError(
                        "conflicting provenance record "
                        f"{provenance_record.provenance_id!r} in {label} data"
                    )
                continue
            provenance[provenance_record.provenance_id] = provenance_record

    skills = _parse_skills(skill_document)
    roles = _parse_roles(role_document)
    rubrics = _parse_rubrics(root / "rubrics")

    return ResumeIntelligenceCatalog(
        schema_version=CATALOG_SCHEMA_VERSION,
        data_dir=root,
        source_registry_version=_required_str(
            source_document, "registry_version", "sources document"
        ),
        skills_catalog_version=_required_str(
            skill_document, "catalog_version", "skills document"
        ),
        roles_catalog_version=_required_str(
            role_document, "catalog_version", "roles document"
        ),
        sources=source_records,
        provenance=provenance,
        skills=skills,
        roles=roles,
        rubrics=rubrics,
    )


def _read_json(path: Path) -> Mapping[str, Any]:
    try:
        with path.open("r", encoding="utf-8") as stream:
            document = json.load(stream)
    except OSError as exc:
        raise DataValidationError(f"cannot read {path}: {exc}") from exc
    except json.JSONDecodeError as exc:
        raise DataValidationError(f"invalid JSON in {path}: {exc}") from exc
    if not isinstance(document, dict):
        raise DataValidationError(f"{path} must contain a JSON object")
    return document


def _single_data_file(root: Path, pattern: str) -> Path:
    matches = sorted(root.glob(pattern))
    if len(matches) != 1:
        raise DataValidationError(
            f"expected exactly one {pattern} file in {root}, found {len(matches)}"
        )
    return matches[0]


def _required_str(document: Mapping[str, Any], key: str, label: str) -> str:
    value = document.get(key)
    if not isinstance(value, str) or not value.strip():
        raise DataValidationError(f"{label}.{key} must be a non-empty string")
    return value.strip()


def _nullable_str(document: Mapping[str, Any], key: str, label: str) -> str | None:
    value = document.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or not value.strip():
        raise DataValidationError(f"{label}.{key} must be a non-empty string or null")
    return value.strip()


def _optional_str(
    document: Mapping[str, Any], key: str, default: str, label: str
) -> str:
    value = document.get(key)
    if value is None:
        return default
    if not isinstance(value, str) or not value.strip():
        raise DataValidationError(f"{label}.{key} must be a non-empty string")
    return value.strip()


def _optional_bool(
    document: Mapping[str, Any], key: str, default: bool, label: str
) -> bool:
    value = document.get(key, default)
    if type(value) is not bool:
        raise DataValidationError(f"{label}.{key} must be a boolean")
    return value


def _required_int(document: Mapping[str, Any], key: str, label: str) -> int:
    value = document.get(key)
    if type(value) is not int:
        raise DataValidationError(f"{label}.{key} must be an integer")
    return value


def _nullable_number(
    document: Mapping[str, Any], key: str, label: str
) -> float | None:
    value = document.get(key)
    if value is None:
        return None
    if type(value) not in {int, float}:
        raise DataValidationError(f"{label}.{key} must be a number or null")
    return float(value)


def _required_list(document: Mapping[str, Any], key: str, label: str) -> list[Any]:
    value = document.get(key)
    if not isinstance(value, list):
        raise DataValidationError(f"{label}.{key} must be an array")
    return value


def _string_tuple(document: Mapping[str, Any], key: str, label: str) -> tuple[str, ...]:
    values = _required_list(document, key, label)
    result: list[str] = []
    for index, value in enumerate(values):
        if not isinstance(value, str) or not value.strip():
            raise DataValidationError(
                f"{label}.{key}[{index}] must be a non-empty string"
            )
        result.append(value.strip())
    return tuple(result)


def _mapping_tuple(
    document: Mapping[str, Any], key: str, label: str, required: bool = True
) -> tuple[Mapping[str, Any], ...]:
    if not required and key not in document:
        return ()
    values = _required_list(document, key, label)
    result: list[Mapping[str, Any]] = []
    for index, value in enumerate(values):
        if not isinstance(value, dict):
            raise DataValidationError(f"{label}.{key}[{index}] must be an object")
        result.append(dict(value))
    return tuple(result)


def _parse_sources(document: Mapping[str, Any]) -> dict[str, SourceRecord]:
    result: dict[str, SourceRecord] = {}
    for index, raw in enumerate(_required_list(document, "sources", "sources document")):
        label = f"sources[{index}]"
        if not isinstance(raw, dict):
            raise DataValidationError(f"{label} must be an object")
        source = SourceRecord(
            source_id=_required_str(raw, "source_id", label),
            name=_required_str(raw, "name", label),
            official_url=_nullable_str(raw, "official_url", label),
            format=_required_str(raw, "format", label),
            acquisition_method=_required_str(raw, "acquisition_method", label),
            version=_required_str(raw, "version", label),
            geographic_scope=_required_str(raw, "geographic_scope", label),
            license=_parse_license(raw, label),
            permitted_use=_required_str(raw, "permitted_use", label),
            retention_scope=_required_str(raw, "retention_scope", label),
            status=_required_str(raw, "status", label),
            limitations=_string_tuple(raw, "limitations", label),
            verified_on=_date_string(raw, "verified_on", label),
            verification_note=_required_str(raw, "verification_note", label),
            content_kind=_optional_str(raw, "content_kind", "unknown", label),
            job_posting_import_allowed=_optional_bool(
                raw, "job_posting_import_allowed", False, label
            ),
        )
        if source.source_id in result:
            raise DataValidationError(f"duplicate source_id {source.source_id!r}")
        result[source.source_id] = source
    if not result:
        raise DataValidationError("source registry cannot be empty")
    return result


def _parse_license(document: Mapping[str, Any], label: str) -> dict[str, Any]:
    raw = document.get("license")
    if not isinstance(raw, dict):
        raise DataValidationError(f"{label}.license must be an object")
    for key in ("name", "redistribution", "commercial_use", "attribution"):
        if not isinstance(raw.get(key), str) or not raw[key].strip():
            raise DataValidationError(
                f"{label}.license.{key} must be a non-empty string"
            )
    url = raw.get("url")
    if url is not None and (not isinstance(url, str) or not url.strip()):
        raise DataValidationError(f"{label}.license.url must be a string or null")
    return dict(raw)


def _date_string(document: Mapping[str, Any], key: str, label: str) -> str:
    value = _required_str(document, key, label)
    try:
        date.fromisoformat(value)
    except ValueError as exc:
        raise DataValidationError(f"{label}.{key} must be an ISO date") from exc
    return value


def _parse_provenance(
    document: Mapping[str, Any], label: str
) -> tuple[ProvenanceRecord, ...]:
    raw_records = document.get("provenance")
    if not isinstance(raw_records, dict):
        raise DataValidationError(f"{label} document.provenance must be an object")
    result: list[ProvenanceRecord] = []
    for provenance_id, raw in raw_records.items():
        item_label = f"{label}.provenance.{provenance_id}"
        if not isinstance(raw, dict):
            raise DataValidationError(f"{item_label} must be an object")
        declared_id = _required_str(raw, "provenance_id", item_label)
        if declared_id != provenance_id:
            raise DataValidationError(
                f"{item_label}.provenance_id must match its object key"
            )
        result.append(
            ProvenanceRecord(
                provenance_id=declared_id,
                type=_required_str(raw, "type", item_label),
                source_id=_required_str(raw, "source_id", item_label),
                version=_required_str(raw, "version", item_label),
                retrieved_at=_date_string(raw, "retrieved_at", item_label),
                note=_required_str(raw, "note", item_label),
            )
        )
    return tuple(result)


def _parse_skills(document: Mapping[str, Any]) -> dict[str, Skill]:
    result: dict[str, Skill] = {}
    for index, raw in enumerate(_required_list(document, "skills", "skills document")):
        label = f"skills[{index}]"
        if not isinstance(raw, dict):
            raise DataValidationError(f"{label} must be an object")
        skill = Skill(
            skill_id=_required_str(raw, "skill_id", label),
            canonical_name=_required_str(raw, "canonical_name", label),
            aliases=_string_tuple(raw, "aliases", label),
            category=_required_str(raw, "category", label),
            related_skill_ids=_string_tuple(raw, "related_skill_ids", label),
            taxonomy_refs=_mapping_tuple(raw, "taxonomy_refs", label),
            match_policy=_required_str(raw, "match_policy", label),
            context_required_aliases=_string_tuple(
                raw, "context_required_aliases", label
            ),
            verification_status=_required_str(raw, "verification_status", label),
            provenance_ids=_string_tuple(raw, "provenance_ids", label),
        )
        if skill.skill_id in result:
            raise DataValidationError(f"duplicate skill_id {skill.skill_id!r}")
        result[skill.skill_id] = skill
    if not result:
        raise DataValidationError("skill dictionary cannot be empty")
    return result


def _parse_roles(document: Mapping[str, Any]) -> dict[str, Role]:
    result: dict[str, Role] = {}
    for index, raw in enumerate(_required_list(document, "roles", "roles document")):
        label = f"roles[{index}]"
        if not isinstance(raw, dict):
            raise DataValidationError(f"{label} must be an object")
        role = Role(
            role_id=_required_str(raw, "role_id", label),
            canonical_title=_required_str(raw, "canonical_title", label),
            family_id=_required_str(raw, "family_id", label),
            family_title=_required_str(raw, "family_title", label),
            aliases=_string_tuple(raw, "aliases", label),
            description=_required_str(raw, "description", label),
            entry_level_min_years=_required_int(raw, "entry_level_min_years", label),
            entry_level_max_years=_required_int(raw, "entry_level_max_years", label),
            taxonomy_refs=_mapping_tuple(raw, "taxonomy_refs", label),
            rubric_status=_required_str(raw, "rubric_status", label),
            rubric_id=_nullable_str(raw, "rubric_id", label),
            status=_required_str(raw, "status", label),
            provenance_ids=_string_tuple(raw, "provenance_ids", label),
        )
        if role.role_id in result:
            raise DataValidationError(f"duplicate role_id {role.role_id!r}")
        result[role.role_id] = role
    if not result:
        raise DataValidationError("role catalog cannot be empty")
    return result


def _parse_rubrics(directory: Path) -> dict[str, Rubric]:
    if not directory.is_dir():
        raise DataValidationError(f"rubric directory does not exist: {directory}")
    paths = sorted(directory.glob("*.json"))
    if not paths:
        raise DataValidationError(f"rubric directory is empty: {directory}")
    result: dict[str, Rubric] = {}
    for path in paths:
        raw = _read_json(path)
        label = f"rubric {path.name}"
        rubric = Rubric(
            schema_version=_required_str(raw, "schema_version", label),
            rubric_id=_required_str(raw, "rubric_id", label),
            role_id=_required_str(raw, "role_id", label),
            version=_required_str(raw, "version", label),
            status=_required_str(raw, "status", label),
            created_at=_date_string(raw, "created_at", label),
            approved_at=_nullable_date_string(raw, "approved_at", label),
            source_snapshot_ids=_string_tuple(raw, "source_snapshot_ids", label),
            sample_size=_required_int(raw, "sample_size", label),
            confidence=_required_str(raw, "confidence", label),
            confidence_reasons=_string_tuple(raw, "confidence_reasons", label),
            provenance_mode=_required_str(raw, "provenance_mode", label),
            score_policy_version=_required_str(raw, "score_policy_version", label),
            dimensions=_mapping_tuple(raw, "dimensions", label),
            validation=_required_mapping(raw, "validation", label),
            requirements=_parse_requirements(raw, label),
            evidence=_optional_mapping(raw, "evidence", label),
        )
        if rubric.rubric_id in result:
            raise DataValidationError(f"duplicate rubric_id {rubric.rubric_id!r}")
        result[rubric.rubric_id] = rubric
    return result


def _parse_requirements(
    document: Mapping[str, Any], label: str
) -> tuple[RubricRequirement, ...]:
    result: list[RubricRequirement] = []
    seen_ids: set[str] = set()
    for index, raw in enumerate(
        _required_list(document, "requirements", label)
    ):
        item_label = f"{label}.requirements[{index}]"
        if not isinstance(raw, dict):
            raise DataValidationError(f"{item_label} must be an object")
        requirement_id = _required_str(raw, "requirement_id", item_label)
        if requirement_id in seen_ids:
            raise DataValidationError(
                f"{label} has duplicate requirement_id {requirement_id!r}"
            )
        seen_ids.add(requirement_id)
        result.append(
            RubricRequirement(
                requirement_id=requirement_id,
                skill_ids=_string_tuple(raw, "skill_ids", item_label),
                match_mode=_required_str(raw, "match_mode", item_label),
                importance=_required_str(raw, "importance", item_label),
                weight=_nullable_number(raw, "weight", item_label),
                weight_status=_required_str(raw, "weight_status", item_label),
                rationale=_required_str(raw, "rationale", item_label),
                source_refs=_mapping_tuple(raw, "source_refs", item_label),
            )
        )
    return tuple(result)


def _required_mapping(
    document: Mapping[str, Any], key: str, label: str
) -> dict[str, Any]:
    value = document.get(key)
    if not isinstance(value, dict):
        raise DataValidationError(f"{label}.{key} must be an object")
    return dict(value)


def _optional_mapping(
    document: Mapping[str, Any], key: str, label: str
) -> dict[str, Any]:
    value = document.get(key)
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise DataValidationError(f"{label}.{key} must be an object")
    return dict(value)


def _nullable_date_string(
    document: Mapping[str, Any], key: str, label: str
) -> str | None:
    value = document.get(key)
    if value is None:
        return None
    return _date_string(document, key, label)


def _validate_catalog(catalog: ResumeIntelligenceCatalog) -> None:
    if catalog.schema_version != CATALOG_SCHEMA_VERSION:
        raise DataValidationError("catalog schema version is not supported")
    for value, label in (
        (catalog.source_registry_version, "source registry version"),
        (catalog.skills_catalog_version, "skills catalog version"),
        (catalog.roles_catalog_version, "roles catalog version"),
    ):
        if not value.strip():
            raise DataValidationError(f"{label} cannot be empty")
    _validate_sources(catalog)
    _validate_provenance(catalog)
    _validate_skills(catalog)
    _validate_roles(catalog)
    _validate_rubrics(catalog)


def _validate_sources(catalog: ResumeIntelligenceCatalog) -> None:
    for source in catalog.sources.values():
        if source.status not in SOURCE_STATUSES:
            raise DataValidationError(
                f"source {source.source_id!r} has invalid status {source.status!r}"
            )
        if source.content_kind not in SOURCE_CONTENT_KINDS:
            raise DataValidationError(
                f"source {source.source_id!r} has invalid content_kind "
                f"{source.content_kind!r}"
            )
        if (
            source.job_posting_import_allowed
            and source.status != "approved_for_import"
        ):
            raise DataValidationError(
                f"source {source.source_id!r} permits job-posting imports while "
                "its status is not approved_for_import"
            )
        redistribution = source.license.get("redistribution")
        commercial_use = source.license.get("commercial_use")
        for field_name, value in (
            ("redistribution", redistribution),
            ("commercial_use", commercial_use),
        ):
            if value not in LICENSE_PERMISSION_VALUES:
                raise DataValidationError(
                    f"source {source.source_id!r} has invalid license.{field_name}"
                )
        if source.status == "approved_for_import" and (
            redistribution == "unverified" or commercial_use == "unverified"
        ):
            raise DataValidationError(
                f"source {source.source_id!r} cannot be approved while its license "
                "is unverified"
            )


def _validate_provenance(catalog: ResumeIntelligenceCatalog) -> None:
    for record in catalog.provenance.values():
        if record.source_id not in catalog.sources:
            raise DataValidationError(
                f"provenance {record.provenance_id!r} references unknown source "
                f"{record.source_id!r}"
            )


def _validate_skills(catalog: ResumeIntelligenceCatalog) -> None:
    alias_owners: dict[str, str] = {}
    for skill in catalog.skills.values():
        if skill.category not in SKILL_CATEGORIES:
            raise DataValidationError(
                f"skill {skill.skill_id!r} has invalid category {skill.category!r}"
            )
        if skill.match_policy not in MATCH_POLICIES:
            raise DataValidationError(
                f"skill {skill.skill_id!r} has invalid match policy"
            )
        if skill.verification_status not in SKILL_VERIFICATION_STATUSES:
            raise DataValidationError(
                f"skill {skill.skill_id!r} has invalid verification status"
            )
        if skill.skill_id in skill.related_skill_ids:
            raise DataValidationError(
                f"skill {skill.skill_id!r} cannot relate to itself"
            )
        for related_id in skill.related_skill_ids:
            if related_id not in catalog.skills:
                raise DataValidationError(
                    f"skill {skill.skill_id!r} references unknown related skill "
                    f"{related_id!r}"
                )
        for provenance_id in skill.provenance_ids:
            if provenance_id not in catalog.provenance:
                raise DataValidationError(
                    f"skill {skill.skill_id!r} references unknown provenance "
                    f"{provenance_id!r}"
                )
        _validate_taxonomy_refs(
            skill.taxonomy_refs, catalog, f"skill {skill.skill_id!r}"
        )

        known_terms = {
            normalize_term(skill.canonical_name),
            *(normalize_term(alias) for alias in skill.aliases),
        }
        for context_alias in skill.context_required_aliases:
            if normalize_term(context_alias) not in known_terms:
                raise DataValidationError(
                    f"skill {skill.skill_id!r} context alias {context_alias!r} "
                    "must also be a canonical name or alias"
                )

        terms = (
            (skill.canonical_name,)
            + skill.aliases
            + skill.context_required_aliases
        )
        for term in terms:
            key = normalize_term(term)
            if not key:
                raise DataValidationError(
                    f"skill {skill.skill_id!r} contains an empty normalized alias"
                )
            owner = alias_owners.get(key)
            if owner is not None and owner != skill.skill_id:
                raise DataValidationError(
                    f"normalized alias {key!r} is shared by {owner!r} and "
                    f"{skill.skill_id!r}"
                )
            alias_owners[key] = skill.skill_id


def _validate_taxonomy_refs(
    refs: tuple[Mapping[str, Any], ...],
    catalog: ResumeIntelligenceCatalog,
    label: str,
) -> None:
    for index, ref in enumerate(refs):
        source_id = ref.get("source_id")
        if not isinstance(source_id, str) or not source_id.strip():
            raise DataValidationError(
                f"{label}.taxonomy_refs[{index}].source_id is required"
            )
        if source_id not in catalog.sources:
            raise DataValidationError(
                f"{label} references unknown taxonomy source {source_id!r}"
            )
        record_id = ref.get("source_record_id")
        if record_id is not None and (
            not isinstance(record_id, str) or not record_id.strip()
        ):
            raise DataValidationError(
                f"{label}.taxonomy_refs[{index}].source_record_id is invalid"
            )
        quality = ref.get("mapping_quality")
        if quality is not None and quality not in TAXONOMY_MAPPING_QUALITIES:
            raise DataValidationError(
                f"{label} has invalid taxonomy mapping quality {quality!r}"
            )


def _validate_roles(catalog: ResumeIntelligenceCatalog) -> None:
    alias_owners: dict[str, str] = {}
    for role in catalog.roles.values():
        if role.status not in ROLE_STATUSES:
            raise DataValidationError(
                f"role {role.role_id!r} has invalid status {role.status!r}"
            )
        if role.rubric_status not in ROLE_RUBRIC_STATUSES:
            raise DataValidationError(
                f"role {role.role_id!r} has invalid rubric status"
            )
        if role.entry_level_min_years < 0:
            raise DataValidationError(
                f"role {role.role_id!r} has a negative minimum experience"
            )
        if role.entry_level_min_years > role.entry_level_max_years:
            raise DataValidationError(
                f"role {role.role_id!r} has an inverted experience range"
            )
        for provenance_id in role.provenance_ids:
            if provenance_id not in catalog.provenance:
                raise DataValidationError(
                    f"role {role.role_id!r} references unknown provenance "
                    f"{provenance_id!r}"
                )
        _validate_taxonomy_refs(role.taxonomy_refs, catalog, f"role {role.role_id!r}")

        if role.rubric_status == "not_available":
            if role.rubric_id is not None:
                raise DataValidationError(
                    f"role {role.role_id!r} has a rubric_id but no available rubric"
                )
        else:
            if not role.rubric_id:
                raise DataValidationError(
                    f"role {role.role_id!r} requires a rubric_id"
                )
            rubric = catalog.rubrics.get(role.rubric_id)
            if rubric is None:
                raise DataValidationError(
                    f"role {role.role_id!r} references unknown rubric "
                    f"{role.rubric_id!r}"
                )
            if rubric.role_id != role.role_id:
                raise DataValidationError(
                    f"rubric {rubric.rubric_id!r} belongs to {rubric.role_id!r}, "
                    f"not {role.role_id!r}"
                )

        for term in (role.canonical_title,) + role.aliases:
            key = normalize_term(term)
            if not key:
                raise DataValidationError(
                    f"role {role.role_id!r} contains an empty normalized alias"
                )
            owner = alias_owners.get(key)
            if owner is not None and owner != role.role_id:
                raise DataValidationError(
                    f"normalized role alias {key!r} is shared by {owner!r} and "
                    f"{role.role_id!r}"
                )
            alias_owners[key] = role.role_id


def _validate_rubrics(catalog: ResumeIntelligenceCatalog) -> None:
    for rubric in catalog.rubrics.values():
        label = f"rubric {rubric.rubric_id!r}"
        if rubric.schema_version != CATALOG_SCHEMA_VERSION:
            raise DataValidationError(f"{label} has an unsupported schema version")
        if rubric.status not in RUBRIC_STATUSES:
            raise DataValidationError(f"{label} has invalid status {rubric.status!r}")
        if rubric.confidence not in RUBRIC_CONFIDENCE_LEVELS:
            raise DataValidationError(
                f"{label} has invalid confidence {rubric.confidence!r}"
            )
        if rubric.sample_size < 0:
            raise DataValidationError(f"{label} has a negative sample size")
        if rubric.sample_size == 0 and rubric.confidence != "low":
            raise DataValidationError(
                f"{label} must use low confidence when the sample size is zero"
            )
        if (
            rubric.sample_size == 0 or rubric.confidence == "low"
        ) and not rubric.confidence_reasons:
            raise DataValidationError(
                f"{label} must explain its low or zero-sample confidence"
            )
        if rubric.role_id not in catalog.roles:
            raise DataValidationError(
                f"{label} references unknown role {rubric.role_id!r}"
            )
        for source_id in rubric.source_snapshot_ids:
            if source_id not in catalog.sources:
                raise DataValidationError(
                    f"{label} references unknown source snapshot {source_id!r}"
                )
        if not rubric.requirements:
            raise DataValidationError(f"{label} must contain requirements")

        _validate_dimensions(rubric)
        _validate_requirement_details(rubric, catalog)
        _validate_rubric_validation_block(rubric)
        _validate_rubric_evidence(rubric)

        role = catalog.roles[rubric.role_id]
        if rubric.status == "provisional":
            if role.rubric_status != "seeded_provisional":
                raise DataValidationError(
                    f"{label} is provisional but role {role.role_id!r} does not "
                    "identify it as seeded_provisional"
                )
            if rubric.approved_at is not None:
                raise DataValidationError(
                    f"{label} is provisional but has an approved_at date"
                )
        elif rubric.status == "approved":
            _validate_approved_rubric(rubric, role)
        elif rubric.status == "draft" and rubric.approved_at is not None:
            raise DataValidationError(f"{label} is a draft but has an approved_at date")


def _validate_dimensions(rubric: Rubric) -> None:
    seen_ids: set[str] = set()
    weights: list[float] = []
    for index, dimension in enumerate(rubric.dimensions):
        label = f"rubric {rubric.rubric_id!r}.dimensions[{index}]"
        dimension_id = dimension.get("dimension_id")
        if not isinstance(dimension_id, str) or not dimension_id.strip():
            raise DataValidationError(f"{label}.dimension_id is required")
        if dimension_id in seen_ids:
            raise DataValidationError(
                f"rubric {rubric.rubric_id!r} has duplicate dimension {dimension_id!r}"
            )
        seen_ids.add(dimension_id)
        for key in ("label", "description"):
            if not isinstance(dimension.get(key), str) or not dimension[key].strip():
                raise DataValidationError(f"{label}.{key} must be a non-empty string")
        weight = dimension.get("weight")
        weight_status = dimension.get("weight_status")
        if weight_status not in WEIGHT_STATUSES:
            raise DataValidationError(f"{label} has invalid weight_status")
        if weight is None:
            if weight_status != "pending_manual_validation":
                raise DataValidationError(
                    f"{label} has no weight but does not mark it pending"
                )
        else:
            if type(weight) not in {int, float} or float(weight) <= 0:
                raise DataValidationError(f"{label}.weight must be positive")
            weights.append(float(weight))
            if rubric.status == "approved" and weight_status != "validated":
                raise DataValidationError(
                    f"{label} must have a validated weight in an approved rubric"
                )
    if not seen_ids:
        raise DataValidationError(
            f"rubric {rubric.rubric_id!r} must define scoring dimensions"
        )
    if rubric.status == "approved" and len(weights) == len(rubric.dimensions):
        if abs(sum(weights) - 1.0) > 1e-6:
            raise DataValidationError(
                f"rubric {rubric.rubric_id!r} dimension weights must sum to 1.0"
            )


def _validate_requirement_details(
    rubric: Rubric, catalog: ResumeIntelligenceCatalog
) -> None:
    for requirement in rubric.requirements:
        label = (
            f"rubric {rubric.rubric_id!r} requirement "
            f"{requirement.requirement_id!r}"
        )
        if requirement.match_mode not in REQUIREMENT_MATCH_MODES:
            raise DataValidationError(f"{label} has invalid match_mode")
        if requirement.importance not in REQUIREMENT_IMPORTANCE_LEVELS:
            raise DataValidationError(f"{label} has invalid importance")
        if not requirement.skill_ids:
            raise DataValidationError(f"{label} must reference at least one skill")
        if len(set(requirement.skill_ids)) != len(requirement.skill_ids):
            raise DataValidationError(f"{label} repeats a skill_id")
        for skill_id in requirement.skill_ids:
            if skill_id not in catalog.skills:
                raise DataValidationError(
                    f"{label} references unknown skill {skill_id!r}"
                )
        if requirement.weight_status not in WEIGHT_STATUSES:
            raise DataValidationError(f"{label} has invalid weight_status")
        if requirement.weight is None:
            if requirement.weight_status != "pending_manual_validation":
                raise DataValidationError(
                    f"{label} has no weight but does not mark it pending"
                )
        elif requirement.weight <= 0:
            raise DataValidationError(f"{label} weight must be positive")
        elif (
            rubric.status == "approved"
            and requirement.weight_status != "validated"
        ):
            raise DataValidationError(
                f"{label} must have a validated weight in an approved rubric"
            )
        if not requirement.source_refs:
            raise DataValidationError(f"{label} must retain source references")
        _validate_source_refs(requirement.source_refs, catalog, label)


def _validate_source_refs(
    refs: tuple[Mapping[str, Any], ...],
    catalog: ResumeIntelligenceCatalog,
    label: str,
) -> None:
    for index, ref in enumerate(refs):
        source_id = ref.get("source_id")
        if not isinstance(source_id, str) or not source_id.strip():
            raise DataValidationError(
                f"{label}.source_refs[{index}].source_id is required"
            )
        if source_id not in catalog.sources:
            raise DataValidationError(
                f"{label} references unknown source {source_id!r}"
            )
        record_id = ref.get("source_record_id")
        if record_id is not None and (
            not isinstance(record_id, str) or not record_id.strip()
        ):
            raise DataValidationError(
                f"{label}.source_refs[{index}].source_record_id is invalid"
            )
        note = ref.get("note")
        if note is not None and not isinstance(note, str):
            raise DataValidationError(
                f"{label}.source_refs[{index}].note must be a string or null"
            )


def _validate_rubric_validation_block(rubric: Rubric) -> None:
    label = f"rubric {rubric.rubric_id!r}.validation"
    status = rubric.validation.get("status")
    if status not in VALIDATION_STATUSES:
        raise DataValidationError(f"{label}.status is invalid")
    reviewer_count = rubric.validation.get("reviewer_count")
    if type(reviewer_count) is not int or reviewer_count < 0:
        raise DataValidationError(f"{label}.reviewer_count must be a non-negative int")
    notes = rubric.validation.get("notes")
    if not isinstance(notes, str):
        raise DataValidationError(f"{label}.notes must be a string")


def _validate_rubric_evidence(rubric: Rubric) -> None:
    if not rubric.evidence:
        return
    label = f"rubric {rubric.rubric_id!r}.evidence"
    evidence_tier = rubric.evidence.get("evidence_tier")
    if evidence_tier not in {
        "taxonomy_only",
        "insufficient_market_evidence",
        "threshold_met_pending_review",
        "validated",
    }:
        raise DataValidationError(f"{label}.evidence_tier is invalid")
    eligible_posting_count = rubric.evidence.get("eligible_posting_count")
    if type(eligible_posting_count) is not int or eligible_posting_count < 0:
        raise DataValidationError(
            f"{label}.eligible_posting_count must be a non-negative integer"
        )
    thresholds_met = rubric.evidence.get("thresholds_met")
    if type(thresholds_met) is not bool:
        raise DataValidationError(f"{label}.thresholds_met must be a boolean")
    for key in ("source_distribution", "geographic_coverage", "temporal_coverage"):
        if not isinstance(rubric.evidence.get(key), dict):
            raise DataValidationError(f"{label}.{key} must be an object")
    limitations = rubric.evidence.get("limitations")
    if not isinstance(limitations, list) or not all(
        isinstance(item, str) for item in limitations
    ):
        raise DataValidationError(f"{label}.limitations must be a string array")
    if evidence_tier == "threshold_met_pending_review" and not thresholds_met:
        raise DataValidationError(
            f"{label} cannot meet thresholds while thresholds_met is false"
        )


def _validate_approved_rubric(rubric: Rubric, role: Role) -> None:
    label = f"rubric {rubric.rubric_id!r}"
    if role.rubric_status != "validated":
        raise DataValidationError(
            f"{label} is approved but role {role.role_id!r} is not validated"
        )
    if role.rubric_id != rubric.rubric_id:
        raise DataValidationError(
            f"{label} is approved but is not the role's active rubric"
        )
    if rubric.approved_at is None:
        raise DataValidationError(f"{label} is approved without an approved_at date")
    if rubric.sample_size <= 0:
        raise DataValidationError(
            f"{label} cannot be approved without supporting evidence"
        )
    if rubric.confidence == "low":
        raise DataValidationError(
            f"{label} cannot be approved with low confidence"
        )
    if rubric.validation.get("status") != "approved":
        raise DataValidationError(
            f"{label} requires an approved validation record"
        )
    if rubric.validation.get("reviewer_count", 0) < 1:
        raise DataValidationError(f"{label} requires at least one reviewer")
    for dimension in rubric.dimensions:
        if dimension.get("weight") is None:
            raise DataValidationError(
                f"{label} must assign every dimension weight before approval"
            )
    for requirement in rubric.requirements:
        if requirement.weight is None:
            raise DataValidationError(
                f"{label} must assign every requirement weight before approval"
            )


def _build_skill_alias_index(
    catalog: ResumeIntelligenceCatalog,
) -> dict[str, Skill]:
    index: dict[str, Skill] = {}
    for skill in catalog.skills.values():
        for term in (
            (skill.canonical_name,)
            + skill.aliases
            + skill.context_required_aliases
        ):
            index.setdefault(normalize_term(term), skill)
    return index


def _build_role_alias_index(catalog: ResumeIntelligenceCatalog) -> dict[str, Role]:
    index: dict[str, Role] = {}
    for role in catalog.roles.values():
        for term in (role.canonical_title,) + role.aliases:
            index.setdefault(normalize_term(term), role)
    return index

"""Idempotent CLI for loading validated resume-intelligence data into MongoDB."""

from __future__ import annotations

import argparse
import os
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Sequence

from .catalog import ResumeIntelligenceCatalog, load_catalog


COLLECTIONS = (
    "source_registry",
    "skill_taxonomy",
    "role_taxonomy",
    "role_rubrics",
)


def prepare_documents(
    catalog: ResumeIntelligenceCatalog,
) -> dict[str, list[dict[str, Any]]]:
    """Build deterministic documents from an already validated catalog."""

    sources = [
        _document(
            source,
            schema_version=catalog.schema_version,
            catalog_version=catalog.source_registry_version,
        )
        for source in catalog.sources.values()
    ]
    skills = [
        _document(
            skill,
            schema_version=catalog.schema_version,
            catalog_version=catalog.skills_catalog_version,
        )
        for skill in catalog.skills.values()
    ]
    roles = [
        _document(
            role,
            schema_version=catalog.schema_version,
            catalog_version=catalog.roles_catalog_version,
        )
        for role in catalog.roles.values()
    ]
    rubrics = [
        _document(
            rubric,
            catalog_version=rubric.version,
            is_published=rubric.status in {"provisional", "approved"},
        )
        for rubric in catalog.rubrics.values()
    ]
    return {
        "source_registry": sources,
        "skill_taxonomy": skills,
        "role_taxonomy": roles,
        "role_rubrics": rubrics,
    }


def _document(value: Any, **extra: Any) -> dict[str, Any]:
    if not is_dataclass(value):
        raise TypeError("catalog records must be dataclasses")
    document = asdict(value)
    document.update(extra)
    return _json_ready(document)


def _json_ready(value: Any) -> Any:
    if isinstance(value, dict):
        return {key: _json_ready(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [_json_ready(item) for item in value]
    if isinstance(value, Path):
        return str(value)
    return value


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Validate and import resume-intelligence reference data. "
            "The command is a dry run unless --apply is supplied."
        )
    )
    parser.add_argument("--data-dir", type=Path, default=None)
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write validated records to MongoDB using idempotent upserts.",
    )
    parser.add_argument(
        "--database",
        default=os.environ.get("MONGODB_DB", "interspars"),
        help="MongoDB database name (default: interspars).",
    )
    parser.add_argument(
        "--mongo-url",
        default=None,
        help="MongoDB connection string; defaults to the MONGODB_URL environment variable.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    catalog = load_catalog(args.data_dir)
    documents = prepare_documents(catalog)

    if not args.apply:
        print("Validation passed. Dry run only; no database connection was opened.")
        print(
            "Catalog versions: "
            f"sources={catalog.source_registry_version}, "
            f"skills={catalog.skills_catalog_version}, "
            f"roles={catalog.roles_catalog_version}"
        )
        for collection in COLLECTIONS:
            print(f"{collection}: {len(documents[collection])} records")
        print("Re-run with --apply to import.")
        return 0

    mongo_url = args.mongo_url or os.environ.get("MONGODB_URL")
    if not mongo_url:
        parser.error("MONGODB_URL or --mongo-url is required when using --apply")

    from pymongo import MongoClient
    from pymongo.server_api import ServerApi

    client = MongoClient(
        mongo_url,
        server_api=ServerApi("1"),
        serverSelectionTimeoutMS=10000,
    )
    try:
        client.admin.command("ping")
        database = client[args.database]
        _upsert_collection(database.source_registry, documents["source_registry"], "source_id")
        _upsert_collection(database.skill_taxonomy, documents["skill_taxonomy"], "skill_id")
        _upsert_collection(database.role_taxonomy, documents["role_taxonomy"], "role_id")
        _upsert_collection(database.role_rubrics, documents["role_rubrics"], "rubric_id")
        _ensure_indexes(database)
    finally:
        client.close()

    for collection in COLLECTIONS:
        print(f"Imported {len(documents[collection])} records into {collection}.")
    return 0


def _upsert_collection(collection: Any, documents: list[dict[str, Any]], key: str) -> None:
    for document in documents:
        if key not in document or not document[key]:
            raise ValueError(f"import document is missing {key}")
        collection.update_one({key: document[key]}, {"$set": document}, upsert=True)


def _ensure_indexes(database: Any) -> None:
    database.source_registry.create_index("source_id", unique=True)
    database.skill_taxonomy.create_index("skill_id", unique=True)
    database.skill_taxonomy.create_index("canonical_name")
    database.role_taxonomy.create_index("role_id", unique=True)
    database.role_rubrics.create_index("rubric_id", unique=True)
    database.role_rubrics.create_index([("role_id", 1), ("status", 1)])


if __name__ == "__main__":
    raise SystemExit(main())

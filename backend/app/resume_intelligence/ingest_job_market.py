"""CLI for validating, ingesting, and assessing permitted job-market evidence."""

from __future__ import annotations

import argparse
import os
from datetime import date
from pathlib import Path
from typing import Sequence

from .catalog import load_catalog
from .job_market import TARGET_ROLE_IDS, apply_ingestion, ingest_file
from .rubric_builder import (
    apply_generated_rubrics,
    build_target_rubrics,
    load_thresholds,
    write_rubric_documents,
)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Validate licensed job-posting records and optionally generate "
            "evidence-backed provisional role rubrics. No data is downloaded."
        )
    )
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--dataset-version", required=True)
    parser.add_argument("--data-dir", type=Path, default=None)
    parser.add_argument(
        "--as-of-date",
        type=date.fromisoformat,
        default=None,
        help="Reference date for recency calculations (ISO date).",
    )
    parser.add_argument(
        "--generate-rubrics",
        action="store_true",
        help="Generate provisional evidence rubrics for roles with postings.",
    )
    parser.add_argument(
        "--role",
        action="append",
        choices=TARGET_ROLE_IDS,
        help="Limit rubric generation to a target role; repeat as needed.",
    )
    parser.add_argument(
        "--rubric-output",
        type=Path,
        default=None,
        help="Optional directory for generated rubric JSON files.",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Write normalized records to MongoDB using idempotent upserts.",
    )
    parser.add_argument(
        "--database",
        default=os.environ.get("MONGODB_DB", "interspars"),
        help="MongoDB database name (default: interspars).",
    )
    parser.add_argument(
        "--mongo-url",
        default=None,
        help="MongoDB connection string; defaults to MONGODB_URL.",
    )
    return parser


def main(argv: Sequence[str] | None = None) -> int:
    parser = _build_parser()
    args = parser.parse_args(argv)
    catalog = load_catalog(args.data_dir)
    threshold_document, thresholds = load_thresholds(args.data_dir)
    result = ingest_file(
        args.input,
        catalog,
        dataset_version=args.dataset_version,
        dry_run=not args.apply,
    )

    rubrics = []
    if args.generate_rubrics or args.role or args.rubric_output:
        as_of_date = args.as_of_date
        if as_of_date is None:
            collected = [item.collected_at for item in result.postings]
            as_of_date = max(collected) if collected else date.today()
        rubrics = build_target_rubrics(
            catalog,
            result.postings,
            thresholds,
            dataset_version=result.dataset_version,
            threshold_version=threshold_document.threshold_version,
            as_of_date=as_of_date,
            role_ids=args.role or TARGET_ROLE_IDS,
            confidence_policy=threshold_document.confidence_policy,
        )

    print(
        f"Ingestion {result.run_id}: {result.summary.input_record_count} input, "
        f"{result.summary.unique_record_count} unique accepted, "
        f"{result.summary.duplicate_record_count} duplicate, "
        f"{result.summary.quarantined_record_count} quarantined, "
        f"{result.summary.unknown_skill_count} unknown skill term(s)."
    )
    for rubric in rubrics:
        evidence = rubric.evidence
        print(
            f"Rubric {rubric.rubric_id}: {rubric.sample_size} eligible postings, "
            f"confidence={rubric.confidence}, tier={evidence.evidence_tier}, "
            f"thresholds_met={str(evidence.thresholds_met).lower()}."
        )
        for blocker in evidence.blockers:
            print(f"  blocker: {blocker}")

    if args.rubric_output is not None:
        paths = write_rubric_documents(args.rubric_output, rubrics)
        print(f"Wrote {len(paths)} rubric document(s) to {args.rubric_output}.")

    if not args.apply:
        print("Dry run only; no database connection was opened.")
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
        apply_ingestion(database, result)
        if rubrics:
            apply_generated_rubrics(database, rubrics)
    finally:
        client.close()
    print("Applied normalized postings, review terms, ingestion run, and rubrics.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

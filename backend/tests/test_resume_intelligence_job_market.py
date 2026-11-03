from __future__ import annotations

import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.resume_intelligence.catalog import load_catalog
from app.resume_intelligence.ingest_job_market import main as ingest_main
from app.resume_intelligence.job_market import (
    apply_ingestion,
    ingest_file,
    ingest_records,
    resolve_job_role,
)
from job_market_helpers import (
    DATA_DIR,
    SYNTHETIC_SOURCE_A,
    SYNTHETIC_SOURCE_B,
    catalog_with_synthetic_sources,
    numbered_records,
    synthetic_posting,
)


class FakeCollection:
    def __init__(self) -> None:
        self.documents: dict[tuple[str, object], dict] = {}

    def update_one(self, query: dict, update: dict, upsert: bool = False):
        key, value = next(iter(query.items()))
        identity = (key, value)
        document = self.documents.get(identity)
        if document is None:
            if not upsert:
                return SimpleNamespace(upserted_id=None, modified_count=0)
            document = {}
            self.documents[identity] = document
        for field, field_value in update.get("$set", {}).items():
            document[field] = field_value
        for field, field_value in update.get("$setOnInsert", {}).items():
            document.setdefault(field, field_value)
        for field, value_spec in update.get("$addToSet", {}).items():
            values = value_spec.get("$each", [value_spec])
            existing = document.setdefault(field, [])
            for item in values:
                if item not in existing:
                    existing.append(item)
        return SimpleNamespace(upserted_id=None, modified_count=1)

    def all(self) -> list[dict]:
        return list(self.documents.values())


class FakeDatabase:
    def __init__(self) -> None:
        self.job_postings = FakeCollection()
        self.unknown_job_skills = FakeCollection()
        self.job_market_ingestion_runs = FakeCollection()
        self.role_rubrics = FakeCollection()


class SourceRegistryTests(unittest.TestCase):
    def test_taxonomy_and_posting_sources_are_distinguished(self) -> None:
        catalog = load_catalog(DATA_DIR)
        self.assertEqual(
            catalog.sources["onet-31.0"].content_kind, "occupation_taxonomy"
        )
        self.assertFalse(catalog.sources["onet-31.0"].job_posting_import_allowed)
        self.assertEqual(
            catalog.sources["curated-taxonomy-v1"].content_kind, "curated_taxonomy"
        )
        self.assertEqual(
            catalog.sources["adzuna-india-api"].content_kind, "job_postings"
        )
        self.assertFalse(
            catalog.sources["adzuna-india-api"].job_posting_import_allowed
        )


class JobMarketIngestionTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.root = Path(self.temp_dir.name)
        self.catalog = catalog_with_synthetic_sources(self.root)

    def test_alias_normalization_preserves_required_and_preferred(self) -> None:
        result = ingest_records(
            numbered_records(
                [
                    synthetic_posting(
                        required_skills=["ReactJS", "Postgres"],
                        preferred_skills=["Docker"],
                    )
                ]
            ),
            self.catalog,
            dataset_version="synthetic-2026.10.1",
        )
        self.assertEqual(result.summary.unique_record_count, 1)
        posting = result.postings[0]
        self.assertEqual(posting.required_skill_ids, ["postgresql", "react"])
        self.assertEqual(posting.preferred_skill_ids, ["docker"])
        evidence = {item.skill_id: item for item in posting.skill_evidence}
        self.assertEqual(evidence["react"].matched_term, "ReactJS")
        self.assertEqual(evidence["react"].importance, "required")
        self.assertEqual(evidence["docker"].importance, "preferred")

    def test_unknown_skills_enter_review_queue_without_raw_description(self) -> None:
        result = ingest_records(
            numbered_records(
                [
                    synthetic_posting(
                        required_skills=["ZetaForge"],
                        preferred_skills=[],
                        description="Contact synthetic@example.com for ZetaForge details.",
                    )
                ]
            ),
            self.catalog,
            dataset_version="synthetic-2026.10.1",
        )
        self.assertEqual(len(result.unknown_skills), 1)
        unknown = result.unknown_skills[0]
        self.assertEqual(unknown.normalized_term, "zetaforge")
        self.assertEqual(unknown.posting_record_ids, [result.postings[0].record_id])
        serialized = json.dumps(result.model_dump(mode="json"))
        self.assertNotIn("synthetic@example.com", serialized)
        self.assertNotIn("details", serialized.casefold())

    def test_invalid_schema_and_personal_fields_are_quarantined(self) -> None:
        raw = synthetic_posting(recruiter_email="recruiter@example.com")
        result = ingest_records(
            numbered_records([raw]),
            self.catalog,
            dataset_version="synthetic-2026.10.1",
        )
        self.assertEqual(result.summary.quarantined_record_count, 1)
        self.assertEqual(result.quarantined[0].reason_code, "invalid_schema")
        serialized = json.dumps(result.model_dump(mode="json"))
        self.assertNotIn("recruiter@example.com", serialized)
        self.assertIn("recruiter_email", result.quarantined[0].reason)

    def test_missing_source_provenance_is_quarantined(self) -> None:
        raw = synthetic_posting(source_posting_id=None, source_reference_url=None)
        result = ingest_records(
            numbered_records([raw]),
            self.catalog,
            dataset_version="synthetic-2026.10.1",
        )
        self.assertEqual(result.quarantined[0].reason_code, "invalid_schema")
        self.assertIn("source_posting_id", result.quarantined[0].reason)

    def test_unapproved_or_unlicensed_sources_are_rejected(self) -> None:
        restricted_root = self.root / "restricted"
        restricted_root.mkdir()
        restricted_catalog = catalog_with_synthetic_sources(
            restricted_root,
            source_a_kwargs={"status": "license_required", "import_allowed": False},
        )
        result = ingest_records(
            numbered_records([synthetic_posting()]),
            restricted_catalog,
            dataset_version="synthetic-2026.10.1",
        )
        self.assertEqual(result.postings, [])
        self.assertEqual(result.quarantined[0].reason_code, "source_not_approved")

    def test_source_must_explicitly_allow_job_posting_import(self) -> None:
        restricted_root = self.root / "not-allowed"
        restricted_root.mkdir()
        restricted_catalog = catalog_with_synthetic_sources(
            restricted_root,
            source_a_kwargs={"import_allowed": False},
        )
        result = ingest_records(
            numbered_records([synthetic_posting()]),
            restricted_catalog,
            dataset_version="synthetic-2026.10.1",
        )
        self.assertEqual(
            result.quarantined[0].reason_code,
            "source_not_permitted_for_job_postings",
        )

    def test_source_record_and_content_duplicates_are_marked(self) -> None:
        result = ingest_records(
            numbered_records(
                [
                    synthetic_posting(source_posting_id="DUP-1"),
                    synthetic_posting(source_posting_id="DUP-1"),
                    synthetic_posting(source_posting_id="DUP-2"),
                ]
            ),
            self.catalog,
            dataset_version="synthetic-2026.10.1",
        )
        self.assertEqual(result.summary.unique_record_count, 1)
        self.assertEqual(result.summary.duplicate_record_count, 2)
        kinds = sorted(
            item.duplicate_kind for item in result.postings if item.duplicate_of
        )
        self.assertEqual(kinds, ["content", "source_record"])

    def test_role_mapping_and_entry_level_scope(self) -> None:
        self.assertEqual(
            resolve_job_role(self.catalog, "Associate Software Engineer")[0],
            "software-engineer-sde",
        )
        self.assertEqual(
            resolve_job_role(self.catalog, "Front End Developer")[0],
            "frontend-developer",
        )
        self.assertEqual(
            resolve_job_role(self.catalog, "ML Engineer")[0],
            "machine-learning-engineer",
        )
        role_id, error = resolve_job_role(self.catalog, "Senior Software Engineer")
        self.assertIsNone(role_id)
        self.assertEqual(error[0], "out_of_scope_seniority")
        role_id, error = resolve_job_role(
            self.catalog, "Software Engineer", experience_min_years=5
        )
        self.assertIsNone(role_id)
        self.assertEqual(error[0], "out_of_scope_experience")
        role_id, error = resolve_job_role(self.catalog, "Astronaut")
        self.assertIsNone(role_id)
        self.assertEqual(error[0], "unmapped_role")

    def test_csv_input_and_api_records_share_the_same_contract(self) -> None:
        csv_path = self.root / "synthetic.csv"
        csv_path.write_text(
            "source_id,source_posting_id,title,employer_name,location,"
            "required_skills,preferred_skills,experience_min_years,"
            "experience_max_years,posted_at,collected_at\n"
            "synthetic-india-jobs-a,CSV-1,Data Analyst,Synthetic Employer,"
            '\"Pune, Maharashtra, India\",Python | SQL,Power BI,0,2,2026-09-01,2026-10-01\n',
            encoding="utf-8",
        )
        result = ingest_file(
            csv_path,
            self.catalog,
            dataset_version="synthetic-2026.10.1",
        )
        self.assertEqual(result.postings[0].normalized_role_id, "data-analyst")
        self.assertIn("python", result.postings[0].required_skill_ids)
        self.assertIn("sql", result.postings[0].required_skill_ids)
        self.assertEqual(result.postings[0].location.state, "Maharashtra")

    def test_input_order_does_not_change_run_or_record_ids(self) -> None:
        first = synthetic_posting(source_posting_id="ORDER-1")
        second = synthetic_posting(
            source_posting_id="ORDER-2",
            employer_name="Synthetic Employer 2",
        )
        forward = ingest_records(
            numbered_records([first, second]),
            self.catalog,
            dataset_version="synthetic-2026.10.1",
        )
        reverse = ingest_records(
            numbered_records([second, first]),
            self.catalog,
            dataset_version="synthetic-2026.10.1",
        )
        self.assertEqual(forward.run_id, reverse.run_id)
        self.assertEqual(
            [item.record_id for item in forward.postings],
            [item.record_id for item in reverse.postings],
        )

    def test_apply_is_idempotent(self) -> None:
        result = ingest_records(
            numbered_records(
                [
                    synthetic_posting(
                        source_posting_id="IDEMP-1",
                        required_skills=["Python", "ZetaForge"],
                    )
                ]
            ),
            self.catalog,
            dataset_version="synthetic-2026.10.1",
        )
        database = FakeDatabase()
        apply_ingestion(database, result)
        apply_ingestion(database, result)
        self.assertEqual(len(database.job_postings.all()), 1)
        self.assertEqual(len(database.job_market_ingestion_runs.all()), 1)
        self.assertEqual(len(database.unknown_job_skills.all()), 1)
        unknown = database.unknown_job_skills.all()[0]
        self.assertEqual(unknown["posting_record_ids"], [result.postings[0].record_id])
        self.assertNotIn("description", database.job_postings.all()[0])

    def test_dry_run_cli_does_not_require_mongo(self) -> None:
        input_path = self.root / "synthetic-input.json"
        input_path.write_text(
            json.dumps(
                {
                    "fixture_kind": "synthetic",
                    "records": [synthetic_posting()],
                }
            ),
            encoding="utf-8",
        )
        data_dir = self.root / "resume_intelligence"
        output = io.StringIO()
        with patch.dict(os.environ, {"MONGODB_URL": ""}, clear=False):
            with redirect_stdout(output):
                exit_code = ingest_main(
                    [
                        "--input",
                        str(input_path),
                        "--dataset-version",
                        "synthetic-2026.10.1",
                        "--data-dir",
                        str(data_dir),
                        "--generate-rubrics",
                    ]
                )
        self.assertEqual(exit_code, 0)
        self.assertIn("Dry run only", output.getvalue())
        self.assertIn("Rubric software-engineer-sde@synthetic-2026.10.1", output.getvalue())


if __name__ == "__main__":
    unittest.main()

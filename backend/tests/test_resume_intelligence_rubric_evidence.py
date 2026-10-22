from __future__ import annotations

import json
import sys
import tempfile
import unittest
from datetime import date, timedelta
from pathlib import Path
from types import SimpleNamespace


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))
if str(Path(__file__).resolve().parent) not in sys.path:
    sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.resume_intelligence.catalog import load_catalog
from app.resume_intelligence.job_market import ingest_records
from app.resume_intelligence.rubric_builder import (
    RubricGenerationError,
    apply_generated_rubrics,
    build_role_rubric,
    build_target_rubrics,
    load_thresholds,
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
        self.documents: dict[str, dict] = {}

    def update_one(self, query: dict, update: dict, upsert: bool = False):
        key, value = next(iter(query.items()))
        document = self.documents.get(value)
        if document is None:
            document = {}
            self.documents[value] = document
        document.update(update.get("$set", {}))
        return SimpleNamespace(upserted_id=None, modified_count=1)

    def all(self) -> list[dict]:
        return list(self.documents.values())


class FakeDatabase:
    def __init__(self) -> None:
        self.role_rubrics = FakeCollection()


class SeededEvidenceTests(unittest.TestCase):
    def test_seeded_rubrics_expose_zero_market_evidence(self) -> None:
        catalog = load_catalog(DATA_DIR)
        for role_id in (
            "software-engineer-sde",
            "frontend-developer",
            "backend-developer",
            "data-analyst",
            "machine-learning-engineer",
        ):
            rubric = catalog.rubric_for_role(role_id)
            self.assertIsNotNone(rubric)
            assert rubric is not None
            self.assertEqual(rubric.evidence["evidence_tier"], "taxonomy_only")
            self.assertEqual(rubric.evidence["eligible_posting_count"], 0)
            self.assertFalse(rubric.evidence["thresholds_met"])
            self.assertTrue(rubric.evidence["blockers"])


class RubricEvidenceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.root = Path(self.temp_dir.name)
        self.catalog = catalog_with_synthetic_sources(self.root)
        self.threshold_document, self.thresholds = load_thresholds(
            self.root / "resume_intelligence"
        )
        self.as_of_date = date(2026, 10, 21)

    def _ingest(self, postings: list[dict]):
        return ingest_records(
            numbered_records(postings),
            self.catalog,
            dataset_version="synthetic-2026.10.21.1",
        )

    def _build(self, postings):
        result = self._ingest(postings)
        return build_role_rubric(
            self.catalog,
            "software-engineer-sde",
            result.postings,
            self.thresholds,
            dataset_version=result.dataset_version,
            threshold_version=self.threshold_document.threshold_version,
            as_of_date=self.as_of_date,
            confidence_policy=self.threshold_document.confidence_policy,
        )

    def test_insufficient_evidence_stays_provisional_with_unset_weights(self) -> None:
        rubric = self._build(
            [
                synthetic_posting(
                    source_posting_id="SMALL-1", employer_name="Synthetic Employer 1"
                ),
                synthetic_posting(
                    source_posting_id="SMALL-2", employer_name="Synthetic Employer 2"
                ),
            ]
        )
        self.assertIsNotNone(rubric)
        assert rubric is not None
        self.assertEqual(rubric.status, "provisional")
        self.assertEqual(rubric.validation["status"], "not_reviewed")
        self.assertEqual(rubric.evidence.evidence_tier, "insufficient_market_evidence")
        self.assertFalse(rubric.evidence.thresholds_met)
        self.assertTrue(rubric.evidence.blockers)
        self.assertTrue(all(item.weight is None for item in rubric.requirements))
        self.assertEqual(rubric.sample_size, 2)

    def test_threshold_met_still_requires_manual_review(self) -> None:
        postings: list[dict] = []
        start = date(2026, 1, 1)
        for index in range(100):
            source_id = SYNTHETIC_SOURCE_A if index < 60 else SYNTHETIC_SOURCE_B
            postings.append(
                synthetic_posting(
                    source_id=source_id,
                    source_posting_id=f"THRESHOLD-{index:03d}",
                    employer_name=f"Synthetic Employer {index:03d}",
                    posted_at=(start + timedelta(days=index)).isoformat(),
                )
            )
        rubric = self._build(postings)
        self.assertIsNotNone(rubric)
        assert rubric is not None
        self.assertEqual(rubric.sample_size, 100)
        self.assertEqual(
            rubric.evidence.evidence_tier, "threshold_met_pending_review"
        )
        self.assertTrue(rubric.evidence.thresholds_met)
        self.assertEqual(rubric.validation["status"], "not_reviewed")
        self.assertEqual(rubric.status, "provisional")
        self.assertIsNone(rubric.approved_at)
        self.assertEqual(rubric.evidence.unique_employer_count, 100)
        self.assertEqual(len(rubric.evidence.source_distribution), 2)
        self.assertEqual(rubric.confidence, "high")

    def test_required_and_preferred_remain_distinct(self) -> None:
        rubric = self._build(
            [
                synthetic_posting(
                    source_posting_id="SKILL-1",
                    employer_name="Synthetic Employer 1",
                    required_skills=["Python"],
                    preferred_skills=["Docker"],
                ),
                synthetic_posting(
                    source_posting_id="SKILL-2",
                    employer_name="Synthetic Employer 2",
                    required_skills=["Python", "PostgreSQL"],
                    preferred_skills=["Docker"],
                ),
                synthetic_posting(
                    source_posting_id="SKILL-3",
                    employer_name="Synthetic Employer 3",
                    required_skills=["Python"],
                    preferred_skills=["Docker"],
                ),
            ]
        )
        assert rubric is not None
        requirements = {item.skill_ids[0]: item for item in rubric.requirements}
        self.assertEqual(requirements["python"].importance, "core")
        self.assertEqual(requirements["postgresql"].importance, "core")
        self.assertEqual(requirements["docker"].importance, "preferred")
        self.assertIn("no scoring weight is inferred", requirements["python"].rationale)

    def test_rubric_is_deterministic_and_versioned(self) -> None:
        postings = [
            synthetic_posting(
                source_posting_id="VERSION-1", employer_name="Synthetic Employer 1"
            ),
            synthetic_posting(
                source_posting_id="VERSION-2", employer_name="Synthetic Employer 2"
            ),
        ]
        first = self._build(postings)
        second = self._build(postings)
        assert first is not None and second is not None
        self.assertEqual(first.model_dump(mode="json"), second.model_dump(mode="json"))
        self.assertEqual(first.rubric_id, "software-engineer-sde@synthetic-2026.10.21.1")
        self.assertEqual(first.version, "synthetic-2026.10.21.1")

    def test_no_postings_does_not_create_a_market_rubric(self) -> None:
        result = self._ingest([])
        rubric = build_role_rubric(
            self.catalog,
            "software-engineer-sde",
            result.postings,
            self.thresholds,
            dataset_version=result.dataset_version,
            threshold_version=self.threshold_document.threshold_version,
            as_of_date=self.as_of_date,
            confidence_policy=self.threshold_document.confidence_policy,
        )
        self.assertIsNone(rubric)

    def test_dataset_version_cannot_overwrite_a_seeded_rubric(self) -> None:
        result = self._ingest(
            [
                synthetic_posting(
                    source_posting_id="COLLISION-1",
                    employer_name="Synthetic Employer 1",
                )
            ]
        )
        with self.assertRaises(RubricGenerationError):
            build_role_rubric(
                self.catalog,
                "software-engineer-sde",
                result.postings,
                self.thresholds,
                dataset_version="2026.10.1",
                threshold_version=self.threshold_document.threshold_version,
                as_of_date=self.as_of_date,
                confidence_policy=self.threshold_document.confidence_policy,
            )

    def test_generated_rubrics_are_serializable_and_not_published(self) -> None:
        result = self._ingest(
            [
                synthetic_posting(
                    source_posting_id="SERIAL-1", employer_name="Synthetic Employer 1"
                )
            ]
        )
        rubrics = build_target_rubrics(
            self.catalog,
            result.postings,
            self.thresholds,
            dataset_version=result.dataset_version,
            threshold_version=self.threshold_document.threshold_version,
            as_of_date=self.as_of_date,
            confidence_policy=self.threshold_document.confidence_policy,
        )
        self.assertEqual(len(rubrics), 1)
        json.dumps([item.model_dump(mode="json") for item in rubrics])
        database = FakeDatabase()
        apply_generated_rubrics(database, rubrics)
        stored = database.role_rubrics.all()[0]
        self.assertFalse(stored["is_published"])
        self.assertEqual(stored["validation_status"], "not_reviewed")
        self.assertEqual(stored["evidence"]["eligible_posting_count"], 1)


if __name__ == "__main__":
    unittest.main()

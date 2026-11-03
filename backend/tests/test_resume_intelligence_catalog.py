from __future__ import annotations

import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.resume_intelligence.catalog import DataValidationError, load_catalog


DATA_DIR = BACKEND_DIR / "data" / "resume_intelligence"


class CatalogDataTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalog = load_catalog(DATA_DIR)

    def test_expected_catalog_counts(self) -> None:
        self.assertEqual(len(self.catalog.sources), 9)
        self.assertEqual(len(self.catalog.roles), 35)
        self.assertEqual(len(self.catalog.rubrics), 5)
        self.assertGreaterEqual(len(self.catalog.skills), 120)

    def test_catalog_versions_are_present(self) -> None:
        self.assertEqual(self.catalog.schema_version, "1.0.0")
        self.assertTrue(self.catalog.source_registry_version)
        self.assertTrue(self.catalog.skills_catalog_version)
        self.assertTrue(self.catalog.roles_catalog_version)

    def test_seeded_rubrics_are_explicitly_provisional(self) -> None:
        seeded_roles = [
            role for role in self.catalog.roles.values()
            if role.rubric_status == "seeded_provisional"
        ]
        self.assertEqual(len(seeded_roles), 5)
        for role in seeded_roles:
            rubric = self.catalog.rubric_for_role(role.role_id)
            self.assertIsNotNone(rubric)
            assert rubric is not None
            self.assertEqual(rubric.status, "provisional")
            self.assertEqual(rubric.sample_size, 0)
            self.assertEqual(rubric.confidence, "low")
            self.assertTrue(rubric.confidence_reasons)
            self.assertTrue(
                all(item.weight is None for item in rubric.requirements)
            )

    def test_roles_without_rubrics_remain_available(self) -> None:
        role = self.catalog.roles["full-stack-developer"]
        self.assertEqual(role.rubric_status, "not_available")
        self.assertIsNone(role.rubric_id)
        self.assertIsNone(self.catalog.published_rubric_for_role(role.role_id))

    def test_aliases_resolve_to_canonical_records(self) -> None:
        self.assertEqual(self.catalog.resolve_skill("ReactJS").skill_id, "react")
        self.assertEqual(self.catalog.resolve_skill("Postgres").skill_id, "postgresql")
        self.assertEqual(
            self.catalog.resolve_role("SDE").role_id, "software-engineer-sde"
        )
        self.assertEqual(
            self.catalog.resolve_role("ML Engineer").role_id,
            "machine-learning-engineer",
        )

    def test_requirement_skill_references_exist(self) -> None:
        for rubric in self.catalog.rubrics.values():
            for requirement in rubric.requirements:
                for skill_id in requirement.skill_ids:
                    self.assertIn(skill_id, self.catalog.skills)


class CatalogValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp_dir.cleanup)
        self.data_dir = Path(self.temp_dir.name) / "resume_intelligence"
        shutil.copytree(DATA_DIR, self.data_dir)

    def _load(self) -> None:
        load_catalog(self.data_dir)

    def _mutate_json(self, relative_path: str, mutate) -> None:
        path = self.data_dir / relative_path
        document = json.loads(path.read_text(encoding="utf-8"))
        mutate(document)
        path.write_text(json.dumps(document), encoding="utf-8")

    def test_invalid_source_status_is_rejected(self) -> None:
        self._mutate_json(
            "sources.v1.json",
            lambda data: data["sources"][0].update(status="free_for_all"),
        )
        with self.assertRaises(DataValidationError):
            self._load()

    def test_approved_source_requires_verified_license(self) -> None:
        def mutate(data) -> None:
            data["sources"][0]["license"]["redistribution"] = "unverified"

        self._mutate_json("sources.v1.json", mutate)
        with self.assertRaises(DataValidationError):
            self._load()

    def test_cross_skill_alias_collision_is_rejected(self) -> None:
        def mutate(data) -> None:
            react = next(item for item in data["skills"] if item["skill_id"] == "react")
            react["aliases"].append("JavaScript")

        self._mutate_json("skills.v1.json", mutate)
        with self.assertRaises(DataValidationError):
            self._load()

    def test_unknown_requirement_skill_is_rejected(self) -> None:
        def mutate(data) -> None:
            data["requirements"][0]["skill_ids"] = ["not-a-real-skill"]

        self._mutate_json("rubrics/software-engineer-sde.v1.json", mutate)
        with self.assertRaises(DataValidationError):
            self._load()

    def test_zero_sample_cannot_claim_medium_confidence(self) -> None:
        def mutate(data) -> None:
            data["confidence"] = "medium"

        self._mutate_json("rubrics/frontend-developer.v1.json", mutate)
        with self.assertRaises(DataValidationError):
            self._load()

    def test_low_confidence_requires_reasons(self) -> None:
        def mutate(data) -> None:
            data["confidence_reasons"] = []

        self._mutate_json("rubrics/data-analyst.v1.json", mutate)
        with self.assertRaises(DataValidationError):
            self._load()

    def test_approved_rubric_without_weights_is_rejected(self) -> None:
        def mutate(data) -> None:
            data["status"] = "approved"
            data["approved_at"] = "2026-10-21"
            data["sample_size"] = 10
            data["confidence"] = "high"
            data["validation"] = {
                "status": "approved",
                "reviewer_count": 2,
                "notes": "Reviewed for contract validation testing.",
            }

        self._mutate_json("rubrics/machine-learning-engineer.v1.json", mutate)
        with self.assertRaises(DataValidationError):
            self._load()

    def test_unknown_taxonomy_source_is_rejected(self) -> None:
        def mutate(data) -> None:
            data["roles"][0]["taxonomy_refs"][0]["source_id"] = "missing-source"

        self._mutate_json("roles.v1.json", mutate)
        with self.assertRaises(DataValidationError):
            self._load()

    def test_unsupported_schema_version_is_rejected(self) -> None:
        def mutate(data) -> None:
            data["schema_version"] = "2.0.0"

        self._mutate_json("skills.v1.json", mutate)
        with self.assertRaises(DataValidationError):
            self._load()

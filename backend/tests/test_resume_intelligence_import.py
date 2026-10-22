from __future__ import annotations

import io
import json
import os
import sys
import unittest
from contextlib import redirect_stderr, redirect_stdout
from pathlib import Path
from unittest.mock import patch


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.resume_intelligence.catalog import load_catalog
from app.resume_intelligence.import_catalog import main, prepare_documents


DATA_DIR = BACKEND_DIR / "data" / "resume_intelligence"


class ImportDocumentTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalog = load_catalog(DATA_DIR)
        cls.documents = prepare_documents(cls.catalog)

    def test_documents_match_catalog_counts(self) -> None:
        self.assertEqual(len(self.documents["source_registry"]), 9)
        self.assertEqual(len(self.documents["skill_taxonomy"]), 132)
        self.assertEqual(len(self.documents["role_taxonomy"]), 35)
        self.assertEqual(len(self.documents["role_rubrics"]), 5)

    def test_documents_are_json_serializable(self) -> None:
        encoded = json.dumps(self.documents)
        self.assertGreater(len(encoded), 1000)

    def test_documents_include_versions_and_natural_keys(self) -> None:
        for document in self.documents["source_registry"]:
            self.assertEqual(document["schema_version"], "1.0.0")
            self.assertTrue(document["catalog_version"])
            self.assertTrue(document["source_id"])
        for document in self.documents["skill_taxonomy"]:
            self.assertTrue(document["skill_id"])
            self.assertTrue(document["catalog_version"])
        for document in self.documents["role_rubrics"]:
            self.assertTrue(document["rubric_id"])
            self.assertTrue(document["is_published"])

    def test_import_document_keys_are_unique(self) -> None:
        keys = {
            "source_registry": "source_id",
            "skill_taxonomy": "skill_id",
            "role_taxonomy": "role_id",
            "role_rubrics": "rubric_id",
        }
        for collection, key in keys.items():
            values = [document[key] for document in self.documents[collection]]
            self.assertEqual(len(values), len(set(values)))

    def test_dry_run_does_not_require_mongo_configuration(self) -> None:
        output = io.StringIO()
        with patch.dict(os.environ, {"MONGODB_URL": ""}, clear=False):
            with redirect_stdout(output):
                exit_code = main(["--data-dir", str(DATA_DIR)])
        self.assertEqual(exit_code, 0)
        self.assertIn("Dry run only", output.getvalue())
        self.assertIn("role_rubrics: 5 records", output.getvalue())

    def test_apply_without_mongo_url_fails_before_connecting(self) -> None:
        with patch.dict(os.environ, {"MONGODB_URL": ""}, clear=False):
            with redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as raised:
                    main(["--data-dir", str(DATA_DIR), "--apply"])
        self.assertEqual(raised.exception.code, 2)


if __name__ == "__main__":
    unittest.main()

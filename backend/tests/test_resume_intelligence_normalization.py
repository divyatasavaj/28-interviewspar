from __future__ import annotations

import sys
import unittest
from dataclasses import replace
from pathlib import Path


BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.resume_intelligence.catalog import load_catalog
from app.resume_intelligence.normalization import SkillNormalizer, normalize_term


DATA_DIR = BACKEND_DIR / "data" / "resume_intelligence"


class NormalizationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalog = load_catalog(DATA_DIR)
        cls.normalizer = SkillNormalizer(cls.catalog.skills.values())

    def _matches(self, text: str) -> list:
        return list(self.normalizer.normalize(text))

    def _skill_ids(self, text: str) -> set[str]:
        return {match.skill_id for match in self._matches(text)}

    def test_normalize_term_handles_case_width_and_whitespace(self) -> None:
        self.assertEqual(normalize_term("  ＲＥＡＣＴ\t JS  "), "react js")
        self.assertEqual(normalize_term("Node\u00a0JS"), "node js")

    def test_canonical_aliases_and_spans_are_reported(self) -> None:
        text = "  ReactJS and Node"
        matches = self._matches(text)
        by_skill = {match.skill_id: match for match in matches}
        self.assertEqual(by_skill["react"].matched_alias, "ReactJS")
        self.assertEqual(text[by_skill["react"].start:by_skill["react"].end], "ReactJS")
        self.assertEqual(by_skill["react"].confidence, 0.95)
        self.assertEqual(by_skill["nodejs"].matched_alias, "Node")

    def test_canonical_name_has_highest_confidence(self) -> None:
        match = self._matches("JavaScript")[0]
        self.assertEqual(match.method, "canonical")
        self.assertEqual(match.confidence, 1.0)

    def test_longest_alias_wins_and_occurrences_do_not_overlap(self) -> None:
        matches = self._matches("React Native and React; Node.js")
        ids = [match.skill_id for match in matches]
        self.assertEqual(ids, ["react-native", "react", "nodejs"])
        react_native = matches[0]
        self.assertEqual(react_native.matched_alias, "React Native")

    def test_similar_technologies_are_not_merged(self) -> None:
        ids = self._skill_ids(
            "Java, JavaScript, SQL, NoSQL, C, C++, React, React Native"
        )
        self.assertTrue(
            {"java", "javascript", "sql", "nosql", "c", "c-plus-plus", "react", "react-native"}
            <= ids
        )

    def test_sql_does_not_match_inside_postgresql(self) -> None:
        ids = self._skill_ids("PostgreSQL")
        self.assertEqual(ids, {"postgresql"})

    def test_context_sensitive_aliases_match_only_with_evidence(self) -> None:
        self.assertNotIn("go", self._skill_ids("I go to the store before lunch."))
        self.assertNotIn("c", self._skill_ids("Section C contains the appendix."))
        self.assertNotIn("r", self._skill_ids("R&D project planning"))

    def test_programming_context_disambiguates_short_language_names(self) -> None:
        ids = self._skill_ids("Programming languages: C, R, Go and Python")
        self.assertTrue({"c", "r", "go", "python"} <= ids)
        short_matches = [m for m in self._matches("Programming languages: C, R, Go") if m.skill_id in {"c", "r", "go"}]
        self.assertTrue(all(method.method == "context_alias" for method in short_matches))
        self.assertTrue(all(method.context_validated for method in short_matches))

    def test_os_alias_requires_system_context(self) -> None:
        self.assertNotIn("operating-systems", self._skill_ids("OS"))
        self.assertIn("operating-systems", self._skill_ids("Linux OS administration"))

    def test_c_plus_plus_does_not_match_c(self) -> None:
        ids = self._skill_ids("C++ developer")
        self.assertIn("c-plus-plus", ids)
        self.assertNotIn("c", ids)

    def test_every_occurrence_is_returned(self) -> None:
        matches = self._matches("Python and Python")
        self.assertEqual([match.start for match in matches], [0, 11])

    def test_duplicate_cross_skill_alias_is_rejected(self) -> None:
        existing = self.catalog.skills["react"]
        conflicting = replace(
            existing,
            skill_id="fake-react",
            canonical_name="Fake React",
            aliases=("React",),
            context_required_aliases=(),
        )
        with self.assertRaises(ValueError):
            SkillNormalizer([existing, conflicting])


if __name__ == "__main__":
    unittest.main()

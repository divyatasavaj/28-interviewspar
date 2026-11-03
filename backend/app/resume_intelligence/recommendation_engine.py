"""Deterministic recommendations grounded in assessment findings."""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass

from .assessment_schemas import (
    EvidenceClassification,
    EvidenceReference,
    MatchStatus,
    PriorityBand,
    Recommendation,
    RecommendationGroup,
    RequirementAssessment,
    RequirementType,
)
from .schemas import ResumeAnalysis


_GROUP_ORDER = {
    RecommendationGroup.SKILL_DEVELOPMENT: 0,
    RecommendationGroup.EVIDENCE_IMPROVEMENT: 1,
    RecommendationGroup.RESUME_IMPROVEMENT: 2,
}


@dataclass(frozen=True)
class _Candidate:
    group: RecommendationGroup
    base: int
    title: str
    action: str
    why_it_matters: str
    related_skill_ids: tuple[str, ...] = ()
    related_requirement_ids: tuple[str, ...] = ()
    evidence: EvidenceReference | None = None
    learning_activity: str | None = None


def build_recommendations(
    analysis: ResumeAnalysis,
    findings: list[RequirementAssessment],
    *,
    assessment_id: str,
    context_kind: str,
    context_name: str,
) -> list[Recommendation]:
    """Create ranked recommendations without inventing resume facts."""

    candidates: list[_Candidate] = []
    for finding in findings:
        candidate = _candidate_for_finding(finding, context_kind, context_name)
        if candidate is not None:
            candidates.append(candidate)

    candidates.extend(_resume_structure_candidates(analysis))
    candidates.sort(
        key=lambda item: (
            -item.base,
            _GROUP_ORDER[item.group],
            item.title.casefold(),
            item.related_skill_ids,
        )
    )

    recommendations: list[Recommendation] = []
    for index, candidate in enumerate(candidates, start=1):
        digest = hashlib.sha256(
            "|".join(
                (
                    assessment_id,
                    candidate.group.value,
                    candidate.title,
                    ",".join(candidate.related_skill_ids),
                )
            ).encode("utf-8")
        ).hexdigest()[:16]
        recommendations.append(
            Recommendation(
                recommendation_id=f"rec_{digest}",
                group=candidate.group,
                priority=index,
                priority_band=_priority_band(candidate.base),
                title=candidate.title,
                action=candidate.action,
                why_it_matters=candidate.why_it_matters,
                related_skill_ids=list(candidate.related_skill_ids),
                related_requirement_ids=list(candidate.related_requirement_ids),
                evidence=candidate.evidence,
                learning_activity=candidate.learning_activity,
            )
        )
    return recommendations


def _candidate_for_finding(
    finding: RequirementAssessment,
    context_kind: str,
    context_name: str,
) -> _Candidate | None:
    if finding.match_status is MatchStatus.NOT_EVALUATED:
        return None

    required = finding.requirement_type is RequirementType.REQUIRED
    preferred = finding.requirement_type is RequirementType.PREFERRED
    related_skills = tuple(finding.matched_skill_ids or finding.skill_ids)
    related_requirements = (finding.requirement_id,)
    why = _why_it_matters(finding, context_kind, context_name)

    if finding.match_status is MatchStatus.NOT_EVIDENCED:
        base = 100 if required else 60 if preferred else 30
        return _Candidate(
            group=RecommendationGroup.SKILL_DEVELOPMENT,
            base=base,
            title=f"Develop {finding.display_name}",
            action=(
                f"Plan a focused learning exercise for {finding.display_name}, then build a "
                "small original example that lets you explain the concept and your decisions."
            ),
            why_it_matters=why,
            related_skill_ids=related_skills,
            related_requirement_ids=related_requirements,
            learning_activity=(
                f"Complete a small, verifiable {finding.display_name} exercise. Add it to your "
                "resume only after the work exists and you can explain it."
            ),
        )

    if finding.match_status is MatchStatus.MENTIONED_ONLY:
        base = 90 if required else 55 if preferred else 25
        return _Candidate(
            group=RecommendationGroup.EVIDENCE_IMPROVEMENT,
            base=base,
            title=f"Show practical use of {finding.display_name}",
            action=(
                f"If you have used {finding.display_name}, add a real project or work bullet "
                "stating what you built, what you personally did, and a verified result. "
                "Otherwise keep it listed without implying proficiency."
            ),
            why_it_matters=why,
            related_skill_ids=related_skills,
            related_requirement_ids=related_requirements,
            evidence=finding.evidence,
        )

    if finding.match_status is MatchStatus.WEAK_EVIDENCE:
        base = 80 if required else 50 if preferred else 20
        return _Candidate(
            group=RecommendationGroup.EVIDENCE_IMPROVEMENT,
            base=base,
            title=f"Strengthen evidence for {finding.display_name}",
            action=(
                f"Add context showing where and how you used {finding.display_name}. Prefer a "
                "specific project or work example over another skills-list mention."
            ),
            why_it_matters=why,
            related_skill_ids=related_skills,
            related_requirement_ids=related_requirements,
            evidence=finding.evidence,
        )

    if (
        finding.match_status is MatchStatus.DEMONSTRATED
        and finding.evidence is not None
        and finding.evidence.classification is EvidenceClassification.DEMONSTRATED_USE
    ):
        base = 40 if required else 25 if preferred else 15
        return _Candidate(
            group=RecommendationGroup.EVIDENCE_IMPROVEMENT,
            base=base,
            title=f"Add a verified outcome for {finding.display_name}",
            action=(
                "If the project or work example produced a verifiable result, add that result "
                "to the same bullet. If not, describe the scope and your contribution without "
                "inventing a metric."
            ),
            why_it_matters=(
                "The resume demonstrates practical use but does not yet connect it to a concrete outcome."
            ),
            related_skill_ids=related_skills,
            related_requirement_ids=related_requirements,
            evidence=finding.evidence,
        )
    return None


def _resume_structure_candidates(analysis: ResumeAnalysis) -> list[_Candidate]:
    candidates: list[_Candidate] = []
    if not analysis.projects and not analysis.work_experience:
        candidates.append(
            _Candidate(
                group=RecommendationGroup.RESUME_IMPROVEMENT,
                base=35,
                title="Make relevant project or work evidence easier to find",
                action=(
                    "If you have completed academic, internship, or personal work relevant to "
                    "this target, add it as a project or experience entry with your specific "
                    "contribution and a verified result."
                ),
                why_it_matters=(
                    "No project or work-experience entries are currently evidenced in the parsed resume."
                ),
            )
        )
    elif any(
        project.description and not re.search(r"\d", project.description)
        for project in analysis.projects
    ):
        candidates.append(
            _Candidate(
                group=RecommendationGroup.RESUME_IMPROVEMENT,
                base=10,
                title="Review project outcomes for verifiable details",
                action=(
                    "Where you can verify a result, add the before/after metric or concrete "
                    "scope to the relevant project. If no metric exists, describe your specific "
                    "contribution rather than inventing a number."
                ),
                why_it_matters=(
                    "At least one parsed project description does not contain a measurable outcome."
                ),
            )
        )
    return candidates


def _why_it_matters(
    finding: RequirementAssessment,
    context_kind: str,
    context_name: str,
) -> str:
    if context_kind == "role":
        importance = finding.importance or finding.requirement_type.value
        return f"The {context_name} rubric classifies this skill as {importance}."
    if finding.requirement_type is RequirementType.REQUIRED:
        return "The job description explicitly marks this skill as required."
    if finding.requirement_type is RequirementType.PREFERRED:
        return "The job description identifies this skill as preferred rather than mandatory."
    return "The job description mentions this skill without an explicit priority."


def _priority_band(base: int) -> PriorityBand:
    if base >= 80:
        return PriorityBand.HIGH
    if base >= 40:
        return PriorityBand.MEDIUM
    return PriorityBand.LOW


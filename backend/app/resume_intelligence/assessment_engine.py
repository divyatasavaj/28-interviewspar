"""Pure deterministic resume-matching and gap-assessment functions."""

from __future__ import annotations

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone

from .assessment_errors import AssessmentError
from .assessment_schemas import (
    ASSESSMENT_SCORING_POLICY_VERSION,
    ASSESSMENT_SCHEMA_VERSION,
    AssessmentMode,
    AssessmentStatus,
    EvidenceClassification,
    EvidenceReference,
    EvidenceSummary,
    JobDescriptionReference,
    MatchStatus,
    RequirementAssessment,
    RequirementType,
    ResumeAssessment,
    ScoreComponent,
    ScoreMethod,
    ScoreStatus,
    UnknownRequirement,
)
from .catalog import ResumeIntelligenceCatalog, Role, Rubric, RubricRequirement
from .job_description import extract_job_description_requirements
from .recommendation_engine import build_recommendations
from .schemas import ResumeAnalysis, SkillEvidence


EVIDENCE_FACTORS: dict[EvidenceClassification, float] = {
    EvidenceClassification.LISTED: 0.35,
    EvidenceClassification.CONTEXTUAL_MENTION: 0.20,
    EvidenceClassification.DEMONSTRATED_USE: 0.65,
    EvidenceClassification.DEMONSTRATED_OUTCOME: 1.00,
}
JOB_DESCRIPTION_WEIGHTS: dict[RequirementType, float] = {
    RequirementType.REQUIRED: 3.0,
    RequirementType.PREFERRED: 1.0,
    RequirementType.UNSPECIFIED: 0.5,
}
MIN_JD_SCORABLE_REQUIREMENTS = 2
MIN_USABLE_EVIDENCE_CONFIDENCE = 0.50
_ROLE_IMPORTANCE_MAP = {
    "core": RequirementType.REQUIRED,
    "important": RequirementType.REQUIRED,
    "preferred": RequirementType.PREFERRED,
    "optional": RequirementType.UNSPECIFIED,
}


@dataclass(frozen=True)
class _RequirementSpec:
    requirement_id: str
    skill_ids: tuple[str, ...]
    match_mode: str
    requirement_type: RequirementType
    importance: str | None
    weight: float | None
    rationale: str
    source_span: tuple[int, int] | None = None


@dataclass(frozen=True)
class _Evaluation:
    finding: RequirementAssessment
    component: ScoreComponent
    factor: float


def make_assessment_id(
    *,
    user_id: str,
    resume_id: str,
    resume_sha256: str,
    assessment_mode: AssessmentMode,
    catalog_version: str,
    target_role_id: str | None = None,
    rubric_version: str | None = None,
    job_description_sha256: str | None = None,
) -> str:
    """Create an idempotency key from assessment content, not request time."""

    identity = "|".join(
        (
            user_id,
            resume_id,
            resume_sha256,
            (
                assessment_mode.value
                if isinstance(assessment_mode, AssessmentMode)
                else assessment_mode
            ),
            target_role_id or "",
            rubric_version or "",
            job_description_sha256 or "",
            catalog_version,
            ASSESSMENT_SCHEMA_VERSION,
            ASSESSMENT_SCORING_POLICY_VERSION,
        )
    )
    return "ra_" + hashlib.sha256(identity.encode("utf-8")).hexdigest()[:24]


def assess_role(
    analysis: ResumeAnalysis,
    role: Role,
    rubric: Rubric,
    catalog: ResumeIntelligenceCatalog,
    *,
    resume_id: str,
    assessment_id: str,
    created_at: str | None = None,
) -> ResumeAssessment:
    """Assess a resume against a role rubric without inventing missing weights."""

    if rubric.role_id != role.role_id:
        raise AssessmentError(
            "The selected role and rubric are inconsistent.",
            500,
            "rubric_role_mismatch",
        )

    specs = tuple(_role_spec(requirement) for requirement in rubric.requirements)
    weighted_inputs_ready = (
        rubric.status == "approved"
        and bool(specs)
        and all(
            spec.weight is not None
            and spec.weight > 0
            and rubric.requirements[index].weight_status == "validated"
            for index, spec in enumerate(specs)
        )
    )
    evaluations = _evaluate_specs(
        analysis, specs, catalog, compute_weighted_values=weighted_inputs_ready
    )
    unevaluated_count = sum(
        1
        for evaluation in evaluations
        if evaluation.finding.match_status is MatchStatus.NOT_EVALUATED
    )
    score_available = weighted_inputs_ready and unevaluated_count == 0
    if not score_available:
        evaluations = _evaluate_specs(
            analysis, specs, catalog, compute_weighted_values=False
        )
    score = _calculate_score(evaluations, score_available)
    matched, gaps, not_evaluated = _partition_findings(evaluations)
    assessment_status = (
        AssessmentStatus.EVIDENCE_BACKED
        if score_available
        else AssessmentStatus.PRELIMINARY
    )
    score_method = (
        ScoreMethod.WEIGHTED_ROLE_RUBRIC if score_available else ScoreMethod.UNAVAILABLE
    )
    limitations = _role_limitations(role, rubric, score_available, analysis)
    recommendations = build_recommendations(
        analysis,
        [evaluation.finding for evaluation in evaluations],
        assessment_id=assessment_id,
        context_kind="role",
        context_name=role.canonical_title,
    )
    return ResumeAssessment(
        assessment_id=assessment_id,
        assessment_mode=AssessmentMode.ROLE,
        target_role_id=role.role_id,
        target_role_title=role.canonical_title,
        resume_id=resume_id,
        resume_sha256=analysis.file.sha256,
        assessment_status=assessment_status,
        score=score,
        score_status=(
            ScoreStatus.AVAILABLE if score is not None else ScoreStatus.UNAVAILABLE
        ),
        score_method=score_method,
        score_explanation=_role_score_explanation(
            rubric,
            score_available,
            score,
            len(specs),
            unevaluated_count,
        ),
        matched_requirements=matched,
        skill_gaps=gaps,
        not_evaluated_requirements=not_evaluated,
        score_components=[evaluation.component for evaluation in evaluations],
        evidence_summary=_evidence_summary(analysis, matched, gaps, not_evaluated, 0),
        recommendations=recommendations,
        rubric_id=rubric.rubric_id,
        rubric_version=rubric.version,
        catalog_version=catalog.skills_catalog_version,
        limitations=limitations,
        created_at=created_at or datetime.now(timezone.utc).isoformat(),
    )


def assess_job_description(
    analysis: ResumeAnalysis,
    job_description: str,
    catalog: ResumeIntelligenceCatalog,
    *,
    resume_id: str,
    assessment_id: str,
    created_at: str | None = None,
) -> ResumeAssessment:
    """Assess textual coverage of a user-provided job description."""

    extraction = extract_job_description_requirements(job_description, catalog)
    specs = tuple(
        _RequirementSpec(
            requirement_id=f"jd-{requirement.skill_id}",
            skill_ids=(requirement.skill_id,),
            match_mode="any",
            requirement_type=requirement.requirement_type,
            importance=None,
            weight=JOB_DESCRIPTION_WEIGHTS[requirement.requirement_type],
            rationale=f"Skill was explicitly detected in the submitted job description as {requirement.requirement_type.value}.",
            source_span=(requirement.start, requirement.end),
        )
        for requirement in extraction.requirements
    )
    score_ready = len(specs) >= MIN_JD_SCORABLE_REQUIREMENTS
    evaluations = _evaluate_specs(
        analysis, specs, catalog, compute_weighted_values=score_ready
    )
    unevaluated_count = sum(
        1
        for evaluation in evaluations
        if evaluation.finding.match_status is MatchStatus.NOT_EVALUATED
    )
    score_available = score_ready and unevaluated_count == 0
    if not score_available:
        evaluations = _evaluate_specs(
            analysis, specs, catalog, compute_weighted_values=False
        )
    score = _calculate_score(evaluations, score_available)
    matched, gaps, not_evaluated = _partition_findings(evaluations)
    unknown = [
        UnknownRequirement(
            source_term=item.source_term,
            requirement_type=item.requirement_type,
            span={"start": item.start, "end": item.end},
            reason=(
                "The term appears in a requirement-like clause but is not in the canonical skill catalog. "
                "It was excluded from scoring pending taxonomy review."
            ),
        )
        for item in extraction.unknown_requirements
    ]
    recommendations = build_recommendations(
        analysis,
        [evaluation.finding for evaluation in evaluations],
        assessment_id=assessment_id,
        context_kind="job_description",
        context_name="the submitted job description",
    )
    limitations = [
        "This score measures textual requirement coverage against the submitted job description; it is not an ATS score or a probability of interview or hiring.",
        "Product-defined heuristic weights are used: required=3.0, preferred=1.0, unspecified=0.5. They are not empirical market weights.",
        "Unknown terms are excluded from the score and listed for taxonomy review rather than classified as missing skills.",
        "The job description is treated as untrusted data; instruction-like text cannot change scoring rules.",
        "Only a SHA-256 reference and character count are retained; the raw job description is not stored.",
        "Absence from the resume means 'not evidenced in this resume', not proof that the candidate lacks the skill.",
    ]
    if extraction.instruction_like_text_detected:
        limitations.append(
            "The submitted text contained instruction-like wording; it was ignored because job descriptions are data, not commands."
        )
    return ResumeAssessment(
        assessment_id=assessment_id,
        assessment_mode=AssessmentMode.JOB_DESCRIPTION,
        resume_id=resume_id,
        resume_sha256=analysis.file.sha256,
        job_description_reference=JobDescriptionReference(
            sha256=extraction.text_sha256,
            character_count=extraction.character_count,
        ),
        assessment_status=(
            AssessmentStatus.HEURISTIC
            if score_available
            else AssessmentStatus.PRELIMINARY
        ),
        score=score,
        score_status=(
            ScoreStatus.AVAILABLE if score is not None else ScoreStatus.UNAVAILABLE
        ),
        score_method=(
            ScoreMethod.JOB_DESCRIPTION_COVERAGE
            if score_available
            else ScoreMethod.UNAVAILABLE
        ),
        score_explanation=_job_score_explanation(
            score, score_available, len(specs), unevaluated_count
        ),
        matched_requirements=matched,
        skill_gaps=gaps,
        unknown_requirements=unknown,
        not_evaluated_requirements=not_evaluated,
        score_components=[evaluation.component for evaluation in evaluations],
        evidence_summary=_evidence_summary(
            analysis, matched, gaps, not_evaluated, len(unknown)
        ),
        recommendations=recommendations,
        catalog_version=catalog.skills_catalog_version,
        limitations=limitations,
        created_at=created_at or datetime.now(timezone.utc).isoformat(),
    )


def _role_spec(requirement: RubricRequirement) -> _RequirementSpec:
    return _RequirementSpec(
        requirement_id=requirement.requirement_id,
        skill_ids=requirement.skill_ids,
        match_mode=requirement.match_mode,
        requirement_type=_ROLE_IMPORTANCE_MAP[requirement.importance],
        importance=requirement.importance,
        weight=requirement.weight,
        rationale=requirement.rationale,
        source_span=None,
    )


def _evaluate_specs(
    analysis: ResumeAnalysis,
    specs: tuple[_RequirementSpec, ...],
    catalog: ResumeIntelligenceCatalog,
    *,
    compute_weighted_values: bool,
) -> list[_Evaluation]:
    evidence_by_skill = {item.skill_id: item for item in analysis.skills}
    return [
        _evaluate_requirement(
            spec,
            evidence_by_skill,
            catalog,
            compute_weighted_values=compute_weighted_values,
        )
        for spec in specs
    ]


def _evaluate_requirement(
    spec: _RequirementSpec,
    evidence_by_skill: dict[str, SkillEvidence],
    catalog: ResumeIntelligenceCatalog,
    *,
    compute_weighted_values: bool,
) -> _Evaluation:
    display_name = _display_name(spec, catalog)
    unknown_catalog_skills = [
        skill_id for skill_id in spec.skill_ids if skill_id not in catalog.skills
    ]
    if not spec.skill_ids or unknown_catalog_skills:
        finding = _finding(
            spec,
            display_name,
            MatchStatus.NOT_EVALUATED,
            explanation=(
                "This requirement references a skill that is not available in the active catalog and could not be evaluated."
            ),
            action="Review the rubric and catalog before relying on this requirement.",
        )
        return _Evaluation(
            finding,
            _component(
                spec,
                None,
                0.0,
                "Not evaluated.",
                compute_weighted_value=compute_weighted_values,
            ),
            0.0,
        )

    usable: list[tuple[str, SkillEvidence, EvidenceClassification, float]] = []
    low_confidence = False
    for skill_id in spec.skill_ids:
        evidence = evidence_by_skill.get(skill_id)
        if evidence is None:
            continue
        if evidence.confidence < MIN_USABLE_EVIDENCE_CONFIDENCE:
            low_confidence = True
            continue
        classification = EvidenceClassification(evidence.evidence_strength)
        factor = round(
            EVIDENCE_FACTORS[classification] * evidence.confidence, 4
        )
        usable.append((skill_id, evidence, classification, factor))

    if not usable:
        if low_confidence:
            finding = _finding(
                spec,
                display_name,
                MatchStatus.NOT_EVALUATED,
                explanation=(
                    "The skill was detected with low parser confidence, so the evidence was not treated as a reliable match."
                ),
                action="Review the parsed resume text or upload a clearer document.",
            )
            return _Evaluation(
                finding,
                _component(
                    spec,
                    None,
                    0.0,
                    "Low-confidence evidence.",
                    compute_weighted_value=compute_weighted_values,
                ),
                0.0,
            )
        finding = _finding(
            spec,
            display_name,
            MatchStatus.NOT_EVIDENCED,
            explanation=f"{display_name} is not evidenced in this resume.",
            action=_missing_action(display_name),
        )
        return _Evaluation(
            finding,
            _component(
                spec,
                None,
                0.0,
                "No resume evidence.",
                compute_weighted_value=compute_weighted_values,
            ),
            0.0,
        )

    usable.sort(key=lambda item: (-item[3], item[0]))
    if spec.match_mode == "any":
        chosen = usable[0]
        status = _status_for_classification(chosen[2])
        factor = chosen[3]
        finding = _finding(
            spec,
            display_name,
            status,
            evidence=_evidence_reference(chosen[1]),
            matched_skill_ids=[chosen[0]],
            explanation=_evidence_explanation(chosen[1], chosen[2]),
            action=_evidence_action(display_name, status),
        )
        component = _component(
            spec,
            chosen[2],
            factor,
            f"Strongest alternative: {chosen[1].matched_alias} ({chosen[2].value}) × confidence {chosen[1].confidence:.3f} = {factor:.4f}.",
            evidence=chosen[1],
            compute_weighted_value=compute_weighted_values,
        )
        return _Evaluation(finding, component, factor)

    factor = round(
        sum(item[3] for item in usable) / len(spec.skill_ids), 4
    )
    present_ids = [item[0] for item in usable]
    weakest = min(usable, key=lambda item: (item[3], item[0]))
    if len(usable) < len(spec.skill_ids):
        status = MatchStatus.WEAK_EVIDENCE
        explanation = (
            f"Only {len(usable)} of {len(spec.skill_ids)} skills in this grouped requirement are evidenced in the resume."
        )
    else:
        status = _status_for_classification(weakest[2])
        explanation = _evidence_explanation(weakest[1], weakest[2])
    finding = _finding(
        spec,
        display_name,
        status,
        evidence=_evidence_reference(weakest[1]),
        matched_skill_ids=present_ids,
        explanation=explanation,
        action=_evidence_action(display_name, status),
    )
    component = _component(
        spec,
        weakest[2],
        factor,
        f"Mean evidence factor across {len(spec.skill_ids)} required alternatives = {factor:.4f}.",
        evidence=weakest[1],
        compute_weighted_value=compute_weighted_values,
    )
    return _Evaluation(finding, component, factor)


def _finding(
    spec: _RequirementSpec,
    display_name: str,
    status: MatchStatus,
    *,
    explanation: str,
    action: str,
    evidence: EvidenceReference | None = None,
    matched_skill_ids: list[str] | None = None,
) -> RequirementAssessment:
    matched = matched_skill_ids or []
    canonical_skill_id = (
        matched[0]
        if matched
        else (spec.skill_ids[0] if len(spec.skill_ids) == 1 else None)
    )
    return RequirementAssessment(
        requirement_id=spec.requirement_id,
        canonical_skill_id=canonical_skill_id,
        skill_ids=list(spec.skill_ids),
        matched_skill_ids=matched,
        display_name=display_name,
        requirement_type=spec.requirement_type,
        importance=spec.importance,
        rationale=spec.rationale,
        requirement_span=(
            {"start": spec.source_span[0], "end": spec.source_span[1]}
            if spec.source_span is not None
            else None
        ),
        match_status=status,
        evidence=evidence,
        explanation=explanation,
        suggested_next_action=action,
    )


def _component(
    spec: _RequirementSpec,
    classification: EvidenceClassification | None,
    factor: float,
    explanation: str,
    *,
    evidence: SkillEvidence | None = None,
    compute_weighted_value: bool,
) -> ScoreComponent:
    weighted_value = (
        round(spec.weight * factor, 4)
        if compute_weighted_value and spec.weight is not None
        else None
    )
    return ScoreComponent(
        requirement_id=spec.requirement_id,
        requirement_type=spec.requirement_type,
        weight=spec.weight,
        evaluated_skill_ids=list(spec.skill_ids),
        evidence_classification=classification,
        evidence_confidence=evidence.confidence if evidence is not None else None,
        evidence_factor=factor,
        weighted_value=weighted_value,
        explanation=explanation,
    )


def _evidence_reference(evidence: SkillEvidence) -> EvidenceReference:
    return EvidenceReference(
        classification=EvidenceClassification(evidence.evidence_strength),
        section_type=evidence.section_type,
        section_id=evidence.section_id,
        span=evidence.span,
        snippet=evidence.evidence_snippet,
        matched_alias=evidence.matched_alias,
        parser_confidence=evidence.confidence,
    )


def _status_for_classification(
    classification: EvidenceClassification,
) -> MatchStatus:
    if classification in {
        EvidenceClassification.DEMONSTRATED_USE,
        EvidenceClassification.DEMONSTRATED_OUTCOME,
    }:
        return MatchStatus.DEMONSTRATED
    if classification is EvidenceClassification.LISTED:
        return MatchStatus.MENTIONED_ONLY
    return MatchStatus.WEAK_EVIDENCE


def _evidence_explanation(
    evidence: SkillEvidence, classification: EvidenceClassification
) -> str:
    name = evidence.canonical_name
    if classification is EvidenceClassification.DEMONSTRATED_OUTCOME:
        return f"{name} is demonstrated with a concrete outcome in the {evidence.section_type} section."
    if classification is EvidenceClassification.DEMONSTRATED_USE:
        return f"{name} is demonstrated in the {evidence.section_type} section, but no concrete outcome is recorded."
    if classification is EvidenceClassification.LISTED:
        return f"{name} is listed in the resume, but no project or work context demonstrates its use."
    return f"{name} appears in the {evidence.section_type} section without strong evidence of practical use."


def _evidence_action(display_name: str, status: MatchStatus) -> str:
    if status is MatchStatus.DEMONSTRATED:
        return "Keep this evidence; add a verified outcome only if one exists."
    if status is MatchStatus.MENTIONED_ONLY:
        return f"If you have applied {display_name}, add a real project or work example; do not imply proficiency from a list entry alone."
    if status is MatchStatus.WEAK_EVIDENCE:
        return f"Add a specific project or work example showing where and how you used {display_name}."
    return _missing_action(display_name)


def _missing_action(display_name: str) -> str:
    return (
        f"If {display_name} is relevant to your plan, learn it and complete a verifiable exercise; "
        "add it only after you can explain real work."
    )


def _display_name(
    spec: _RequirementSpec, catalog: ResumeIntelligenceCatalog
) -> str:
    names = [
        catalog.skills[skill_id].canonical_name
        if skill_id in catalog.skills
        else skill_id
        for skill_id in spec.skill_ids
    ]
    separator = " + " if spec.match_mode == "all" else " / "
    return separator.join(names) or spec.requirement_id


def _calculate_score(
    evaluations: list[_Evaluation], score_available: bool
) -> float | None:
    if not score_available or not evaluations:
        return None
    if any(
        evaluation.finding.match_status is MatchStatus.NOT_EVALUATED
        for evaluation in evaluations
    ):
        return None
    weights = [evaluation.component.weight for evaluation in evaluations]
    if any(weight is None or weight <= 0 for weight in weights):
        return None
    total_weight = sum(weight for weight in weights if weight is not None)
    if total_weight <= 0:
        return None
    numerator = sum(
        evaluation.component.weight * evaluation.factor
        for evaluation in evaluations
        if evaluation.component.weight is not None
    )
    return round(100.0 * numerator / total_weight, 1)


def _partition_findings(
    evaluations: list[_Evaluation],
) -> tuple[
    list[RequirementAssessment],
    list[RequirementAssessment],
    list[RequirementAssessment],
]:
    matched: list[RequirementAssessment] = []
    gaps: list[RequirementAssessment] = []
    not_evaluated: list[RequirementAssessment] = []
    for evaluation in evaluations:
        status = evaluation.finding.match_status
        if status is MatchStatus.DEMONSTRATED:
            matched.append(evaluation.finding)
        elif status is MatchStatus.NOT_EVALUATED:
            not_evaluated.append(evaluation.finding)
        else:
            gaps.append(evaluation.finding)
    return matched, gaps, not_evaluated


def _evidence_summary(
    analysis: ResumeAnalysis,
    matched: list[RequirementAssessment],
    gaps: list[RequirementAssessment],
    not_evaluated: list[RequirementAssessment],
    unknown_count: int,
) -> EvidenceSummary:
    statuses = [item.match_status for item in matched + gaps + not_evaluated]
    return EvidenceSummary(
        resume_skill_count=len(analysis.skills),
        project_count=len(analysis.projects),
        experience_count=len(analysis.work_experience),
        evaluated_requirement_count=len(statuses),
        demonstrated_count=statuses.count(MatchStatus.DEMONSTRATED),
        mentioned_only_count=statuses.count(MatchStatus.MENTIONED_ONLY),
        weak_evidence_count=statuses.count(MatchStatus.WEAK_EVIDENCE),
        not_evidenced_count=statuses.count(MatchStatus.NOT_EVIDENCED),
        unknown_requirement_count=unknown_count,
        not_evaluated_count=statuses.count(MatchStatus.NOT_EVALUATED),
    )


def _role_score_explanation(
    rubric: Rubric,
    score_available: bool,
    score: float | None,
    requirement_count: int,
    unevaluated_count: int,
) -> str:
    if score_available and score is not None:
        return (
            f"Weighted role-rubric coverage: 100 × sum(requirement weight × evidence factor) / "
            f"sum(requirement weight) across {requirement_count} requirements = {score:.1f}/100. "
            "The weights are owned by the approved rubric; this is not a hiring probability."
        )
    if unevaluated_count:
        reason = "one or more requirements could not be evaluated reliably"
    elif rubric.status != "approved":
        reason = f"the rubric status is '{rubric.status}'"
    elif any(requirement.weight is None for requirement in rubric.requirements):
        reason = "one or more requirement weights are unset"
    else:
        reason = "the rubric weights are not validated for scoring"
    return (
        f"A numerical role score is unavailable because {reason}. Requirement findings and "
        "evidence gaps are returned without inventing weights or substituting another rubric."
    )


def _job_score_explanation(
    score: float | None,
    score_available: bool,
    requirement_count: int,
    unevaluated_count: int,
) -> str:
    if score_available and score is not None:
        return (
            f"Textual job-description coverage: 100 × sum(heuristic weight × evidence factor) / "
            f"sum(heuristic weight) across {requirement_count} known requirements = {score:.1f}/100. "
            "Weights are required=3.0, preferred=1.0, unspecified=0.5. This is not an ATS or hiring probability."
        )
    if unevaluated_count:
        reason = "one or more detected requirements could not be evaluated reliably"
    else:
        reason = (
            f"only {requirement_count} known requirement(s) were detected; at least "
            f"{MIN_JD_SCORABLE_REQUIREMENTS} are required"
        )
    return (
        f"A numerical score is unavailable because {reason}. Findings and unknown terms are still shown."
    )


def _role_limitations(
    role: Role,
    rubric: Rubric,
    score_available: bool,
    analysis: ResumeAnalysis,
) -> list[str]:
    evidence_tier = str(rubric.evidence.get("evidence_tier", "unknown"))
    posting_count = rubric.evidence.get("eligible_posting_count", 0)
    limitations = [
        "This assessment is not a probability of shortlisting, interview, or hiring.",
        "Absence from the resume means 'not evidenced in this resume', not proof that the candidate lacks the skill.",
        f"Rubric evidence tier: {evidence_tier}; eligible job postings: {posting_count}; validation: {rubric.validation.get('status', 'unknown')}.",
    ]
    if not score_available:
        limitations.append(
            "No numerical role score was calculated because the rubric lacks approved, validated requirement weights."
        )
    if evidence_tier == "taxonomy_only":
        limitations.append(
            "The rubric is based on occupational taxonomy and expert review, not validated Indian employer-demand data."
        )
    if rubric.validation.get("status") != "approved":
        limitations.append("The rubric has not completed manual review and must be treated as preliminary.")
    for warning in analysis.warnings[:3]:
        limitations.append(f"Resume parser note: {warning}")
    return limitations


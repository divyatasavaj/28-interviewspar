from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime

from .language_validator import LanguageValidator, create_language_validator
from .relevance_validator import RelevanceValidator, create_relevance_validator
from .completeness_validator import CompletenessValidator, create_completeness_validator

from app.lib.interview.question_schema import (
    ValidationRule, ValidationRuleType, ValidationResult, AnswerEvaluation, LanguageCode
)


@dataclass
class ValidationContext:
    question_id: str
    question_text: str
    question_type: str
    round_type: str
    expected_fields: list[str] = field(default_factory=list)
    allowed_languages: list[str] = field(default_factory=lambda: ['en'])
    relevance_threshold: float = 0.3
    min_words: int = 5


class ValidationEngine:
    def __init__(self):
        self.language_validator = create_language_validator()
        self.relevance_validator = create_relevance_validator()
        self.completeness_validator = create_completeness_validator()

    def validate_answer(
        self, 
        answer: str, 
        context: ValidationContext,
        retry_count: int = 0
    ) -> AnswerEvaluation:
        validation_results = []
        overall_valid = True
        flagged_issues = []
        
        # Language validation
        lang_result = self.language_validator.validate(answer, context.question_text)
        lang_validation = ValidationResult(
            is_valid=lang_result['valid'],
            rule_type=ValidationRuleType.LANGUAGE_ENFORCEMENT,
            message=lang_result.get('message', ''),
            severity='error' if not lang_result['valid'] else 'info',
            retry_count=retry_count,
            max_retries=2,
            can_retry=not lang_result['valid'] and retry_count < 2,
            suggestions=lang_result.get('suggestions', [])
        )
        validation_results.append(lang_validation)
        if not lang_validation.is_valid:
            overall_valid = False
            flagged_issues.append(f"Language: {lang_validation.message}")

        # Relevance validation
        rel_result = self.relevance_validator.validate(context.question_text, answer)
        rel_validation = ValidationResult(
            is_valid=rel_result.is_relevant,
            rule_type=ValidationRuleType.RELEVANCE_CHECK,
            message=rel_result.explanation if not rel_result.is_relevant else "Answer is relevant",
            severity='error' if not rel_result.is_relevant else 'info',
            retry_count=retry_count,
            max_retries=2,
            can_retry=not rel_result.is_relevant and retry_count < 2,
            suggestions=[
                "Please address the specific question asked",
                f"Focus on: {context.question_text[:100]}..."
            ] if not rel_result.is_relevant else []
        )
        validation_results.append(rel_validation)
        if not rel_validation.is_valid:
            overall_valid = False
            flagged_issues.append(f"Relevance: {rel_validation.message}")

        # Completeness validation
        comp_result = self.completeness_validator.validate(
            context.question_text, answer, context.expected_fields
        )
        comp_validation = ValidationResult(
            is_valid=comp_result.is_complete,
            rule_type=ValidationRuleType.COMPLETENESS_CHECK,
            message=comp_result.explanation if not comp_result.is_complete else "Answer is complete",
            severity='error' if not comp_result.is_complete else 'info',
            retry_count=retry_count,
            max_retries=2,
            can_retry=not comp_result.is_complete and retry_count < 2,
            suggestions=[
                f"Please provide: {', '.join(comp_result.missing_fields)}",
                "Give a more detailed answer"
            ] if not comp_result.is_complete else []
        )
        validation_results.append(comp_validation)
        if not comp_validation.is_valid:
            overall_valid = False
            flagged_issues.append(f"Completeness: {comp_validation.message}")

        # Calculate quality scores
        language_score = 1.0 if lang_result['valid'] else 0.0
        relevance_score = rel_result.score
        completeness_score = comp_result.score
        quality_score = (language_score + relevance_score + completeness_score) / 3

        # Generate feedback message
        if overall_valid:
            feedback = "Good answer. Thank you."
        else:
            feedback = self._generate_feedback(validation_results, retry_count)

        return AnswerEvaluation(
            question_id=context.question_id,
            answer=answer,
            validation_results=validation_results,
            overall_valid=overall_valid,
            relevance_score=relevance_score,
            completeness_score=completeness_score,
            language_score=language_score,
            quality_score=quality_score,
            feedback=feedback,
            flagged_issues=flagged_issues,
            evaluated_at=datetime.utcnow()
        )

    def _generate_feedback(self, results: list[ValidationResult], retry_count: int) -> str:
        messages = []
        for r in results:
            if not r.is_valid:
                if r.rule_type == ValidationRuleType.LANGUAGE_ENFORCEMENT:
                    messages.append(r.message)
                elif r.rule_type == ValidationRuleType.RELEVANCE_CHECK:
                    messages.append("Your answer doesn't seem to address the question. " + r.message)
                elif r.rule_type == ValidationRuleType.COMPLETENESS_CHECK:
                    messages.append("Your answer is incomplete. " + r.message)
        
        if retry_count > 0:
            messages.append(f"This is retry {retry_count + 1}. Please provide a proper answer.")
        
        return " ".join(messages)

    def validate_with_rules(
        self, 
        answer: str, 
        rules: list[ValidationRule],
        context: ValidationContext,
        retry_count: int = 0
    ) -> AnswerEvaluation:
        validation_results = []
        overall_valid = True
        flagged_issues = []
        language_score = 1.0
        relevance_score = 1.0
        completeness_score = 1.0
        
        for rule in rules:
            if rule.rule_type == ValidationRuleType.LANGUAGE_ENFORCEMENT:
                allowed = rule.parameters.get('allowed_languages', context.allowed_languages)
                self.language_validator.allowed_languages = allowed
                lang_result = self.language_validator.validate(answer, context.question_text)
                vr = ValidationResult(
                    is_valid=lang_result['valid'],
                    rule_type=rule.rule_type,
                    message=rule.error_message or lang_result.get('message', ''),
                    severity=rule.severity,
                    retry_count=retry_count,
                    max_retries=rule.max_retries,
                    can_retry=rule.retry_allowed and not lang_result['valid'] and retry_count < rule.max_retries,
                    suggestions=lang_result.get('suggestions', [])
                )
                validation_results.append(vr)
                language_score = 1.0 if lang_result['valid'] else 0.0
                if not vr.is_valid:
                    overall_valid = False
                    flagged_issues.append(f"Language: {vr.message}")
            
            elif rule.rule_type == ValidationRuleType.RELEVANCE_CHECK:
                threshold = rule.parameters.get('threshold', context.relevance_threshold)
                self.relevance_validator.threshold = threshold
                rel_result = self.relevance_validator.validate(context.question_text, answer)
                vr = ValidationResult(
                    is_valid=rel_result.is_relevant,
                    rule_type=rule.rule_type,
                    message=rule.error_message or rel_result.explanation,
                    severity=rule.severity,
                    retry_count=retry_count,
                    max_retries=rule.max_retries,
                    can_retry=rule.retry_allowed and not rel_result.is_relevant and retry_count < rule.max_retries,
                    suggestions=["Please address the specific question asked"]
                )
                validation_results.append(vr)
                relevance_score = rel_result.score
                if not vr.is_valid:
                    overall_valid = False
                    flagged_issues.append(f"Relevance: {vr.message}")
            
            elif rule.rule_type == ValidationRuleType.COMPLETENESS_CHECK:
                expected = rule.parameters.get('expected_fields', context.expected_fields)
                min_words = rule.parameters.get('min_words', context.min_words)
                self.completeness_validator.min_words = min_words
                comp_result = self.completeness_validator.validate(context.question_text, answer, expected)
                vr = ValidationResult(
                    is_valid=comp_result.is_complete,
                    rule_type=rule.rule_type,
                    message=rule.error_message or comp_result.explanation,
                    severity=rule.severity,
                    retry_count=retry_count,
                    max_retries=rule.max_retries,
                    can_retry=rule.retry_allowed and not comp_result.is_complete and retry_count < rule.max_retries,
                    suggestions=[f"Please provide: {', '.join(comp_result.missing_fields)}"]
                )
                validation_results.append(vr)
                completeness_score = comp_result.score
                if not vr.is_valid:
                    overall_valid = False
                    flagged_issues.append(f"Completeness: {vr.message}")

        quality_score = (language_score + relevance_score + completeness_score) / 3
        
        feedback = "Good answer. Thank you." if overall_valid else self._generate_feedback(validation_results, retry_count)

        return AnswerEvaluation(
            question_id=context.question_id,
            answer=answer,
            validation_results=validation_results,
            overall_valid=overall_valid,
            relevance_score=relevance_score,
            completeness_score=completeness_score,
            language_score=language_score,
            quality_score=quality_score,
            feedback=feedback,
            flagged_issues=flagged_issues,
            evaluated_at=datetime.utcnow()
        )


def create_validation_engine() -> ValidationEngine:
    return ValidationEngine()
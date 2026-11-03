from typing import Optional
from dataclasses import dataclass, field
from datetime import datetime

from app.lib.interview.question_schema import (
    AnswerEvaluation, AnswerSubmission, SessionState, RoundType, TechnicalRole,
    ValidationRule, ValidationRuleType, LanguageCode
)
from app.lib.interview.validation import ValidationEngine, ValidationContext


@dataclass
class ProcessedAnswer:
    evaluation: AnswerEvaluation
    should_advance: bool
    next_question_id: Optional[str] = None
    retry_message: Optional[str] = None
    session_updates: dict = field(default_factory=dict)


class AnswerProcessor:
    def __init__(self, validation_engine: ValidationEngine = None):
        self.validation_engine = validation_engine or ValidationEngine()
        self.max_retries_per_question = 2

    def process_answer(
        self,
        submission: AnswerSubmission,
        session: SessionState,
        question_bank: 'QuestionBank',
        current_question
    ) -> ProcessedAnswer:
        # Build validation context
        context = ValidationContext(
            question_id=current_question.id,
            question_text=current_question.prompt,
            question_type=current_question.question_type.value,
            round_type=session.current_round.value,
            expected_fields=self._get_expected_fields(current_question),
            allowed_languages=['en'],
            relevance_threshold=0.3,
            min_words=5
        )

        # Get retry count for this question
        retry_count = session.validation_retries.get(current_question.id, 0)

        # Validate answer
        if current_question.validation_rules:
            evaluation = self.validation_engine.validate_with_rules(
                submission.answer, current_question.validation_rules, context, retry_count
            )
        else:
            evaluation = self.validation_engine.validate_answer(
                submission.answer, context, retry_count
            )

        # Determine if should advance
        should_advance = evaluation.overall_valid

        # Handle retries
        if not should_advance and retry_count < self.max_retries_per_question:
            # Update retry count
            session_updates = {
                'validation_retries': {**session.validation_retries, current_question.id: retry_count + 1}
            }
            retry_message = evaluation.feedback
            return ProcessedAnswer(
                evaluation=evaluation,
                should_advance=False,
                next_question_id=current_question.id,
                retry_message=retry_message,
                session_updates=session_updates
            )

        # Max retries exceeded or valid answer
        if not should_advance:
            # Flag violation
            violation = {
                'question_id': current_question.id,
                'type': 'max_retries_exceeded',
                'timestamp': datetime.utcnow().isoformat(),
                'answer': submission.answer[:200],
                'issues': evaluation.flagged_issues
            }
            session_updates = {
                'violations': session.violations + [violation],
                'validation_retries': {**session.validation_retries, current_question.id: retry_count + 1}
            }
        else:
            # Valid answer - advance
            session_updates = {
                'questions_answered': session.questions_answered + [current_question.id],
                'current_question_index': session.current_question_index + 1,
                'validation_retries': session.validation_retries
            }

        # Get next question
        next_question = self._get_next_question(session, question_bank)
        next_question_id = next_question.id if next_question else None

        return ProcessedAnswer(
            evaluation=evaluation,
            should_advance=should_advance,
            next_question_id=next_question_id,
            session_updates=session_updates
        )

    def _get_expected_fields(self, question) -> list[str]:
        """Extract expected fields based on question type"""
        field_map = {
            'basic_info': ['name'],
            'experience': ['company', 'role', 'experience_years'],
            'skills': ['technology'],
            'project': ['project_name', 'tech_stack'],
            'location': ['location'],
        }

        qtype = question.question_type.value
        for key, fields in field_map.items():
            if key in qtype:
                return fields
        return []

    def _get_next_question(self, session: SessionState, question_bank: 'QuestionBank'):
        questions = question_bank.get_questions_for_round(session.current_round, session.current_role)
        next_index = session.current_question_index + 1
        if next_index < len(questions):
            return questions[next_index]
        return None


class HRAnswerProcessor(AnswerProcessor):
    """Specialized processor for HR round with basic info questions"""

    def _get_expected_fields(self, question) -> list[str]:
        prompt_lower = question.prompt.lower()
        if 'name' in prompt_lower:
            return ['name']
        elif 'email' in prompt_lower:
            return ['email']
        elif 'phone' in prompt_lower:
            return ['phone']
        elif 'location' in prompt_lower or 'city' in prompt_lower or 'where' in prompt_lower:
            return ['location']
        elif 'experience' in prompt_lower or 'work' in prompt_lower:
            return ['company', 'role', 'experience_years']
        elif 'skill' in prompt_lower:
            return ['technology']
        return []


class TechnicalAnswerProcessor(AnswerProcessor):
    """Specialized processor for technical round"""

    def _get_expected_fields(self, question) -> list[str]:
        # For technical questions, we expect more detailed answers
        return []


def create_answer_processor(round_type: RoundType) -> AnswerProcessor:
    if round_type == RoundType.HR:
        return HRAnswerProcessor()
    elif round_type == RoundType.TECHNICAL:
        return TechnicalAnswerProcessor()
    return AnswerProcessor()

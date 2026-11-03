from typing import Optional
from dataclasses import dataclass
from datetime import datetime

from app.lib.interview.question_schema import (
    SessionState, RoundType, HRQuestion, AnswerEvaluation
)
from app.lib.interview.answer_processor import HRAnswerProcessor
from app.lib.interview.rounds.hr.questions.hr_questions import get_hr_questions, get_hr_question_by_id
from app.lib.interview.validation import ValidationEngine


@dataclass
class HRRoundResult:
    session_id: str
    current_question: Optional[HRQuestion]
    evaluation: Optional[AnswerEvaluation]
    is_complete: bool
    progress: dict
    message: str


class HRRound:
    def __init__(self, validation_engine: ValidationEngine = None):
        self.questions = get_hr_questions()
        self.processor = HRAnswerProcessor(validation_engine)
        self.validation_engine = validation_engine or ValidationEngine()

    def start_round(self, session: SessionState) -> HRRoundResult:
        session.current_round = RoundType.HR
        session.current_question_index = 0
        session.current_question_id = self.questions[0].id if self.questions else None
        
        first_question = self.questions[0] if self.questions else None
        
        return HRRoundResult(
            session_id=session.session_id,
            current_question=first_question,
            evaluation=None,
            is_complete=False,
            progress=self._get_progress(session),
            message="Welcome to the HR round! Let's start with some basic information."
        )

    def process_answer(self, session: SessionState, answer: str) -> HRRoundResult:
        if not self.questions:
            return HRRoundResult(
                session_id=session.session_id,
                current_question=None,
                evaluation=None,
                is_complete=True,
                progress=self._get_progress(session),
                message="No questions configured for HR round."
            )
        
        current_question = get_hr_question_by_id(session.current_question_id)
        if not current_question:
            current_question = self.questions[session.current_question_index] if session.current_question_index < len(self.questions) else None
        
        if not current_question:
            return HRRoundResult(
                session_id=session.session_id,
                current_question=None,
                evaluation=None,
                is_complete=True,
                progress=self._get_progress(session),
                message="HR round completed!"
            )
        
        from app.lib.interview.question_schema import AnswerSubmission
        submission = AnswerSubmission(
            session_id=session.session_id,
            question_id=current_question.id,
            answer=answer
        )
        
        result = self.processor.process_answer(submission, session, self._create_question_bank(), current_question)
        
        # Update session with processor updates
        if result.session_updates:
            for key, value in result.session_updates.items():
                setattr(session, key, value)
        
        session.current_question_id = result.next_question_id
        
        next_question = get_hr_question_by_id(result.next_question_id) if result.next_question_id else None
        is_complete = next_question is None
        
        if is_complete:
            session.current_round = RoundType.TECHNICAL
            session.current_question_index = 0
            session.current_question_id = None
        
        return HRRoundResult(
            session_id=session.session_id,
            current_question=next_question,
            evaluation=result.evaluation,
            is_complete=is_complete,
            progress=self._get_progress(session),
            message=result.retry_message or (next_question.prompt if next_question else "HR round completed! Moving to technical round.")
        )

    def get_current_question(self, session: SessionState) -> Optional[HRQuestion]:
        if session.current_question_id:
            return get_hr_question_by_id(session.current_question_id)
        if session.current_question_index < len(self.questions):
            return self.questions[session.current_question_index]
        return None

    def _get_progress(self, session: SessionState) -> dict:
        answered = len(session.questions_answered)
        total = len(self.questions)
        return {
            'current': answered + 1 if not session.current_question_id or answered < total else total,
            'total': total,
            'percentage': round((answered / total) * 100, 1) if total > 0 else 100,
            'answered': answered,
            'remaining': total - answered
        }

    def _create_question_bank(self):
        from app.lib.interview.question_schema import QuestionBank
        return QuestionBank(questions=self.questions)

    def get_all_questions(self) -> list[HRQuestion]:
        return self.questions

    def reset_round(self, session: SessionState):
        session.current_round = RoundType.HR
        session.current_question_index = 0
        session.current_question_id = self.questions[0].id if self.questions else None
        session.questions_answered = []
        session.validation_retries = {}
        session.violations = []


def create_hr_round(validation_engine: ValidationEngine = None) -> HRRound:
    return HRRound(validation_engine)
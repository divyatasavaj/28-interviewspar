from typing import Optional, List
from dataclasses import dataclass
from app.lib.interview.question_schema import (
    SessionState, RoundType, TechnicalRole, TechnicalQuestion, CodingChallenge,
    AnswerEvaluation, QuestionType, DifficultyLevel
)
from app.lib.interview.answer_processor import TechnicalAnswerProcessor
from app.lib.interview.rounds.technical.roles.role_definitions import get_role_definition
from app.lib.interview.rounds.technical.theory_questions import get_theory_questions_for_role
from app.lib.interview.rounds.technical.code_challenges.challenges import get_challenges_for_role
from app.lib.interview.validation import ValidationEngine


@dataclass
class TechnicalRoundResult:
    session_id: str
    current_question: Optional[TechnicalQuestion]
    evaluation: Optional[AnswerEvaluation]
    is_complete: bool
    progress: dict
    message: str
    round_type: str  # 'theory' or 'coding'


class TechnicalRound:
    def __init__(self, role: TechnicalRole, validation_engine: ValidationEngine = None):
        self.role = role
        self.role_definition = get_role_definition(role)
        self.theory_questions = get_theory_questions_for_role(role)
        self.coding_challenges = get_challenges_for_role(role)
        self.processor = TechnicalAnswerProcessor(validation_engine)
        self.validation_engine = validation_engine or ValidationEngine()
        self._current_phase = "theory"  # theory -> coding
        self._theory_index = 0
        self._coding_index = 0

    def start_round(self, session: SessionState) -> TechnicalRoundResult:
        session.current_round = RoundType.TECHNICAL
        session.current_role = self.role
        session.current_question_index = 0
        self._current_phase = "theory"
        self._theory_index = 0
        self._coding_index = 0
        
        first_question = self._get_next_question()
        if first_question:
            session.current_question_id = first_question.id
        
        return TechnicalRoundResult(
            session_id=session.session_id,
            current_question=first_question,
            evaluation=None,
            is_complete=False,
            progress=self._get_progress(session),
            message=f"Starting technical round for {self.role_definition.display_name if self.role_definition else self.role.value}. Phase 1: Technical Theory Questions",
            round_type="theory"
        )

    def process_answer(self, session: SessionState, answer: str, code: str = None) -> TechnicalRoundResult:
        self._current_phase = session.metadata.get("technical_phase", "theory")
        self._theory_index = session.metadata.get("theory_index", 0)
        self._coding_index = session.metadata.get("coding_index", 0)
        current_question = self._get_current_question(session)
        
        if not current_question:
            return TechnicalRoundResult(
                session_id=session.session_id,
                current_question=None,
                evaluation=None,
                is_complete=True,
                progress=self._get_progress(session),
                message="Technical round completed!",
                round_type=self._current_phase
            )
        
        # For coding challenges, combine answer and code
        full_answer = answer
        if code and current_question.question_type == QuestionType.CODING_CHALLENGE:
            full_answer = f"Code:\n{code}\n\nExplanation:\n{answer}"
        
        from app.lib.interview.question_schema import AnswerSubmission
        submission = AnswerSubmission(
            session_id=session.session_id,
            question_id=current_question.id,
            answer=full_answer
        )
        
        result = self.processor.process_answer(submission, session, self._create_question_bank(), current_question)
        
        # Update session
        if result.session_updates:
            for key, value in result.session_updates.items():
                setattr(session, key, value)
        
        session.current_question_id = result.next_question_id
        
        next_question = self._get_next_question()
        is_complete = next_question is None
        
        # Check phase transition
        phase_msg = ""
        if self._current_phase == "theory" and self._theory_index >= len(self.theory_questions) and self.coding_challenges:
            self._current_phase = "coding"
            self._coding_index = 0
            phase_msg = "Moving to Phase 2: Coding Challenges. "
        elif self._current_phase == "coding" and self._coding_index >= len(self.coding_challenges):
            is_complete = True
        
        if is_complete:
            session.current_round = RoundType.BEHAVIORAL
            session.current_question_index = 0
            session.current_question_id = None
        
        session.metadata.update(technical_phase=self._current_phase, theory_index=self._theory_index, coding_index=self._coding_index)
        return TechnicalRoundResult(
            session_id=session.session_id,
            current_question=next_question,
            evaluation=result.evaluation,
            is_complete=is_complete,
            progress=self._get_progress(session),
            message=result.retry_message or (phase_msg + (next_question.prompt if next_question else "Technical round completed!")),
            round_type=self._current_phase
        )

    def _get_current_question(self, session: SessionState) -> Optional[TechnicalQuestion]:
        if session.current_question_id:
            # Find in theory questions
            for q in self.theory_questions:
                if q.id == session.current_question_id:
                    return q
            # Find in coding challenges
            for c in self.coding_challenges:
                if c.id == session.current_question_id:
                    return c
        
        # Fallback to index
        if self._current_phase == "theory" and self._theory_index < len(self.theory_questions):
            return self.theory_questions[self._theory_index]
        elif self._current_phase == "coding" and self._coding_index < len(self.coding_challenges):
            return self.coding_challenges[self._coding_index]
        return None

    def _get_next_question(self) -> Optional[TechnicalQuestion]:
        if self._current_phase == "theory":
            if self._theory_index < len(self.theory_questions):
                q = self.theory_questions[self._theory_index]
                self._theory_index += 1
                return q
            elif self.coding_challenges:
                self._current_phase = "coding"
                self._coding_index = 0
                if self.coding_challenges:
                    c = self.coding_challenges[0]
                    self._coding_index = 1
                    return c
        elif self._current_phase == "coding":
            if self._coding_index < len(self.coding_challenges):
                c = self.coding_challenges[self._coding_index]
                self._coding_index += 1
                return c
        return None

    def _get_progress(self, session: SessionState) -> dict:
        theory_total = len(self.theory_questions)
        coding_total = len(self.coding_challenges)
        total = theory_total + coding_total
        answered = len(session.questions_answered)
        
        if self._current_phase == "theory":
            current = self._theory_index
            phase_progress = f"Theory: {current}/{theory_total}"
        else:
            current = theory_total + self._coding_index
            phase_progress = f"Coding: {self._coding_index}/{coding_total}"
        
        return {
            'current': min(current + 1, total),
            'total': total,
            'percentage': round((answered / total) * 100, 1) if total > 0 else 100,
            'answered': answered,
            'remaining': total - answered,
            'phase': self._current_phase,
            'phase_progress': phase_progress,
            'theory_total': theory_total,
            'coding_total': coding_total
        }

    def _create_question_bank(self):
        from app.lib.interview.question_schema import QuestionBank
        all_questions = self.theory_questions + self.coding_challenges
        return QuestionBank(questions=all_questions)

    def get_current_phase(self) -> str:
        return self._current_phase

    def get_role_definition(self):
        return self.role_definition


def create_technical_round(role: TechnicalRole, validation_engine: ValidationEngine = None) -> TechnicalRound:
    return TechnicalRound(role, validation_engine)
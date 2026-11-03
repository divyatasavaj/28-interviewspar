from typing import Optional, Dict, Any
from dataclasses import dataclass, field
from datetime import datetime

from app.lib.interview.question_schema import (
    SessionState, RoundType, TechnicalRole, InterviewReport, AnswerEvaluation
)
from app.lib.interview.answer_processor import AnswerProcessor, create_answer_processor
from app.lib.interview.question_schema import QuestionBank


@dataclass
class SessionAction:
    action: str  # 'start', 'answer', 'next', 'complete', 'violation', 'switch_round'
    payload: dict
    timestamp: datetime = field(default_factory=datetime.utcnow)


class SessionManager:
    def __init__(self, question_bank: QuestionBank):
        self.question_bank = question_bank
        self.sessions: Dict[str, SessionState] = {}
        self.session_history: Dict[str, list[SessionAction]] = {}

    def create_session(
        self,
        user_id: str,
        session_id: str,
        initial_round: RoundType = RoundType.HR,
        role: TechnicalRole = None
    ) -> SessionState:
        session = SessionState(
            session_id=session_id,
            user_id=user_id,
            current_round=initial_round,
            current_role=role,
            current_question_index=0,
            status='active'
        )
        self.sessions[session_id] = session
        self.session_history[session_id] = []
        self._log_action(session_id, 'start', {'round': initial_round.value, 'role': role.value if role else None})
        return session

    def get_session(self, session_id: str) -> Optional[SessionState]:
        return self.sessions.get(session_id)

    def update_session(self, session_id: str, updates: dict) -> Optional[SessionState]:
        session = self.sessions.get(session_id)
        if not session:
            return None

        for key, value in updates.items():
            if hasattr(session, key):
                setattr(session, key, value)
        session.updated_at = datetime.utcnow()
        return session

    def get_current_question(self, session_id: str):
        session = self.get_session(session_id)
        if not session:
            return None

        questions = self.question_bank.get_questions_for_round(
            session.current_round, session.current_role
        )

        if session.current_question_index < len(questions):
            return questions[session.current_question_index]
        return None

    def process_answer(
        self,
        session_id: str,
        answer: str,
        language: str = 'en'
    ) -> dict:
        session = self.get_session(session_id)
        if not session:
            return {'error': 'Session not found'}

        if session.status != 'active':
            return {'error': f'Session is {session.status}'}

        current_question = self.get_current_question(session_id)
        if not current_question:
            return {'error': 'No more questions in this round'}

        # Process answer
        processor = create_answer_processor(session.current_round)

        from app.lib.interview.question_schema import AnswerSubmission
        submission = AnswerSubmission(
            session_id=session_id,
            question_id=current_question.id,
            answer=answer,
            language=language
        )

        result = processor.process_answer(submission, session, self.question_bank, current_question)

        # Update session
        if result.session_updates:
            self.update_session(session_id, result.session_updates)

        # Log action
        self._log_action(session_id, 'answer', {
            'question_id': current_question.id,
            'answer': answer[:200],
            'valid': result.evaluation.overall_valid,
            'quality_score': result.evaluation.quality_score,
            'should_advance': result.should_advance
        })

        # Get next question if advancing
        next_question = None
        if result.should_advance and result.next_question_id:
            next_question = self.question_bank.get_question_by_id(result.next_question_id)
            session.current_question_id = result.next_question_id

        # Check if round complete
        round_complete = not result.should_advance or next_question is None

        return {
            'evaluation': result.evaluation,
            'should_advance': result.should_advance,
            'retry_message': result.retry_message,
            'next_question': next_question,
            'round_complete': round_complete,
            'session_status': session.status
        }

    def advance_round(self, session_id: str, next_round: RoundType) -> Optional[SessionState]:
        session = self.get_session(session_id)
        if not session:
            return None

        session.current_round = next_round
        session.current_question_index = 0
        session.current_question_id = None
        session.updated_at = datetime.utcnow()

        self._log_action(session_id, 'switch_round', {'new_round': next_round.value})
        return session

    def complete_session(self, session_id: str) -> Optional[InterviewReport]:
        session = self.get_session(session_id)
        if not session:
            return None

        session.status = 'completed'
        session.completed_at = datetime.utcnow()

        # Get all evaluations (would be stored separately in practice)
        evaluations = []  # Placeholder - would fetch from DB

        report = self._generate_report(session, evaluations)

        self._log_action(session_id, 'complete', {'report_id': report.session_id})
        return report

    def _generate_report(self, session: SessionState, evaluations: list[AnswerEvaluation]) -> InterviewReport:
        # Simplified report generation
        round_scores = {}
        for round_type in RoundType:
            round_evals = [e for e in evaluations if e.question_id.startswith(round_type.value)]
            if round_evals:
                round_scores[round_type] = sum(e.quality_score for e in round_evals) / len(round_evals)
            else:
                round_scores[round_type] = 0.0

        overall = sum(round_scores.values()) / len(round_scores) if round_scores else 0.0

        return InterviewReport(
            session_id=session.session_id,
            user_id=session.user_id,
            overall_score=overall,
            round_scores=round_scores,
            question_evaluations=evaluations,
            strengths=["Completed interview session"],
            weaknesses=["Practice more for better scores"],
            violations_summary={}
        )

    def _log_action(self, session_id: str, action: str, payload: dict):
        if session_id not in self.session_history:
            self.session_history[session_id] = []
        self.session_history[session_id].append(SessionAction(action=action, payload=payload))

    def get_session_history(self, session_id: str) -> list[SessionAction]:
        return self.session_history.get(session_id, [])

    def flag_session(self, session_id: str, reason: str) -> bool:
        session = self.get_session(session_id)
        if not session:
            return False
        session.status = 'flagged'
        session.violations.append({
            'type': 'manual_flag',
            'reason': reason,
            'timestamp': datetime.utcnow().isoformat()
        })
        self._log_action(session_id, 'violation', {'reason': reason})
        return True

    def terminate_session(self, session_id: str) -> bool:
        session = self.get_session(session_id)
        if not session:
            return False
        session.status = 'terminated'
        session.completed_at = datetime.utcnow()
        self._log_action(session_id, 'terminate', {})
        return True


def create_session_manager(question_bank: QuestionBank) -> SessionManager:
    return SessionManager(question_bank)

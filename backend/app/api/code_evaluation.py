from fastapi import APIRouter, Depends, HTTPException, status, Header
from pydantic import BaseModel
from typing import Optional, List, Dict, Any

from app.auth import decode_access_token
from app.lib.interview.code_evaluation import (
    CodeEvaluator, create_code_evaluator, Language, TestCase, CodeEvaluation
)
from app.lib.interview.rounds.technical.code_challenges import get_challenge_by_id


router = APIRouter(prefix="/interview/v2/code", tags=["code-evaluation"])


def require_token(authorization: str = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


class CodeEvaluationRequest(BaseModel):
    challenge_id: str
    code: str
    language: Language = Language.JAVASCRIPT
    test_cases: Optional[List[Dict]] = None


class CodeEvaluationResponse(BaseModel):
    execution_result: Dict
    ai_review: Optional[Dict] = None
    overall_score: float
    correctness_score: float
    complexity_score: float
    style_score: float
    edge_case_score: float
    feedback: str
    suggestions: List[str]


class ChallengeDetailResponse(BaseModel):
    id: str
    title: str
    prompt: str
    difficulty: str
    function_signature: Optional[str]
    starter_code: Dict[str, str]
    test_cases: List[Dict]
    skills_tested: List[str]
    time_limit_seconds: int


@router.get("/challenges/{challenge_id}", response_model=ChallengeDetailResponse)
def get_challenge(challenge_id: str, user_id: str = Depends(require_token)):
    """Get coding challenge details"""
    challenge = get_challenge_by_id(challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    return ChallengeDetailResponse(
        id=challenge.id,
        title=challenge.metadata.get('title', challenge.id),
        prompt=challenge.prompt,
        difficulty=challenge.difficulty.value,
        function_signature=challenge.function_signature,
        starter_code=challenge.starter_code,
        test_cases=challenge.test_cases,
        skills_tested=challenge.skills_tested,
        time_limit_seconds=challenge.time_limit_seconds
    )


@router.post("/evaluate", response_model=CodeEvaluationResponse)
def evaluate_code(
    body: CodeEvaluationRequest,
    user_id: str = Depends(require_token)
):
    """Evaluate code submission"""
    challenge = get_challenge_by_id(body.challenge_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="Challenge not found")

    evaluator = create_code_evaluator()

    if body.test_cases:
        raise HTTPException(400, "Client-supplied grading cases are not accepted")
    test_cases = None

    evaluation = evaluator.evaluate(
        code=body.code,
        language=body.language,
        challenge=challenge,
        test_cases=test_cases
    )

    return CodeEvaluationResponse(
        execution_result={
            "status": evaluation.execution_result.status.value,
            "stdout": evaluation.execution_result.stdout,
            "stderr": evaluation.execution_result.stderr,
            "execution_time_ms": evaluation.execution_result.execution_time_ms,
            "passed": evaluation.execution_result.passed,
            "total": evaluation.execution_result.total,
            "test_results": evaluation.execution_result.test_results,
            "error_message": evaluation.execution_result.error_message
        },
        ai_review=evaluation.ai_review,
        overall_score=evaluation.overall_score,
        correctness_score=evaluation.correctness_score,
        complexity_score=evaluation.complexity_score,
        style_score=evaluation.style_score,
        edge_case_score=evaluation.edge_case_score,
        feedback=evaluation.feedback,
        suggestions=evaluation.suggestions or []
    )

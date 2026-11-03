"""Owned interview code execution using server-side test cases."""

from typing import Literal
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from app.database import get_db
from app.routes.auth import require_user
from app.routes.interview_flow import owned_session
from app.interview_flow import PROBLEMS
from app.safe_execution import run_problem

router = APIRouter(prefix="/code", tags=["code"])


class RunRequest(BaseModel):
    session_id: str
    problem_id: str
    language: Literal["javascript", "python"]
    code: str = Field(min_length=1, max_length=50000)


@router.get("/problems")
def problems(user=Depends(require_user)):
    return [{k: v for k, v in p.items() if k != "testCases"} for p in PROBLEMS.values()]


@router.post("/run")
def run(body: RunRequest, db=Depends(get_db), user=Depends(require_user)):
    session = owned_session(db, body.session_id, user)
    if (
        session["status"] != "active"
        or session["questions"][session["index"]].get("problem_id") != body.problem_id
    ):
        raise HTTPException(
            409, "This coding question is not active in your interview."
        )
    return run_problem(body.problem_id, body.code, body.language)

from fastapi import APIRouter, Depends, Header, HTTPException
from pymongo.database import Database

from app.auth import decode_access_token
from app.data.coding_problems import get_problem, public_problems
from app.database import get_db
from app.services import anticheat
from app.services.code_runner import run_code

router = APIRouter(prefix="/code", tags=["code"])

SUPPORTED_LANGUAGES = ("javascript", "python")


def require_user_id(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


@router.get("/problems")
def list_problems():
    return public_problems()


@router.post("/run")
def run_submitted_code(body: dict):
    problem_id = body.get("problemId")
    language = body.get("language", "javascript")
    code = body.get("code", "")

    problem = get_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="problem not found")
    if language not in SUPPORTED_LANGUAGES:
        raise HTTPException(status_code=400, detail="unsupported language")
    if not isinstance(code, str) or not code.strip():
        raise HTTPException(status_code=400, detail="empty code")

    result = run_code(language, code, problem["testCases"])
    if result.get("error"):
        return {"error": result["error"], "results": [], "passed": 0, "total": len(problem["testCases"])}
    return result


@router.post("/similarity")
def check_similarity(body: dict, db: Database = Depends(get_db), user_id: str = Depends(require_user_id)):
    problem_id = body.get("problemId")
    code = body.get("code", "")
    language = body.get("language", "javascript")

    problem = get_problem(problem_id)
    if not problem:
        raise HTTPException(status_code=404, detail="problem not found")
    known = problem["knownSolution"].get(language)
    if not known:
        raise HTTPException(status_code=400, detail="no known solution for language")

    result = anticheat.check_code_similarity(code, [known])
    score = result["score"]
    flag = result["flag"]
    if flag != "low":
        session_id = body.get("sessionId")
        if session_id:
            from datetime import datetime, timezone
            db.integrity_logs.update_one(
                {"session_id": session_id},
                {"$push": {"events": {
                    "type": "code_similarity_flag",
                    "problem_id": problem_id,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "similarity_score": score,
                }}},
                upsert=True,
            )
    return {"similarity": score, "flag": flag}
from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pymongo.database import Database

from app.database import get_db
from app.schemas import QuestionCreate, QuestionResponse

router = APIRouter(prefix="/questions", tags=["questions"])


@router.post("/", status_code=status.HTTP_201_CREATED)
def create_question(body: QuestionCreate, db: Database = Depends(get_db)):
    doc = body.model_dump()
    result = db.questions.insert_one(doc)
    return {"id": str(result.inserted_id)}


@router.get("/calibration")
def get_calibration_questions(domain: str = Query(...), db: Database = Depends(get_db)):
    questions = list(
        db.questions.find({"domain": domain, "difficulty": "easy"})
        .limit(3)
    )
    if not questions:
        questions = list(
            db.questions.aggregate([{"$sample": {"size": 3}}])
        )
    return [
        {
            "id": str(q["_id"]),
            "domain": q.get("domain"),
            "difficulty": q.get("difficulty"),
            "type": q.get("type"),
            "question_text": q.get("question_text"),
        }
        for q in questions
    ]


@router.get("/next")
def get_next_question(
    domain: str = Query(...),
    difficulty: str = Query("medium"),
    question_type: str = Query(None),
    db: Database = Depends(get_db),
):
    filt = {"domain": domain, "difficulty": difficulty}
    if question_type:
        filt["type"] = question_type
    questions = list(db.questions.find(filt).limit(5))
    if not questions:
        questions = list(
            db.questions.find({"domain": domain}).limit(3)
        )
    if not questions:
        raise HTTPException(status_code=404, detail="No questions found")
    import random
    q = random.choice(questions)
    return {
        "id": str(q["_id"]),
        "domain": q.get("domain"),
        "difficulty": q.get("difficulty"),
        "type": q.get("type"),
        "question_text": q.get("question_text"),
        "reference": q.get("reference"),
    }


@router.get("/{question_id}/reference")
def get_question_reference(question_id: str, db: Database = Depends(get_db)):
    q = db.questions.find_one({"_id": ObjectId(question_id)})
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"reference": q.get("reference")}


@router.get("/", response_model=list[QuestionResponse])
def list_questions(domain: str = Query(None), db: Database = Depends(get_db)):
    filt = {}
    if domain:
        filt["domain"] = domain
    questions = db.questions.find(filt)
    return [
        QuestionResponse(
            id=str(q["_id"]),
            domain=q.get("domain", ""),
            difficulty=q.get("difficulty", "medium"),
            type=q.get("type", ""),
            question_text=q.get("question_text", ""),
            reference=q.get("reference"),
        )
        for q in questions
    ]

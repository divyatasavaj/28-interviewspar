import json
import os

from bson.objectid import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, status
from groq import Groq
from pymongo.database import Database

from app.auth import decode_access_token
from app.database import get_db

router = APIRouter(prefix="/resume", tags=["resume"])

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_SIZE = 10 * 1024 * 1024


def require_token(authorization: str = Header(...)) -> str:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.removeprefix("Bearer ")
    user_id = decode_access_token(token)
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user_id


def extract_text(file: UploadFile) -> str:
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Only PDF and DOCX files are supported")

    content = file.file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")

    if ext == ".pdf":
        import pdfplumber
        import io
        text = ""
        with pdfplumber.open(io.BytesIO(content)) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
        return text.strip()

    if ext == ".docx":
        import docx
        import io
        doc = docx.Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs).strip()

    raise HTTPException(status_code=400, detail="Unsupported file type")


def parse_with_groq(raw_text: str) -> dict:
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a resume parser. Extract the following fields from the resume text "
                    "and return ONLY valid JSON with no markdown formatting or extra text. "
                    "The JSON must have these keys: "
                    '"skills" (array of strings), '
                    '"work_experience" (array of objects with company, role, duration, description), '
                    '"projects" (array of objects with name, description, technologies), '
                    '"education" (array of objects with institution, degree, year).'
                ),
            },
            {"role": "user", "content": raw_text},
        ],
        temperature=0.1,
    )
    content = response.choices[0].message.content
    if not content:
        raise ValueError("Groq returned empty response")
    text = content.strip()
    text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
    return json.loads(text)


def extract_resume_summary(raw_text: str) -> str:
    client = Groq(api_key=os.environ["GROQ_API_KEY"])
    response = client.chat.completions.create(
        model="openai/gpt-oss-20b",
        messages=[
            {
                "role": "system",
                "content": (
                    "Condense the following resume into a concise structured summary "
                    "suitable for an AI interviewer to reference. Include key skills, "
                    "notable achievements, years of experience, and education. "
                    "Keep it under 250 words. Return plain text, no JSON."
                ),
            },
            {"role": "user", "content": raw_text},
        ],
        temperature=0.3,
    )
    content = response.choices[0].message.content
    return (content or "").strip()


@router.post("/upload", status_code=status.HTTP_201_CREATED)
def upload_resume(file: UploadFile, db: Database = Depends(get_db), user_id: str = Depends(require_token)):
    raw_text = extract_text(file)
    try:
        parsed = parse_with_groq(raw_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse resume with AI: {str(e)}")

    summary = extract_resume_summary(raw_text)

    resume_data = {
        "file_url": None,
        "raw_text": raw_text,
        "summary": summary,
    }

    db.users.update_one(
        {"_id": ObjectId(user_id)},
        {"$set": {"resume": resume_data}},
    )

    result = db.resumes.insert_one({
        "user_id": user_id,
        "raw_text": raw_text,
        "parsed_data": parsed,
    })

    return {"id": str(result.inserted_id), "parsed_data": parsed, "summary": summary}


@router.get("/latest")
def get_latest_resume(db: Database = Depends(get_db), user_id: str = Depends(require_token)):
    resume = (
        db.resumes
        .find({"user_id": user_id})
        .sort("_id", -1)
        .limit(1)
    )
    try:
        r = next(resume)
    except StopIteration:
        raise HTTPException(status_code=404, detail="No resume found")

    user = db.users.find_one({"_id": ObjectId(user_id)})
    summary = (user.get("resume") or {}).get("summary", "") if user else ""

    return {
        "id": str(r["_id"]),
        "raw_text": r["raw_text"],
        "parsed_data": r.get("parsed_data"),
        "summary": summary,
        "uploaded_at": str(r["_id"].generation_time),
    }


@router.get("/summary")
def get_resume_summary(db: Database = Depends(get_db), user_id: str = Depends(require_token)):
    user = db.users.find_one({"_id": ObjectId(user_id)})
    if not user or not user.get("resume") or not user["resume"].get("raw_text"):
        raise HTTPException(status_code=404, detail="No resume found")
    resume = user["resume"]
    return {
        "summary": resume.get("summary", ""),
        "parsed_data": resume.get("parsed_data"),
    }

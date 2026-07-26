import json
import os

from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, status
from groq import Groq
from sqlalchemy.orm import Session

from app.auth import decode_access_token
from app.database import get_db
from app.models import Resume

router = APIRouter(prefix="/resume", tags=["resume"])

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_SIZE = 10 * 1024 * 1024


def require_token(authorization: str = Header(...)) -> int:
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


@router.post("/upload", status_code=status.HTTP_201_CREATED)
def upload_resume(file: UploadFile, db: Session = Depends(get_db), user_id: int = Depends(require_token)):
    raw_text = extract_text(file)
    try:
        parsed = parse_with_groq(raw_text)
        parsed_json = json.dumps(parsed)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse resume with AI: {str(e)}")

    resume = Resume(user_id=user_id, raw_text=raw_text, parsed_data=parsed_json)
    db.add(resume)
    db.commit()
    db.refresh(resume)

    return {"id": resume.id, "parsed_data": parsed}


@router.get("/latest")
def get_latest_resume(db: Session = Depends(get_db), user_id: int = Depends(require_token)):
    resume = (
        db.query(Resume)
        .filter(Resume.user_id == user_id)
        .order_by(Resume.uploaded_at.desc())
        .first()
    )
    if not resume:
        raise HTTPException(status_code=404, detail="No resume found")
    parsed = json.loads(resume.parsed_data) if resume.parsed_data else None
    return {"id": resume.id, "raw_text": resume.raw_text, "parsed_data": parsed, "uploaded_at": resume.uploaded_at.isoformat()}

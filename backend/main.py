from contextlib import asynccontextmanager

from app.database import init_db
from app.routes.auth import router as auth_router
from app.routes.resume import router as resume_router
from app.routes.interview import router as interview_router
from app.routes.questions import router as questions_router
from app.routes.sessions import router as sessions_router
from app.routes.answers import router as answers_router
from app.routes.code import router as code_router
from app.routes.reports import router as reports_router
from app.routes.feedback import router as feedback_router
from app.routes.integrity import router as integrity_router
from app.routes.video import router as video_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="InterviewSpar API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(resume_router)
app.include_router(interview_router)
app.include_router(questions_router)
app.include_router(sessions_router)
app.include_router(answers_router)
app.include_router(code_router)
app.include_router(reports_router)
app.include_router(feedback_router)
app.include_router(integrity_router)
app.include_router(video_router)


@app.get("/")
def root():
    return {"status": "ok"}

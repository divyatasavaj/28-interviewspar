from contextlib import asynccontextmanager

from app.database import init_db
from app.routes.auth import router as auth_router
from app.routes.resume import router as resume_router
from app.routes.interview import router as interview_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="InterviewSpar API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(resume_router)
app.include_router(interview_router)


@app.get("/")
def root():
    return {"status": "ok"}

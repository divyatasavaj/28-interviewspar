"""Supported API: one authentication system, resume pipeline, and interview lifecycle."""

import os
from collections import defaultdict, deque
from contextlib import asynccontextmanager
from time import monotonic
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pymongo.errors import PyMongoError
from app.database import init_db, client
from app.body_limit import BodyLimitMiddleware
from app.routes.auth import router as auth
from app.routes.resume import router as resume
from app.routes.resume_assessment import router as assessments
from app.routes.interview_flow import router as interview
from app.routes.code import router as code
from app.routes.tts import router as tts


@asynccontextmanager
async def lifespan(app):
    init_db()
    try:
        yield
    finally:
        client.close()


app = FastAPI(title="InterviewSpar API", version="2.0", lifespan=lifespan)
app.add_middleware(BodyLimitMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv(
        "CLIENT_ORIGIN", "http://localhost:5173,http://127.0.0.1:5173"
    ).split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Data-Consent"],
)
for router in [auth, resume, assessments, interview, code, tts]:
    app.include_router(router, prefix="/api")

# Bounded process-local protection; production ingress should also enforce limits.
requests = defaultdict(deque)


@app.middleware("http")
async def protect_requests(request: Request, call_next):
    if request.method == "OPTIONS":
        return await call_next(request)
    try:
        size = int(request.headers.get("content-length", "0"))
    except ValueError:
        return JSONResponse({"detail": "Invalid content length."}, status_code=400)
    if size > 11 * 1024 * 1024:
        return JSONResponse({"detail": "Request exceeds 11 MB."}, status_code=413)
    if (
        request.url.path == "/api/resume/upload"
        and request.method == "POST"
        and request.headers.get("x-data-consent") != "true"
    ):
        return JSONResponse(
            {"detail": "Consent to save your resume is required."}, status_code=400
        )
    identity = (
        request.client.host if request.client else "local",
        "auth" if request.url.path.startswith("/api/auth/") else "api",
    )
    current = monotonic()
    if len(requests) > 10000:
        for key in list(requests):
            if not requests[key] or requests[key][-1] < current - 60:
                del requests[key]
        if len(requests) > 10000:
            return JSONResponse(
                {"detail": "Server busy. Please retry."}, status_code=429
            )
    queue = requests[identity]
    while queue and queue[0] < current - 60:
        queue.popleft()
    limit = 30 if identity[1] == "auth" else 120
    if len(queue) >= limit:
        return JSONResponse(
            {"detail": "Too many requests. Please retry shortly."},
            status_code=429,
            headers={"Retry-After": "60"},
        )
    queue.append(current)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(PyMongoError)
async def database_error(request, exc):
    return JSONResponse(
        {"detail": "Database temporarily unavailable."}, status_code=503
    )


@app.get("/api/health")
def health():
    return {"status": "ok", "version": "2.0"}

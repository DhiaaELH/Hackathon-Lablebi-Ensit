import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .api import auth, classroom, community, courses, growth, insights, knowledge, learning, moderation, nova, social, system
from .config import get_settings
from .db import init_db
from .security import CSRF_HEADER, CSRF_VALUE

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="LessonForge API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in get_settings().cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def csrf_guard(request: Request, call_next):
    """Cookie sessions + SameSite=Lax, plus a required custom header on state-changing requests: browsers
    cannot add it cross-site without a CORS preflight that our allow-list rejects."""
    if request.method in ("POST", "PUT", "PATCH", "DELETE") and request.url.path.startswith("/api/"):
        if request.headers.get(CSRF_HEADER) != CSRF_VALUE:
            return JSONResponse({"detail": "Missing CSRF header"}, status_code=403)
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    return response


for r in (auth.router, courses.router, learning.router, nova.router, insights.router, community.router, system.router,
          social.router, knowledge.router, growth.router, moderation.router, classroom.router):
    app.include_router(r)

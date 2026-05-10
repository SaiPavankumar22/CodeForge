from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os

from core.database import connect_to_mongo, close_mongo_connection
from routers import questions, code, auth

app = FastAPI(
    title="CodeForge API",
    description="Online Coding Platform API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(questions.router)
app.include_router(code.router)
app.include_router(auth.router)


@app.on_event("startup")
async def startup():
    await connect_to_mongo()


@app.on_event("shutdown")
async def shutdown():
    await close_mongo_connection()


@app.get("/api/health")
async def health():
    return {"status": "ok", "app": "CodeForge"}


# Serve frontend static files if present
frontend_path = os.path.join(os.path.dirname(__file__), "..", "frontend")
if os.path.exists(frontend_path):
    # HTML + static/js + static/css are served as files under frontend/ (avoid mount vs catch‑all ordering issues)

    @app.get("/", include_in_schema=False)
    async def serve_index():
        return FileResponse(os.path.join(frontend_path, "index.html"))

    @app.get("/{path:path}", include_in_schema=False)
    async def serve_pages(path: str):
        file_path = os.path.join(frontend_path, path)
        if os.path.exists(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(frontend_path, "index.html"))

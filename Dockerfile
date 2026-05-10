# CodeForge: FastAPI + MongoDB client, with runtimes to execute user code
FROM python:3.11-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

# Compilers / interpreters used by services/executor.py (not the image’s Python — that is for the API only)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    g++ \
    gcc \
    default-jdk-headless \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Sanity check (fails build early if a package is missing)
RUN python3 --version && node --version && g++ --version && javac -version

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend ./backend
COPY frontend ./frontend

WORKDIR /app/backend

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

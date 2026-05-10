import os

from pydantic_settings import BaseSettings
from typing import Optional

_BACKEND_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))


class Settings(BaseSettings):
    MONGODB_URL: str = "mongodb://localhost:27017"
    DATABASE_NAME: str = "codeforge_db"
    ADMIN_EMAIL: str = "admin@codeforge.dev"
    ADMIN_PASSWORD: str = "Admin@123456"
    APP_SECRET_KEY: str = "your-super-secret-key-change-in-production"
    APP_ENV: str = "development"
    MAX_EXECUTION_TIME: int = 10
    MAX_MEMORY_MB: int = 256

    # Optional full paths if `python` / `node` / `g++` / `javac` are not on PATH (common on Windows)
    PYTHON_EXECUTABLE: Optional[str] = None
    NODE_EXECUTABLE: Optional[str] = None
    GPP_EXECUTABLE: Optional[str] = None
    JAVAC_EXECUTABLE: Optional[str] = None
    JAVA_EXECUTABLE: Optional[str] = None

    class Config:
        env_file = os.path.join(_BACKEND_ROOT, ".env")


settings = Settings()

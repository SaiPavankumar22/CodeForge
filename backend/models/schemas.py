from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum


class DifficultyLevel(str, Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"


class Language(str, Enum):
    PYTHON = "python"
    JAVA = "java"
    CPP = "cpp"
    JAVASCRIPT = "javascript"


class ExecutionStatus(str, Enum):
    ACCEPTED = "Accepted"
    WRONG_ANSWER = "Wrong Answer"
    RUNTIME_ERROR = "Runtime Error"
    TIME_LIMIT_EXCEEDED = "Time Limit Exceeded"
    COMPILATION_ERROR = "Compilation Error"
    PENDING = "Pending"


class TestCase(BaseModel):
    input: str
    expected_output: str
    is_public: bool = True
    description: Optional[str] = None


class QuestionCreate(BaseModel):
    title: str
    slug: Optional[str] = None
    difficulty: DifficultyLevel = DifficultyLevel.MEDIUM
    description: str
    constraints: str
    sample_input: str
    sample_output: str
    tags: List[str] = []
    time_limit_seconds: int = 5
    memory_limit_mb: int = 256
    test_cases: List[TestCase] = []
    starter_code: Optional[Dict[str, str]] = None


class QuestionUpdate(BaseModel):
    title: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    description: Optional[str] = None
    constraints: Optional[str] = None
    sample_input: Optional[str] = None
    sample_output: Optional[str] = None
    tags: Optional[List[str]] = None
    time_limit_seconds: Optional[int] = None
    memory_limit_mb: Optional[int] = None
    test_cases: Optional[List[TestCase]] = None
    starter_code: Optional[Dict[str, str]] = None
    is_active: Optional[bool] = None


class QuestionResponse(BaseModel):
    id: str
    title: str
    slug: str
    difficulty: DifficultyLevel
    description: str
    constraints: str
    sample_input: str
    sample_output: str
    tags: List[str]
    time_limit_seconds: int
    memory_limit_mb: int
    public_test_cases: List[TestCase]
    starter_code: Optional[Dict[str, str]]
    is_active: bool
    created_at: datetime
    total_submissions: int = 0
    accepted_submissions: int = 0


class QuestionListItem(BaseModel):
    id: str
    title: str
    slug: str
    difficulty: DifficultyLevel
    tags: List[str]
    is_active: bool
    total_submissions: int = 0
    accepted_submissions: int = 0


class RunCodeRequest(BaseModel):
    question_id: str
    language: Language
    code: str


class SubmitCodeRequest(BaseModel):
    question_id: str
    language: Language
    code: str
    user_identifier: Optional[str] = "anonymous"


class TestCaseResult(BaseModel):
    test_case_number: int
    input: str
    expected_output: str
    actual_output: str
    passed: bool
    execution_time_ms: float
    status: ExecutionStatus
    is_public: bool


class RunCodeResponse(BaseModel):
    status: ExecutionStatus
    test_results: List[TestCaseResult]
    total_tests: int
    passed_tests: int
    execution_time_ms: float
    error_message: Optional[str] = None


class SubmissionResponse(BaseModel):
    submission_id: str
    status: ExecutionStatus
    score: float
    total_tests: int
    passed_tests: int
    execution_time_ms: float
    language: Language
    submitted_at: datetime
    test_results: List[TestCaseResult]


class AdminLoginRequest(BaseModel):
    email: str
    password: str


class AdminLoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    message: str

from bson import ObjectId
from datetime import datetime
from typing import List
from core.database import get_database
from models.schemas import (
    SubmissionResponse, RunCodeResponse, TestCaseResult,
    ExecutionStatus, Language
)
from services.executor import execute_code, compare_output


async def run_against_public_tests(question_doc: dict, language: Language, code: str) -> RunCodeResponse:
    """Run code against public test cases only."""
    public_tests = [tc for tc in question_doc.get("test_cases", []) if tc.get("is_public", True)]
    time_limit = question_doc.get("time_limit_seconds", 5)

    results = []
    total_time = 0.0

    for idx, tc in enumerate(public_tests, 1):
        stdout, stderr, status, elapsed = execute_code(language, code, tc["input"], time_limit)

        passed = False
        if status == ExecutionStatus.ACCEPTED:
            passed = compare_output(stdout, tc["expected_output"])
            if not passed:
                status = ExecutionStatus.WRONG_ANSWER

        results.append(TestCaseResult(
            test_case_number=idx,
            input=tc["input"],
            expected_output=tc["expected_output"],
            actual_output=stdout if status != ExecutionStatus.RUNTIME_ERROR else stderr,
            passed=passed,
            execution_time_ms=elapsed,
            status=status,
            is_public=True,
        ))
        total_time += elapsed

    passed_count = sum(1 for r in results if r.passed)
    overall_status = ExecutionStatus.ACCEPTED if passed_count == len(results) else ExecutionStatus.WRONG_ANSWER
    if results:
        for r in results:
            if r.status in (ExecutionStatus.RUNTIME_ERROR, ExecutionStatus.TIME_LIMIT_EXCEEDED, ExecutionStatus.COMPILATION_ERROR):
                overall_status = r.status
                break

    return RunCodeResponse(
        status=overall_status,
        test_results=results,
        total_tests=len(public_tests),
        passed_tests=passed_count,
        execution_time_ms=total_time,
        error_message=None,
    )


async def run_against_all_tests(question_doc: dict, language: Language, code: str) -> tuple:
    """Run code against ALL test cases (public + private). Returns (results, stats)."""
    all_tests = question_doc.get("test_cases", [])
    time_limit = question_doc.get("time_limit_seconds", 5)

    results = []
    total_time = 0.0

    for idx, tc in enumerate(all_tests, 1):
        stdout, stderr, status, elapsed = execute_code(language, code, tc["input"], time_limit)

        passed = False
        if status == ExecutionStatus.ACCEPTED:
            passed = compare_output(stdout, tc["expected_output"])
            if not passed:
                status = ExecutionStatus.WRONG_ANSWER

        results.append(TestCaseResult(
            test_case_number=idx,
            input=tc["input"] if tc.get("is_public", True) else "***hidden***",
            expected_output=tc["expected_output"] if tc.get("is_public", True) else "***hidden***",
            actual_output=stdout if status != ExecutionStatus.RUNTIME_ERROR else stderr,
            passed=passed,
            execution_time_ms=elapsed,
            status=status,
            is_public=tc.get("is_public", True),
        ))
        total_time += elapsed

    passed_count = sum(1 for r in results if r.passed)
    return results, passed_count, len(all_tests), total_time


async def save_submission(
    question_id: str,
    language: Language,
    code: str,
    user_identifier: str,
    results: list,
    passed: int,
    total: int,
    elapsed: float,
    status: ExecutionStatus,
) -> str:
    db = get_database()
    score = round((passed / total * 100) if total > 0 else 0.0, 2)

    doc = {
        "question_id": question_id,
        "language": language,
        "code": code,
        "user_identifier": user_identifier,
        "status": status,
        "score": score,
        "total_tests": total,
        "passed_tests": passed,
        "execution_time_ms": elapsed,
        "test_results": [r.model_dump() for r in results],
        "submitted_at": datetime.utcnow(),
    }

    result = await db.submissions.insert_one(doc)
    return str(result.inserted_id)


async def get_submissions_for_question(question_id: str, user_identifier: str = None):
    db = get_database()
    query = {"question_id": question_id}
    if user_identifier:
        query["user_identifier"] = user_identifier
    cursor = db.submissions.find(query).sort("submitted_at", -1).limit(50)
    submissions = []
    async for doc in cursor:
        submissions.append({
            "id": str(doc["_id"]),
            "language": doc.get("language"),
            "status": doc.get("status"),
            "score": doc.get("score"),
            "passed_tests": doc.get("passed_tests"),
            "total_tests": doc.get("total_tests"),
            "submitted_at": doc.get("submitted_at").isoformat() if doc.get("submitted_at") else None,
        })
    return submissions

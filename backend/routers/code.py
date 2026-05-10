from fastapi import APIRouter, HTTPException
from datetime import datetime
from models.schemas import (
    RunCodeRequest, RunCodeResponse,
    SubmitCodeRequest, SubmissionResponse, ExecutionStatus
)
from services import question_service, submission_service

router = APIRouter(prefix="/api/code", tags=["code"])


@router.post("/run", response_model=RunCodeResponse)
async def run_code(request: RunCodeRequest):
    """Run code against public test cases (unlimited runs allowed)."""
    question_doc = await question_service.get_question_with_all_tests(request.question_id)
    if not question_doc:
        raise HTTPException(status_code=404, detail="Question not found")

    result = await submission_service.run_against_public_tests(
        question_doc, request.language, request.code
    )
    return result


@router.post("/submit", response_model=SubmissionResponse)
async def submit_code(request: SubmitCodeRequest):
    """Submit code — runs against ALL test cases and saves to DB."""
    question_doc = await question_service.get_question_with_all_tests(request.question_id)
    if not question_doc:
        raise HTTPException(status_code=404, detail="Question not found")

    results, passed, total, elapsed = await submission_service.run_against_all_tests(
        question_doc, request.language, request.code
    )

    # Determine overall status
    if not results:
        overall_status = ExecutionStatus.RUNTIME_ERROR
    elif any(r.status == ExecutionStatus.COMPILATION_ERROR for r in results):
        overall_status = ExecutionStatus.COMPILATION_ERROR
    elif any(r.status == ExecutionStatus.TIME_LIMIT_EXCEEDED for r in results):
        overall_status = ExecutionStatus.TIME_LIMIT_EXCEEDED
    elif any(r.status == ExecutionStatus.RUNTIME_ERROR for r in results):
        overall_status = ExecutionStatus.RUNTIME_ERROR
    elif passed == total:
        overall_status = ExecutionStatus.ACCEPTED
    else:
        overall_status = ExecutionStatus.WRONG_ANSWER

    # Save submission
    submission_id = await submission_service.save_submission(
        question_id=request.question_id,
        language=request.language,
        code=request.code,
        user_identifier=request.user_identifier or "anonymous",
        results=results,
        passed=passed,
        total=total,
        elapsed=elapsed,
        status=overall_status,
    )

    # Update question stats
    await question_service.increment_submission_count(
        request.question_id, overall_status == ExecutionStatus.ACCEPTED
    )

    score = round((passed / total * 100) if total > 0 else 0.0, 2)

    return SubmissionResponse(
        submission_id=submission_id,
        status=overall_status,
        score=score,
        total_tests=total,
        passed_tests=passed,
        execution_time_ms=elapsed,
        language=request.language,
        submitted_at=datetime.utcnow(),
        test_results=results,
    )


@router.get("/submissions/{question_id}")
async def get_submissions(question_id: str, user: str = None):
    """Get submission history for a question."""
    return await submission_service.get_submissions_for_question(question_id, user)

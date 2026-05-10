from fastapi import APIRouter, HTTPException, Header, Depends
from typing import List, Optional
from models.schemas import QuestionCreate, QuestionUpdate, QuestionResponse, QuestionListItem
from services import question_service
from services.auth_service import verify_admin_token

router = APIRouter(prefix="/api/questions", tags=["questions"])


def require_admin(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Admin authentication required")
    token = authorization[7:]
    if not verify_admin_token(token):
        raise HTTPException(status_code=401, detail="Invalid or expired admin token")
    return True


@router.get("", response_model=List[QuestionListItem])
async def list_questions():
    """Get all active questions (public endpoint)."""
    return await question_service.get_all_questions(active_only=True)


@router.get("/all", response_model=List[QuestionListItem])
async def list_all_questions(admin: bool = Depends(require_admin)):
    """Get all questions including inactive (admin only)."""
    return await question_service.get_all_questions(active_only=False)


@router.post("", response_model=QuestionResponse)
async def create_question(data: QuestionCreate, admin: bool = Depends(require_admin)):
    """Create a new question (admin only)."""
    return await question_service.create_question(data)


@router.get("/{question_id}", response_model=QuestionResponse)
async def get_question(question_id: str):
    """Get question details with public test cases."""
    question = await question_service.get_question_by_id(question_id)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@router.put("/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: str,
    data: QuestionUpdate,
    admin: bool = Depends(require_admin)
):
    """Update question (admin only)."""
    question = await question_service.update_question(question_id, data)
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")
    return question


@router.delete("/{question_id}")
async def delete_question(question_id: str, admin: bool = Depends(require_admin)):
    """Delete question (admin only)."""
    deleted = await question_service.delete_question(question_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Question not found")
    return {"message": "Question deleted successfully"}

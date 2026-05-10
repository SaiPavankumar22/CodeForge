from bson import ObjectId
from datetime import datetime
from typing import List, Optional, Dict, Any
from core.database import get_database
from models.schemas import QuestionCreate, QuestionUpdate, QuestionResponse, QuestionListItem, TestCase
import re


_STARTER_KEYS = frozenset({"python", "javascript", "java", "cpp"})


def normalize_starter_code(raw: Optional[Dict[str, Any]]) -> Optional[Dict[str, str]]:
    """Map any-case / stray keys to python|javascript|java|cpp strings."""
    if not raw:
        return raw
    out: Dict[str, str] = {}
    for k, v in raw.items():
        if not isinstance(k, str) or not isinstance(v, str):
            continue
        key = k.lower().strip()
        if key in _STARTER_KEYS:
            out[key] = v
    return out or None


def slugify(text: str) -> str:
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text


def question_doc_to_response(doc: dict) -> QuestionResponse:
    public_tests = [
        TestCase(**tc) for tc in doc.get("test_cases", []) if tc.get("is_public", True)
    ]
    return QuestionResponse(
        id=str(doc["_id"]),
        title=doc["title"],
        slug=doc.get("slug", ""),
        difficulty=doc["difficulty"],
        description=doc["description"],
        constraints=doc.get("constraints", ""),
        sample_input=doc.get("sample_input", ""),
        sample_output=doc.get("sample_output", ""),
        tags=doc.get("tags", []),
        time_limit_seconds=doc.get("time_limit_seconds", 5),
        memory_limit_mb=doc.get("memory_limit_mb", 256),
        public_test_cases=public_tests,
        starter_code=normalize_starter_code(doc.get("starter_code")),
        is_active=doc.get("is_active", True),
        created_at=doc.get("created_at", datetime.utcnow()),
        total_submissions=doc.get("total_submissions", 0),
        accepted_submissions=doc.get("accepted_submissions", 0),
    )


async def create_question(data: QuestionCreate) -> dict:
    db = get_database()
    slug = data.slug or slugify(data.title)

    # Ensure unique slug
    existing = await db.questions.find_one({"slug": slug})
    if existing:
        slug = f"{slug}-{int(datetime.utcnow().timestamp())}"

    doc = {
        "title": data.title,
        "slug": slug,
        "difficulty": data.difficulty,
        "description": data.description,
        "constraints": data.constraints,
        "sample_input": data.sample_input,
        "sample_output": data.sample_output,
        "tags": data.tags,
        "time_limit_seconds": data.time_limit_seconds,
        "memory_limit_mb": data.memory_limit_mb,
        "test_cases": [tc.model_dump() for tc in data.test_cases],
        "starter_code": normalize_starter_code(data.starter_code) or {},
        "is_active": True,
        "created_at": datetime.utcnow(),
        "total_submissions": 0,
        "accepted_submissions": 0,
    }

    result = await db.questions.insert_one(doc)
    doc["_id"] = result.inserted_id
    return question_doc_to_response(doc)


async def get_all_questions(active_only: bool = True) -> List[QuestionListItem]:
    db = get_database()
    query = {"is_active": True} if active_only else {}
    cursor = db.questions.find(query, {
        "title": 1, "slug": 1, "difficulty": 1, "tags": 1,
        "is_active": 1, "total_submissions": 1, "accepted_submissions": 1
    })
    questions = []
    async for doc in cursor:
        questions.append(QuestionListItem(
            id=str(doc["_id"]),
            title=doc["title"],
            slug=doc.get("slug", ""),
            difficulty=doc["difficulty"],
            tags=doc.get("tags", []),
            is_active=doc.get("is_active", True),
            total_submissions=doc.get("total_submissions", 0),
            accepted_submissions=doc.get("accepted_submissions", 0),
        ))
    return questions


async def get_question_by_id(question_id: str) -> Optional[QuestionResponse]:
    db = get_database()
    try:
        doc = await db.questions.find_one({"_id": ObjectId(question_id)})
    except Exception:
        doc = await db.questions.find_one({"slug": question_id})
    if not doc:
        return None
    return question_doc_to_response(doc)


async def get_question_with_all_tests(question_id: str) -> Optional[dict]:
    """Get question including private test cases (for execution)."""
    db = get_database()
    try:
        doc = await db.questions.find_one({"_id": ObjectId(question_id)})
    except Exception:
        doc = await db.questions.find_one({"slug": question_id})
    return doc


async def update_question(question_id: str, data: QuestionUpdate) -> Optional[QuestionResponse]:
    db = get_database()
    update_data = {k: v for k, v in data.model_dump().items() if v is not None}
    if "test_cases" in update_data:
        update_data["test_cases"] = [tc if isinstance(tc, dict) else tc.model_dump() for tc in update_data["test_cases"]]
    if "starter_code" in update_data:
        update_data["starter_code"] = normalize_starter_code(update_data["starter_code"]) or {}
    if not update_data:
        return await get_question_by_id(question_id)
    await db.questions.update_one({"_id": ObjectId(question_id)}, {"$set": update_data})
    return await get_question_by_id(question_id)


async def delete_question(question_id: str) -> bool:
    db = get_database()
    result = await db.questions.delete_one({"_id": ObjectId(question_id)})
    return result.deleted_count > 0


async def increment_submission_count(question_id: str, accepted: bool):
    db = get_database()
    inc = {"total_submissions": 1}
    if accepted:
        inc["accepted_submissions"] = 1
    try:
        await db.questions.update_one({"_id": ObjectId(question_id)}, {"$inc": inc})
    except Exception:
        pass

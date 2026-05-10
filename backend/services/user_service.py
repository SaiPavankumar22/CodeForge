from bson import ObjectId
from datetime import datetime
from typing import Optional, List

from core.database import get_database
from services.auth_service import hash_password, verify_password


async def register_user(username: str, email: str, password: str) -> dict:
    db = get_database()
    if await db.users.find_one({"email": email.lower()}):
        raise ValueError("Email already registered")
    if await db.users.find_one({"username_lower": username.lower()}):
        raise ValueError("Username already taken")

    doc = {
        "username": username,
        "username_lower": username.lower(),
        "email": email.lower(),
        "hashed_password": hash_password(password),
        "created_at": datetime.utcnow(),
    }
    result = await db.users.insert_one(doc)
    doc["_id"] = result.inserted_id
    return doc


async def login_user(email: str, password: str) -> Optional[dict]:
    db = get_database()
    user = await db.users.find_one({"email": email.lower()})
    if not user or not verify_password(password, user["hashed_password"]):
        return None
    return user


async def get_user_by_id(user_id: str) -> Optional[dict]:
    db = get_database()
    try:
        return await db.users.find_one({"_id": ObjectId(user_id)})
    except Exception:
        return None


async def get_user_solved_ids(user_id: str) -> List[str]:
    """Returns list of question_ids that have been accepted by this user."""
    db = get_database()
    cursor = db.user_progress.find(
        {"user_id": user_id, "status": "solved"},
        {"question_id": 1}
    )
    return [doc["question_id"] async for doc in cursor]


async def mark_problem_solved(user_id: str, question_id: str):
    """Upsert: mark a problem as solved; preserve first_solved_at."""
    db = get_database()
    await db.user_progress.update_one(
        {"user_id": user_id, "question_id": question_id},
        {
            "$set": {"status": "solved", "solved_at": datetime.utcnow()},
            "$setOnInsert": {
                "user_id": user_id,
                "question_id": question_id,
                "first_solved_at": datetime.utcnow(),
            },
        },
        upsert=True,
    )

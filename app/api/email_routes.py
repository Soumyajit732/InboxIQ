from fastapi import APIRouter, HTTPException
from typing import List, Dict
from datetime import datetime

from app.services.nlp_service import analyze_email_thread
from app.services.gmail_service import fetch_threads
from app.services import nlp_service, priority_service
from app.services.thread_service import process_all_threads

from app.db.database import SessionLocal
from app.db.models import Email
from app.utils.pipeline_utils import (
    deduplicate_tasks,
    sort_by_priority,
    filter_low_confidence
)
import time
from concurrent.futures import ThreadPoolExecutor

CACHE = {
    "data": None,
    "timestamp": None
}

router = APIRouter()


# 🔹 SIMPLE ANALYZE (MANUAL INPUT)
@router.post("/analyze")
def analyze_email(data: dict):
    messages = data.get("messages", [])

    if not messages:
        raise HTTPException(status_code=400, detail="No messages provided")

    return analyze_email_thread(messages)


@router.get("/gmail")
def get_gmail_analysis(token: str):
    try:
        if not token or token == "null":
            raise HTTPException(status_code=400, detail="Invalid token")

        print("TOKEN RECEIVED:", token[:20])

        now = time.time()

        if token in CACHE and (now - CACHE[token]["timestamp"] < 60):
            print("⚡ Returning cached data")
            return CACHE[token]["data"]

        threads = fetch_threads(token, 20)

        def process_thread(t):
            messages = t.get("messages", [])
            thread_id = t.get("thread_id")

            if not messages:
                return None

            result = analyze_email_thread(messages)

            if not result or result.get("task") is None:
                return None

            result["thread_id"] = thread_id
            return result

        with ThreadPoolExecutor(max_workers=5) as executor:
            results = list(filter(None, executor.map(process_thread, threads)))

        results = filter_low_confidence(results)
        results = sort_by_priority(results)

        response = {
            "total_tasks": len(results),
            "tasks": results
        }

        CACHE[token] = {
            "data": response,
            "timestamp": now
        }

        return response

    except Exception as e:
        print("GMAIL ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))


# 🔥 THREAD PROCESSING API (ADVANCED)
@router.post("/process-all-threads")
def process_threads(emails: List[Dict]):
    try:
        results = process_all_threads(emails)

        for r in results:
            r["priority"] = priority_service.compute_priority(
                r.get("combined_text", ""),
                r.get("deadline"),
                "thread"
            )

        return results

    except Exception as e:
        print("THREAD ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))


# 🔥 SINGLE EMAIL + DB STORAGE
@router.post("/process-email")
def process_email(email: dict):
    db = SessionLocal()

    try:
        # convert timestamp safely
        timestamp = datetime.fromisoformat(email["timestamp"])

        new_email = Email(
            email_id=email["email_id"],
            thread_id=email["thread_id"],
            sender=email["sender"],
            subject=email["subject"],
            body=email["body"],
            timestamp=timestamp
        )

        db.add(new_email)
        db.commit()

        # NLP extraction
        result = nlp_service.extract_task_and_deadline(email["body"])

        # Priority calculation
        priority = priority_service.compute_priority(
            result["task"],
            result["deadline"],
            email["sender"]
        )

        return {
            "task": result["task"],
            "deadline": result["deadline"],
            "priority": priority
        }

    except Exception as e:
        db.rollback()
        print("EMAIL ERROR:", e)
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        db.close()
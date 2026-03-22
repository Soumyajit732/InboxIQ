from typing import List, Dict
from datetime import datetime
from app.services.nlp_service import analyze_email_thread
from app.services.priority_service import compute_priority


def parse_timestamp(ts):
    try:
        return datetime.fromisoformat(ts)
    except:
        return datetime.min


def group_by_thread(emails: List[Dict]) -> Dict[str, List[Dict]]:
    threads = {}

    for email in emails:
        tid = email.get("thread_id", "unknown_thread")

        if tid not in threads:
            threads[tid] = []

        threads[tid].append(email)

    return threads


def combine_thread_emails(thread_emails: List[Dict]) -> str:
    combined_text = ""

    thread_emails = sorted(
        thread_emails,
        key=lambda x: parse_timestamp(x.get("timestamp"))
    )

    for email in thread_emails:
        body = email.get("body")
        if body:
            combined_text += body.strip() + "\n"

    return combined_text.strip()


def process_single_thread(thread_id: str, thread_emails: List[Dict]) -> Dict:
    combined_text = combine_thread_emails(thread_emails)

    extracted = extract_from_thread(combined_text)

    priority = compute_priority(
        combined_text,
        extracted.get("deadline"),
        "thread"
    )

    return {
        "thread_id": thread_id,
        "combined_text": combined_text,
        "task": extracted.get("task"),
        "deadline": extracted.get("deadline"),
        "priority": priority
    }


def process_all_threads(emails: List[Dict]) -> List[Dict]:
    threads = group_by_thread(emails)

    results = []

    for thread_id, thread_emails in threads.items():
        processed = process_single_thread(thread_id, thread_emails)
        results.append(processed)

    return results
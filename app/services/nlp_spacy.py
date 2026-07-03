import os
import dateparser
from datetime import datetime
from fastapi import APIRouter

try:
    import spacy
    nlp = spacy.load("en_core_web_sm")
except Exception:
    os.system("python -m spacy download en_core_web_sm")
    import spacy
    nlp = spacy.load("en_core_web_sm")

router = APIRouter()


@router.post("/spacy-analyze")
def spacy_analyze(body: dict):
    text = body.get("text", "")
    deadline = None

    doc = nlp(text)
    for ent in doc.ents:
        if ent.label_ == "DATE":
            parsed = dateparser.parse(
                ent.text,
                settings={
                    "PREFER_DATES_FROM": "future",
                    "RELATIVE_BASE": datetime.now(),
                    "RETURN_AS_TIMEZONE_AWARE": False,
                },
            )
            if parsed:
                deadline = parsed

    if deadline and deadline.hour == 0:
        deadline = deadline.replace(hour=17)

    return {
        "task": "Derived from conversation",
        "deadline": deadline.isoformat() if deadline else None,
        "priority": 2,
        "summary": text[:100],
        "confidence": 0.5,
    }

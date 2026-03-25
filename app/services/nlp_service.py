import spacy
import dateparser
import json
from datetime import datetime
from openai import OpenAI
from app.config import OPENAI_API_KEY
from datetime import datetime

# nlp = spacy.load("en_core_web_sm")
try:
    nlp = spacy.load("en_core_web_sm")
except:
    import os
    os.system("python -m spacy download en_core_web_sm")
    nlp = spacy.load("en_core_web_sm")
client = OpenAI(api_key=OPENAI_API_KEY)


# 🔥 MAIN ENTRY
def analyze_email_thread(messages: list[str]):
    if not messages:
        return empty_response()

    combined_text = "\n---\n".join(messages)

    ai_result = analyze_with_ai(combined_text)

    if ai_result:
        return normalize_response(ai_result)

    return analyze_with_spacy(combined_text)


# 🔹 AI PROCESSING (FIXED)
def analyze_with_ai(text: str):
    try:
        today = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

        response = client.chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": f"""
You are an advanced email intelligence system.

Today's datetime: {today}

Context:
- Messages are ordered from oldest → latest
- The LAST message contains the FINAL decision

Rules:
- Always prioritize the latest message
- Interpret relative dates like "tomorrow", "next Monday" using today's date
- Extract only actionable tasks
- Extract time if mentioned (e.g., "5 pm")
- Ignore promotional emails

Return STRICT JSON:
{{
  "task": string or null,
  "deadline": ISO datetime or null,
  "priority": 1-5,
  "summary": string,
  "confidence": 0-1
}}

If no task:
{{
  "task": null,
  "deadline": null,
  "priority": 1,
  "summary": "No actionable task",
  "confidence": 0.5
}}
"""
                },
                {
                    "role": "user",
                    "content": text
                }
            ],
            temperature=0.2
        )

        content = response.choices[0].message.content
        return json.loads(content)

    except Exception as e:
        print("⚠️ AI failed:", e)
        return None


# 🔹 SPACY FALLBACK (FIXED)
def analyze_with_spacy(text: str):
    doc = nlp(text)

    deadline = None

    for ent in doc.ents:
        if ent.label_ == "DATE":
            parsed_date = dateparser.parse(
                ent.text,
                settings={
                    "PREFER_DATES_FROM": "future",
                    "RELATIVE_BASE": datetime.now(),
                    "RETURN_AS_TIMEZONE_AWARE": False
                }
            )
            if parsed_date:
                deadline = parsed_date

    # 🔥 HANDLE DEFAULT TIME (if only date)
    if deadline and deadline.hour == 0:
        deadline = deadline.replace(hour=17)  # assume 5 PM

    return normalize_response({
        "task": "Derived from conversation",
        "deadline": deadline.isoformat() if deadline else None,
        "priority": 2,
        "summary": text[:100],
        "confidence": 0.5
    })


def compute_priority(task: str, deadline: str):
    score = 1  # base

    now = datetime.now()

    # 🔹 DEADLINE BASED
    if deadline:
        try:
            d = datetime.fromisoformat(deadline)
            diff_hours = (d - now).total_seconds() / 3600

            if diff_hours < 0:
                return 5  # expired = critical

            elif diff_hours <= 6:
                score += 4  # 🔥 very urgent

            elif diff_hours <= 24:
                score += 3

            elif diff_hours <= 72:
                score += 2

            else:
                score += 1

        except:
            pass

    # 🔹 KEYWORD BOOST
    text = (task or "").lower()

    high_keywords = [
        "submit", "deadline", "urgent", "asap",
        "important", "immediately", "due"
    ]

    medium_keywords = [
        "meeting", "schedule", "review",
        "prepare", "join", "attend"
    ]

    if any(k in text for k in high_keywords):
        score += 2

    elif any(k in text for k in medium_keywords):
        score += 1

    # 🔹 NORMALIZE (1–5)
    return max(1, min(5, score))

# 🔥 NORMALIZATION (SAFE)
def normalize_response(data):
    task = data.get("task")
    deadline = normalize_deadline(data.get("deadline"))

    # 🔥 override AI priority with our logic
    priority = compute_priority(task, deadline)

    return {
        "task": task,
        "deadline": deadline,
        "priority": priority,
        "summary": data.get("summary", ""),
        "confidence": float(data.get("confidence", 0.5))
    }


# 🔥 DEADLINE NORMALIZER (VERY IMPORTANT)
def normalize_deadline(deadline):
    if not deadline:
        return None

    try:
        # if already ISO
        if isinstance(deadline, str):
            parsed = dateparser.parse(
                deadline,
                settings={
                    "PREFER_DATES_FROM": "future",
                    "RELATIVE_BASE": datetime.now()
                }
            )
        else:
            parsed = deadline

        if not parsed:
            return None

        # default time fix
        if parsed.hour == 0:
            parsed = parsed.replace(hour=17)

        return parsed.isoformat()

    except:
        return None


# 🔥 EMPTY RESPONSE
def empty_response():
    return {
        "task": None,
        "deadline": None,
        "priority": 1,
        "summary": "No actionable task",
        "confidence": 0.0
    }
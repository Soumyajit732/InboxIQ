import os
import re
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

# Before Node sends email text to OpenAI, it calls this service to remove common
# boilerplate and replace direct identifiers with placeholders. The mapping is
# returned only to Node over the internal service connection, never to OpenAI.
MAX_LLM_INPUT_CHARS = 6_000
ENTITY_LABELS = {"PERSON", "ORG", "GPE", "LOC", "FAC"}
PATTERNS = (
    ("EMAIL", re.compile(r"(?<![\w.+-])[\w.+-]+@[\w-]+(?:\.[\w-]+)+(?![\w.-])")),
    ("PHONE", re.compile(r"(?<!\w)(?:\+?\d[\d().\s-]{7,}\d)(?!\w)")),
    ("CARD", re.compile(r"(?<!\d)(?:\d[ -]?){13,19}(?!\d)")),
)


def _strip_email_boilerplate(text: str) -> str:
    """Remove quoted replies and standard signature separators conservatively."""
    kept = []
    for line in text.splitlines():
        stripped = line.strip()
        if stripped == "--" or stripped == "-----Original Message-----":
            break
        if re.match(r"^On .+ wrote:$", stripped):
            break
        if stripped.startswith(">"):
            continue
        kept.append(line)
    return re.sub(r"\n{3,}", "\n\n", "\n".join(kept)).strip()


def _next_placeholder(label: str, redactions: dict[str, str]) -> str:
    prefix = f"[{label}_"
    number = sum(key.startswith(prefix) for key in redactions) + 1
    return f"[{label}_{number}]"


def sanitize_email_text(text: str) -> dict:
    """Return minimized LLM input and a server-only placeholder restoration map."""
    sanitized = _strip_email_boilerplate(text or "")
    redactions: dict[str, str] = {}

    for label, pattern in PATTERNS:
        def replace_match(match):
            placeholder = _next_placeholder(label, redactions)
            redactions[placeholder] = match.group(0)
            return placeholder

        sanitized = pattern.sub(replace_match, sanitized)

    # spaCy makes a contextual pass for direct identifiers that do not have
    # reliable regular-expression formats, such as people or companies.
    doc = nlp(sanitized)
    for entity in reversed(doc.ents):
        if entity.label_ not in ENTITY_LABELS:
            continue
        placeholder = _next_placeholder(entity.label_, redactions)
        redactions[placeholder] = entity.text
        sanitized = f"{sanitized[:entity.start_char]}{placeholder}{sanitized[entity.end_char:]}"

    was_truncated = len(sanitized) > MAX_LLM_INPUT_CHARS
    return {
        "sanitized_text": sanitized[:MAX_LLM_INPUT_CHARS],
        "redactions": redactions,
        "truncated": was_truncated,
    }


@router.post("/sanitize-email")
def sanitize_email_endpoint(body: dict):
    return sanitize_email_text(body.get("text", ""))


@router.post("/spacy-analyze")
def spacy_analyze(body: dict):
    text = body.get("text", "")
    deadline = None
    matched_text = None

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
                matched_text = ent.text

    if deadline and deadline.hour == 0:
        deadline = deadline.replace(hour=17)

    reasoning = (
        f'Deadline parsed from "{matched_text}" via spaCy+dateparser (LLM extraction was unavailable).'
        if matched_text else None
    )

    return {
        "task": "Derived from conversation",
        "deadline": deadline.isoformat() if deadline else None,
        "priority": 2,
        "summary": text[:100],
        "confidence": 0.5,
        "source_snippet": matched_text,
        "reasoning": reasoning,
        "deadline_source": "spacy" if deadline else None,
    }

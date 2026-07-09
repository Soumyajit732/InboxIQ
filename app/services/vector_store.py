import chromadb
from openai import OpenAI
from fastapi import APIRouter
from typing import Optional
from app.config import OPENAI_API_KEY

_openai = OpenAI(api_key=OPENAI_API_KEY)
_chroma = chromadb.PersistentClient(path="./chroma_db")
router = APIRouter()
_collection = _chroma.get_or_create_collection(
    name="emails",
    metadata={"hnsw:space": "cosine"},
)


def _embed(text: str) -> list[float]:
    response = _openai.embeddings.create(
        model="text-embedding-3-small",
        input=text,
    )
    return response.data[0].embedding


def _doc_id(user_email: str, thread_id: str) -> str:
    # Node owns the actual task data (SQLite); Chroma only ever holds an embedding
    # plus enough metadata to pre-filter a search. Composite ID keeps the same
    # cross-user isolation guarantee SQLite's composite primary key gives -- two
    # users can never collide on the same Chroma document even with the same
    # thread_id.
    return f"{user_email}::{thread_id}"


def store_email(user_email: str, thread_id: str, doc_text: str, priority: int, deadline: str, sender: str):
    embedding = _embed(doc_text)
    _collection.upsert(
        ids=[_doc_id(user_email, thread_id)],
        embeddings=[embedding],
        metadatas=[{
            "user_email": user_email,
            "thread_id": thread_id,
            "priority": priority or 1,
            "deadline": deadline or "",
            "sender": sender or "",
        }],
    )


def search_emails(
    user_email: str,
    query: str,
    priority_min: Optional[int] = None,
    before: Optional[str] = None,
    after: Optional[str] = None,
    sender: Optional[str] = None,
    top_k: int = 5,
) -> list[dict]:
    count = _collection.count()
    if count == 0:
        return []

    where = {"user_email": {"$eq": user_email}}
    if priority_min is not None:
        where = {"$and": [where, {"priority": {"$gte": priority_min}}]}

    query_embedding = _embed(query)
    # Chroma's `where` handles user_email/priority; deadline range and sender
    # substring matching aren't expressible in its metadata query language, so
    # fetch every match for this user (small at this project's scale, same
    # brute-force-is-fine reasoning used elsewhere in this codebase) and finish
    # filtering in Python before ranking.
    results = _collection.query(
        query_embeddings=[query_embedding],
        n_results=count,
        where=where,
        include=["metadatas", "distances"],
    )

    output = []
    metadatas = results["metadatas"][0] if results["metadatas"] else []
    distances = results["distances"][0] if results["distances"] else []
    for meta, distance in zip(metadatas, distances):
        if sender and sender.lower() not in (meta.get("sender") or "").lower():
            continue
        meta_deadline = meta.get("deadline") or None
        if before and (not meta_deadline or meta_deadline > before):
            continue
        if after and (not meta_deadline or meta_deadline < after):
            continue
        output.append({
            "thread_id": meta.get("thread_id"),
            "relevance_score": round(1 - distance, 3),
        })

    output.sort(key=lambda r: r["relevance_score"], reverse=True)
    return output[:top_k]


@router.post("/vector/store")
def vector_store_endpoint(body: dict):
    store_email(
        user_email=body["user_email"],
        thread_id=body["thread_id"],
        doc_text=body.get("doc_text", ""),
        priority=body.get("priority", 1),
        deadline=body.get("deadline", ""),
        sender=body.get("sender", ""),
    )
    return {"status": "stored"}


@router.get("/vector/search")
def vector_search_endpoint(
    user_email: str,
    q: str,
    top_k: int = 5,
    priority_min: Optional[int] = None,
    before: Optional[str] = None,
    after: Optional[str] = None,
    sender: Optional[str] = None,
):
    results = search_emails(user_email, q.strip(), priority_min, before, after, sender, top_k)
    return {"query": q, "results": results}

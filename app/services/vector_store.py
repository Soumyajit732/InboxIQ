import chromadb
from openai import OpenAI
from app.config import OPENAI_API_KEY

_openai = OpenAI(api_key=OPENAI_API_KEY)
_chroma = chromadb.PersistentClient(path="./chroma_db")
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


def store_email(thread_id: str, email_text: str, task: str, deadline: str, priority: int, summary: str, confidence: float):
    doc = f"Task: {task}\nSummary: {summary}\nEmail: {email_text[:600]}"
    embedding = _embed(doc)
    _collection.upsert(
        ids=[thread_id],
        embeddings=[embedding],
        documents=[doc],
        metadatas=[{
            "thread_id": thread_id,
            "task": task or "",
            "deadline": deadline or "",
            "priority": priority,
            "summary": summary or "",
            "confidence": confidence,
        }],
    )


def search_emails(query: str, top_k: int = 5) -> list[dict]:
    count = _collection.count()
    if count == 0:
        return []

    query_embedding = _embed(query)
    n = min(top_k, count)
    results = _collection.query(
        query_embeddings=[query_embedding],
        n_results=n,
        include=["documents", "metadatas", "distances"],
    )

    output = []
    for i, meta in enumerate(results["metadatas"][0]):
        distance = results["distances"][0][i]
        output.append({
            "thread_id": meta.get("thread_id"),
            "task": meta.get("task"),
            "deadline": meta.get("deadline") or None,
            "priority": meta.get("priority"),
            "summary": meta.get("summary"),
            "confidence": meta.get("confidence"),
            "relevance_score": round(1 - distance, 3),
        })

    return output

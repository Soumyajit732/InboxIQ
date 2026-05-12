from fastapi import APIRouter, HTTPException
from app.services.vector_store import search_emails

router = APIRouter()


@router.get("/search")
def search(q: str, top_k: int = 5):
    if not q.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    results = search_emails(q.strip(), top_k)
    return {"query": q, "results": results}

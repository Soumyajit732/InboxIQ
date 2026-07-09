from fastapi import FastAPI

from app.services.nlp_spacy import router as spacy_router
from app.services.vector_store import router as vector_router

app = FastAPI(title="InboxIQ NLP/Vector Service")

app.include_router(spacy_router)
app.include_router(vector_router)


@app.get("/")
def root():
    return {"message": "InboxIQ NLP/Vector service running on port 8001"}

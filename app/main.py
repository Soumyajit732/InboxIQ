from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.services.nlp_spacy import router as spacy_router
from app.services.vector_store import router as vector_router

app = FastAPI(title="InboxIQ NLP/Vector Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(spacy_router)
app.include_router(vector_router)


@app.get("/")
def root():
    return {"message": "InboxIQ NLP/Vector service running on port 8001"}

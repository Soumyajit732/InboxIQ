from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import email_routes
from app.services.oauth_service import router as oauth_router  # ✅ ADD THIS
from app.db.models import Base
from app.db.database import engine

app = FastAPI(title="InboxIQ")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Base.metadata.create_all(bind=engine)

app.include_router(email_routes.router)
app.include_router(oauth_router)  # ✅ ADD THIS

@app.get("/")
def root():
    return {"message": "InboxIQ running 🚀"}
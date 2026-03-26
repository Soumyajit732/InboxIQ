from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import email_routes
from app.services.oauth_service import router as oauth_router
from app.db.models import Base
from app.db.database import engine

app = FastAPI(title="InboxIQ")

# ✅ CORS CONFIG (LOCAL + DEPLOYED FRONTEND)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",                # local dev
        "http://localhost:3000",                # optional (React)
        "https://inboxiq-frontend.onrender.com" # deployed frontend
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔹 (Optional) Create DB tables
# Base.metadata.create_all(bind=engine)

# ✅ ROUTES
app.include_router(email_routes.router)
app.include_router(oauth_router)

# 🔹 Root check
@app.get("/")
def root():
    return {"message": "InboxIQ running 🚀"}
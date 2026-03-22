from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import email_routes
from app.db.models import Base
from app.db.database import engine

# 🔹 Initialize app FIRST
app = FastAPI(title="InboxIQ")

# 🔹 Enable CORS (VERY IMPORTANT)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],  # 👈 better than "*"
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🔹 Create DB tables
Base.metadata.create_all(bind=engine)

# 🔹 Include routes
app.include_router(email_routes.router)


@app.get("/")
def root():
    return {"message": "InboxIQ running 🚀"}
import os
import requests
from pathlib import Path
from dotenv import load_dotenv
from fastapi import APIRouter
from fastapi.responses import RedirectResponse

load_dotenv(Path(__file__).parent.parent / ".env")

router = APIRouter()

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

ENV = os.getenv("APP_ENV", "development")

if ENV == "production":
    REDIRECT_URI = "https://inboxiq-backend-10oo.onrender.com/auth/callback"
    FRONTEND_URL = "https://inboxiq-frontend.onrender.com"
else:
    REDIRECT_URI = "http://localhost:8000/auth/callback"
    FRONTEND_URL = "http://localhost:5173"

SCOPES = " ".join([
    "https://www.googleapis.com/auth/gmail.readonly",
    "openid",
    "email",
    "profile",
])


@router.get("/auth/login")
def login():
    google_auth_url = (
        "https://accounts.google.com/o/oauth2/v2/auth"
        f"?client_id={CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&response_type=code"
        f"&scope={SCOPES}"
        f"&access_type=offline"
        f"&prompt=consent"
    )
    return RedirectResponse(google_auth_url)


@router.get("/auth/callback")
def callback(code: str = None, error: str = None, error_description: str = None):
    if error or not code:
        detail = error_description or error or "missing_code"
        print(f"[OAuth] Error from Google: {detail}")
        return RedirectResponse(f"{FRONTEND_URL}?auth_error={detail}")

    token_url = "https://oauth2.googleapis.com/token"

    data = {
        "code": code,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri": REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    token_response = requests.post(token_url, data=data).json()

    if "access_token" not in token_response:
        return {"error": token_response}

    access_token = token_response["access_token"]

    userinfo = requests.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    ).json()

    user_email = userinfo.get("email", "")

    return RedirectResponse(
        f"{FRONTEND_URL}?token={access_token}&email={user_email}"
    )
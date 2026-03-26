import os
import requests
from fastapi import APIRouter
from fastapi.responses import RedirectResponse

router = APIRouter()

CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")

REDIRECT_URI = "https://inboxiq-backend-10oo.onrender.com/auth/callback"
FRONTEND_URL = "https://inboxiq-frontend.onrender.com"

SCOPES = "https://www.googleapis.com/auth/gmail.readonly"


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
def callback(code: str):
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

    return RedirectResponse(
        f"{FRONTEND_URL}?token={access_token}"
    )
import os.path
import base64
from email import message_from_bytes

from bs4 import BeautifulSoup

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


# 🔹 AUTH
def get_gmail_service():
    creds = None

    if os.path.exists("token.json"):
        creds = Credentials.from_authorized_user_file("token.json", SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            flow = InstalledAppFlow.from_client_secrets_file(
                "app/services/credentials.json", SCOPES
            )
            creds = flow.run_local_server(port=0)

        with open("token.json", "w") as token:
            token.write(creds.to_json())

    return build("gmail", "v1", credentials=creds)


# 🔹 CLEAN HTML → TEXT
def clean_email_body(body):
    try:
        soup = BeautifulSoup(body, "html.parser")
        text = soup.get_text(separator=" ")
        text = " ".join(text.split())  # remove extra spaces
        return text
    except:
        return body  # fallback


# 🔹 FILTER SPAM (RELAXED)
def is_useful_email(text):
    text = text.lower()

    # allow important keywords
    if any(word in text for word in ["meeting", "deadline", "submit", "project"]):
        return True

    # block only extreme spam
    if "unsubscribe" in text and "offer" in text:
        return False

    return True


# 🔹 EXTRACT TEXT (FIXED — NO EARLY RETURN)
def extract_body(email_msg):
    text_parts = []

    if email_msg.is_multipart():
        for part in email_msg.walk():
            content_type = part.get_content_type()
            content_disposition = str(part.get("Content-Disposition"))

            if "attachment" in content_disposition:
                continue

            try:
                payload = part.get_payload(decode=True)
                if not payload:
                    continue

                decoded = payload.decode(errors="ignore")

                if content_type == "text/plain":
                    text_parts.append(decoded)

                elif content_type == "text/html":
                    text_parts.append(decoded)

            except:
                continue
    else:
        payload = email_msg.get_payload(decode=True)
        if payload:
            text_parts.append(payload.decode(errors="ignore"))

    return "\n".join(text_parts)


# 🔥 MAIN FUNCTION
def fetch_threads(max_threads=20):
    service = get_gmail_service()

    thread_map = {}
    next_page_token = None

    # 🔥 KEEP FETCHING UNTIL WE GET REQUIRED THREADS
    while len(thread_map) < max_threads:
        response = service.users().messages().list(
            userId="me",
            maxResults=50,  # batch size
            pageToken=next_page_token,
            q="in:inbox -category:promotions"
        ).execute()

        messages = response.get("messages", [])

        for msg in messages:
            if len(thread_map) >= max_threads:
                break

            msg_data = service.users().messages().get(
                userId="me", id=msg["id"], format="raw"
            ).execute()

            thread_id = msg_data["threadId"]
            timestamp = int(msg_data["internalDate"])

            # 🔥 skip if already have enough messages for this thread
            if thread_id in thread_map and len(thread_map) >= max_threads:
                continue

            raw_msg = base64.urlsafe_b64decode(msg_data["raw"].encode("ASCII"))
            email_msg = message_from_bytes(raw_msg)

            extracted_text = extract_body(email_msg)

            if not extracted_text.strip():
                continue

            cleaned_text = clean_email_body(extracted_text)

            if not cleaned_text.strip():
                cleaned_text = extracted_text

            if thread_id not in thread_map:
                thread_map[thread_id] = []

            thread_map[thread_id].append({
                "text": cleaned_text,
                "timestamp": timestamp
            })

        next_page_token = response.get("nextPageToken")

        if not next_page_token:
            break

    # 🔥 FORMAT OUTPUT
    output = []

    for thread_id, thread in thread_map.items():
        thread.sort(key=lambda x: x["timestamp"])

        ordered_texts = [msg["text"] for msg in thread]

        output.append({
            "thread_id": thread_id,
            "messages": ordered_texts
        })

    return output
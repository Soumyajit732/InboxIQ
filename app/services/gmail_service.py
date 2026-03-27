import base64
from email import message_from_bytes
from bs4 import BeautifulSoup

from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build


# 🔹 CREATE GMAIL SERVICE USING ACCESS TOKEN
def get_gmail_service(access_token):
    creds = Credentials(token=access_token)
    return build("gmail", "v1", credentials=creds)


# 🔹 CLEAN HTML → TEXT
def clean_email_body(body):
    try:
        soup = BeautifulSoup(body, "html.parser")
        text = soup.get_text(separator=" ")
        return " ".join(text.split())
    except:
        return body


# 🔹 FILTER USEFUL EMAILS
def is_useful_email(text):
    text = text.lower()

    # allow important emails
    if any(word in text for word in ["meeting", "deadline", "submit", "project"]):
        return True

    # block obvious spam
    if "unsubscribe" in text and "offer" in text:
        return False

    return True


# 🔹 EXTRACT BODY FROM EMAIL
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

                if content_type in ["text/plain", "text/html"]:
                    text_parts.append(decoded)

            except:
                continue
    else:
        payload = email_msg.get_payload(decode=True)
        if payload:
            text_parts.append(payload.decode(errors="ignore"))

    return "\n".join(text_parts)


# 🔥 MAIN FUNCTION (FIXED)
def fetch_threads(access_token, max_threads=20):
    service = get_gmail_service(access_token)

    thread_map = {}
    next_page_token = None

    while len(thread_map) < max_threads:
        response = service.users().messages().list(
            userId="me",
            maxResults=50,
            pageToken=next_page_token,
            q="in:inbox -category:promotions"
        ).execute()

        messages = response.get("messages", [])

        for msg in messages:
            if len(thread_map) >= max_threads:
                break

            msg_data = service.users().messages().get(
                userId="me",
                id=msg["id"],
                format="raw"
            ).execute()

            thread_id = msg_data["threadId"]
            timestamp = int(msg_data["internalDate"])

            raw_msg = base64.urlsafe_b64decode(msg_data["raw"].encode("ASCII"))
            email_msg = message_from_bytes(raw_msg)

            extracted_text = extract_body(email_msg)

            if not extracted_text.strip():
                continue

            cleaned_text = clean_email_body(extracted_text)

            if not cleaned_text.strip():
                cleaned_text = extracted_text

            # 🔥 store latest message per thread
            if thread_id not in thread_map:
                thread_map[thread_id] = {
                    "text": cleaned_text,
                    "timestamp": timestamp
                }
            else:
                if timestamp > thread_map[thread_id]["timestamp"]:
                    thread_map[thread_id] = {
                        "text": cleaned_text,
                        "timestamp": timestamp
                    }

        next_page_token = response.get("nextPageToken")
        if not next_page_token:
            break

    # 🔥 FORMAT OUTPUT
    output = []
    for thread_id, thread in thread_map.items():
        output.append({
            "thread_id": thread_id,
            "messages": [thread["text"]]
        })

    return output
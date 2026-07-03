# InboxIQ

InboxIQ reads your Gmail inbox, uses an LLM to pull out actionable tasks, deadlines, and priority from each thread, and gives you a dashboard plus semantic search over everything it's found — so nothing important gets buried.

## Architecture

```
┌──────────────────┐      ┌───────────────────────┐      ┌──────────────────────────┐
│  React frontend   │◄────►│   Node/Express backend │◄────►│  Google Gmail API        │
│  (inboxiq-frontend│      │   (backend/)           │      │  OpenAI API              │
│  Vite, port 5176) │      │   port 8000            │      └──────────────────────────┘
└──────────────────┘      └──────────┬────────────┘
                                      │
                                      ▼
                           ┌───────────────────────┐      ┌──────────────────────────┐
                           │  Python FastAPI service│◄────►│  ChromaDB (chroma_db/)   │
                           │  (app/), port 8001      │      │  local vector store      │
                           │  spaCy date extraction  │      └──────────────────────────┘
                           │  + embeddings/search    │
                           └───────────────────────┘
```

- **Frontend** — Google sign-in, task dashboard, semantic search UI.
- **Backend (Node)** — owns the Google OAuth flow, fetches and parses Gmail threads, calls OpenAI (with a spaCy fallback) to extract `{task, deadline, priority, summary, confidence}`, scores priority, and proxies vector search to the Python service.
- **NLP/Vector service (Python)** — a small FastAPI service that does two things: spaCy-based date/deadline extraction (used as a fallback when the LLM call fails) and OpenAI-embeddings + ChromaDB storage/search over processed emails.

## Setup

Requires Node 18+, Python 3.10+, and a Google Cloud OAuth client (Gmail API + `openid`/`email`/`profile` scopes) plus an OpenAI API key.

1. Copy `.env.example` to `.env` at the repo root and fill in `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
2. **NLP/Vector service**
   ```
   pip install -r requirements.txt
   uvicorn app.main:app --port 8001
   ```
3. **Backend**
   ```
   cd backend
   npm install
   npm run dev   # http://localhost:8000
   ```
4. **Frontend**
   ```
   cd inboxiq-frontend
   npm install
   npm run dev   # http://localhost:5176
   ```

Sign in with Google from the frontend to grant read-only Gmail access, then hit "Scan inbox" to run the extraction pipeline.

## Testing

```
cd backend && npm test
cd inboxiq-frontend && npm test
```

Covers priority scoring, pipeline filtering/sorting, session-store expiry logic, and the dashboard's date/priority formatters.

## Known limitations

- Sessions and the Gmail-results cache are in-memory (`Map`s) in the Node backend — they reset on restart and don't scale past a single instance. A production deploy would swap these for Redis or a similar shared store.
- There's no persistent database for tasks; the vector store (ChromaDB) is the only durable state, and it's keyed by Gmail thread ID rather than a proper task model.
- Gmail fetch is capped at the 20 most recent inbox threads per sync.

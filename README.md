# InboxIQ

![CI](https://github.com/Soumyajit732/InboxIQ/actions/workflows/ci.yml/badge.svg)

InboxIQ reads your Gmail inbox, uses an LLM to pull out actionable tasks, deadlines, and priority from each thread, and gives you a dashboard plus semantic search over everything it's found — so nothing important gets buried.

> **This branch (`feature/polyglot-python-nlp`) intentionally differs from `main`.** `main` is a single Node.js service (spaCy replaced by `chrono-node`, ChromaDB replaced by SQLite + in-process cosine similarity) — a consolidation made after a real production incident caused by running this as two services. This branch reintroduces that two-service split (Node + a Python FastAPI service for spaCy fallback extraction and ChromaDB vector search) for comparison/demonstration purposes, while keeping everything built after the original consolidation: per-user data isolation, the task lifecycle, hybrid search filters, and explainability. See "Architecture on this branch" below for exactly how responsibilities are split, and the known-limitations section for the tradeoff being knowingly reintroduced.

## Architecture on this branch

```
┌──────────────────┐      ┌────────────────────────┐      ┌──────────────────────────┐
│  React frontend   │◄────►│   Node/Express backend │◄────►│  Google Gmail API        │
│  (inboxiq-frontend│      │   (backend/), port 8000│      │  OpenAI API (chat)       │
│  Vite, port 5176) │      │                         │      └──────────────────────────┘
└──────────────────┘      └──────────┬─────────────┘
                                      │
                    ┌─────────────────┼──────────────────┐
                    ▼                                     ▼
         ┌────────────────────────┐          ┌────────────────────────────┐
         │  SQLite (better-sqlite3)│          │  Python FastAPI service    │
         │  backend/data/inboxiq.db│          │  (app/), port 8001         │
         │  tasks + sessions       │          │  spaCy fallback extraction │
         │  ← source of truth for  │          │  ChromaDB (embeddings only)│
         │    every task field,    │◄────────►│  OpenAI (embeddings)       │
         │    including status     │  HTTP    └────────────────────────────┘
         └────────────────────────┘
```

**The key design decision on this branch: SQLite stays the source of truth for everything, including task status.** The original (pre-consolidation) Python service owned all task data in Chroma. Reintroducing that would mean re-implementing the task-lifecycle status-preservation logic (a rescan must never silently undo a status you set) against Chroma's metadata API, and Chroma's query language can't do substring matching (needed for the sender filter) or handle a frequently-changing field like `status` cleanly. So instead:

- Node writes the full task row to SQLite on every extraction — task, deadline, priority, summary, explainability fields, and status — unchanged from `main`.
- Node additionally calls the Python service to embed and store just enough to rank a search: the embedding itself, plus `user_email`/`priority`/`deadline`/`sender` as Chroma metadata for pre-filtering.
- On search, Python returns a ranked list of `{thread_id, relevance_score}` (filtered by what Chroma can express, plus a sender substring pass in Python); Node re-joins those IDs against SQLite to pull the live task data — including current `status`, which Python never sees — and applies any status filter at that point.

Python's only job is embeddings and similarity ranking, matching the same division of responsibility the original architecture had, just modernized to keep the newer features intact.

- **Frontend** — Google sign-in, task dashboard, semantic search UI.
- **Backend (Node)** — owns the Google OAuth flow, fetches and parses Gmail threads, calls OpenAI for extraction (falling back to the Python service's spaCy endpoint if that call fails), scores priority, and is the source of truth for all task data including lifecycle status.
- **NLP/Vector service (Python)** — spaCy + `dateparser` deadline-extraction fallback, and OpenAI-embeddings + ChromaDB for search ranking only (no task content stored there).

## Setup

Requires Node 20+ (required by `better-sqlite3`), Python 3.10+, and a Google Cloud OAuth client (Gmail API + `openid`/`email`/`profile` scopes) plus an OpenAI API key.

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

Covers priority scoring, pipeline filtering/sorting, session-store expiry logic, deadline extraction, retry-with-backoff behavior, vector search filtering and per-user isolation (with the Python service's HTTP contract mocked, matching this project's existing testing philosophy of not hitting real external services in the test suite), and the dashboard's date/priority formatters. Both suites plus frontend lint and build run automatically on every push/PR via [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Known limitations

- **This branch knowingly reintroduces the operational profile that caused a real production incident on `main`'s history**: two services instead of one, a network hop between them, and cold-start risk on free-tier hosting. That's the explicit tradeoff of doing this for comparison/demonstration purposes — not an oversight.
- Sessions and tasks live in a local SQLite file (`backend/data/inboxiq.db`) — durable across backend restarts, but still local to a single instance and, on Render's free tier, reset on redeploy without a persistent disk attached (see `render.yaml`). ChromaDB's data (`chroma_db/`) has the same characteristic. The Gmail-results cache remains an in-memory `Map`.
- Tasks are scoped by the signed-in Google account's email (`tasks` is keyed on `(user_email, thread_id)`, and `/search`/`/gmail` are both authenticated) rather than a proper relational user model — fine for a handful of personal accounts sharing one deployment, but there's no users table, no per-user rate limiting, and no admin/multi-tenant tooling.
- Gmail fetch is capped at the 20 most recent inbox threads per sync.

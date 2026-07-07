# InboxIQ

InboxIQ reads your Gmail inbox, uses an LLM to pull out actionable tasks, deadlines, and priority from each thread, and gives you a dashboard plus semantic search over everything it's found — so nothing important gets buried.

## Architecture

```
┌──────────────────┐      ┌────────────────────────┐      ┌──────────────────────────┐
│  React frontend   │◄────►│   Node/Express backend │◄────►│  Google Gmail API        │
│  (inboxiq-frontend│      │   (backend/), port 8000│      │  OpenAI API              │
│  Vite, port 5176) │      │                         │      └──────────────────────────┘
└──────────────────┘      └──────────┬─────────────┘
                                      │
                                      ▼
                           ┌────────────────────────┐
                           │  Local vector store     │
                           │  (backend/data/*.json)  │
                           │  OpenAI embeddings +     │
                           │  cosine similarity       │
                           └────────────────────────┘
```

- **Frontend** — Google sign-in, task dashboard, semantic search UI.
- **Backend (Node)** — a single service that owns the Google OAuth flow, fetches and parses Gmail threads, calls OpenAI to extract `{task, deadline, priority, summary, confidence}` (falling back to `chrono-node` for deadline parsing if the LLM call fails), scores priority, and stores/searches email embeddings in a small local vector store (`backend/src/services/vector.service.js`) — OpenAI embeddings compared by cosine similarity, persisted to a JSON file rather than a separate database.

## Setup

Requires Node 18+ and a Google Cloud OAuth client (Gmail API + `openid`/`email`/`profile` scopes) plus an OpenAI API key.

1. Copy `.env.example` to `.env` at the repo root and fill in `OPENAI_API_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
2. **Backend**
   ```
   cd backend
   npm install
   npm run dev   # http://localhost:8000
   ```
3. **Frontend**
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

Covers priority scoring, pipeline filtering/sorting, session-store expiry logic, deadline extraction, vector similarity scoring, and the dashboard's date/priority formatters.

## Known limitations

- Sessions, the Gmail-results cache, and the vector store are all local to a single backend instance (in-memory `Map`s plus a JSON file on disk) — they reset on restart/redeploy and don't scale past one instance. A production deploy would swap these for Redis and a real vector DB respectively.
- There's no persistent database for tasks; the local vector store is the only durable state, and it's keyed by Gmail thread ID rather than a proper task model.
- Gmail fetch is capped at the 20 most recent inbox threads per sync.

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
                           │  SQLite (better-sqlite3)│
                           │  backend/data/inboxiq.db│
                           │  tasks + sessions tables│
                           └────────────────────────┘
```

- **Frontend** — Google sign-in, task dashboard, semantic search UI.
- **Backend (Node)** — a single service that owns the Google OAuth flow, fetches and parses Gmail threads, calls OpenAI to extract `{task, deadline, priority, summary, confidence}` (falling back to `chrono-node` for deadline parsing if the LLM call fails), scores priority, and stores/searches email embeddings against a local SQLite database (`backend/src/services/vector.service.js`) — OpenAI embeddings stored per task row, compared by cosine similarity computed in JS at query time. Sessions (`backend/src/services/session.service.js`) live in the same database rather than in-memory.

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

- Sessions and tasks/embeddings live in a local SQLite file (`backend/data/inboxiq.db`) — durable across backend restarts, but still local to a single instance and, on Render's free tier, reset on redeploy without a persistent disk attached (see `render.yaml`). The Gmail-results cache remains an in-memory `Map` (short TTL by design). A multi-instance production deploy would move this to a hosted Postgres and Redis respectively.
- Tasks are scoped by the signed-in Google account's email (`tasks` is keyed on `(user_email, thread_id)`, and `/search`/`/gmail` are both authenticated) rather than a proper relational user model — fine for a handful of personal accounts sharing one deployment, but there's no users table, no per-user rate limiting, and no admin/multi-tenant tooling.
- Gmail fetch is capped at the 20 most recent inbox threads per sync.

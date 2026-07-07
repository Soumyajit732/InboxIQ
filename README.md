# InboxIQ

![CI](https://github.com/Soumyajit732/InboxIQ/actions/workflows/ci.yml/badge.svg)

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

Requires Node 20+ (required by `better-sqlite3`) and a Google Cloud OAuth client (Gmail API + `openid`/`email`/`profile` scopes) plus an OpenAI API key.

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

Covers priority scoring, pipeline filtering/sorting, session-store expiry logic, deadline extraction, vector similarity scoring and per-user isolation, and the dashboard's date/priority formatters. Both suites plus frontend lint and build run automatically on every push/PR via [`.github/workflows/ci.yml`](.github/workflows/ci.yml).

## Evaluating extraction quality

`npm test` checks the code is correct; it says nothing about whether the AI's *judgment* is correct. `backend/eval/` is separate from the test suite for exactly that reason: a hand-labeled golden dataset (`backend/eval/dataset.js`, ~20 emails covering clear tasks, no-task cases, promotional/system emails that should be ignored, ambiguous deadlines, and multi-message threads) scored against the real extraction pipeline.

```
cd backend
npm run eval
```

This calls the real OpenAI API (costs money, isn't deterministic), so it's a manual command, not part of `npm test` or CI. It reports per-check accuracy (task detection, deadline presence, task-content keyword match, priority range) and an overall pass rate — a real number instead of "seems to work when I tried it."

## Known limitations

- Sessions and tasks/embeddings live in a local SQLite file (`backend/data/inboxiq.db`) — durable across backend restarts, but still local to a single instance and, on Render's free tier, reset on redeploy without a persistent disk attached (see `render.yaml`). The Gmail-results cache remains an in-memory `Map` (short TTL by design). A multi-instance production deploy would move this to a hosted Postgres and Redis respectively.
- Tasks are scoped by the signed-in Google account's email (`tasks` is keyed on `(user_email, thread_id)`, and `/search`/`/gmail` are both authenticated) rather than a proper relational user model — fine for a handful of personal accounts sharing one deployment, but there's no users table, no per-user rate limiting, and no admin/multi-tenant tooling.
- Gmail fetch is capped at the 20 most recent inbox threads per sync.

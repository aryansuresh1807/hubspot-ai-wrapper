# HubSpot AI Wrapper

Full-stack monorepo: **Next.js 14+** frontend (Vercel) and **FastAPI** backend (Railway/Render), with **Supabase** (PostgreSQL, auth) and **HubSpot API** integration.

## Architecture

| Layer        | Tech              | Role                                              |
|-------------|-------------------|---------------------------------------------------|
| Frontend    | Next.js 14 (App Router), TypeScript, Tailwind | UI; calls Backend API                    |
| Backend     | Python FastAPI     | HubSpot API, LLM processing, Supabase operations |
| Database    | PostgreSQL (Supabase) | Auth, sessions, AI-generated data storage   |
| External    | HubSpot API        | Source of truth: contacts, accounts, activities   |

- **Monorepo**: `frontend/` and `backend/` with clear separation.
- Frontend → Backend API only; Backend talks to HubSpot, Supabase, and LLM services.
- **Data ownership:** See [backend/docs/DATA_OWNERSHIP.md](backend/docs/DATA_OWNERSHIP.md) for which data lives in Supabase vs HubSpot.

## Repository structure

```
.
├── frontend/          # Next.js 14+ (App Router), TypeScript, Tailwind
│   ├── src/
│   │   └── app/       # App Router pages & layout
│   ├── package.json
│   ├── vercel.json    # Vercel deployment
│   └── ...
├── backend/           # FastAPI
│   ├── main.py
│   ├── requirements.txt
│   ├── Procfile       # Railway / Render
│   ├── railway.json   # Railway
│   ├── runtime.txt    # Render Python version
│   └── ...
├── docker-compose.yml # Local dev (optional)
├── .env.example
├── .gitignore
├── package.json       # Root scripts & workspaces
└── README.md
```

## Prerequisites

- **Node.js** 18+
- **Python** 3.11+
- **Supabase** project (auth + PostgreSQL)
- **HubSpot** app (Private App or OAuth) and API credentials

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd "HubSpot AI Wrapper"
npm run install:all
```

### 2. Environment variables

Copy the example env and fill in values:

```bash
cp .env.example .env
```

- **Frontend** (Vercel / local): `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Backend** (Railway/Render): `SUPABASE_SERVICE_ROLE_KEY`, `HUBSPOT_ACCESS_TOKEN` (or OAuth vars), `OPENAI_API_KEY` (if using LLM), `FRONTEND_URL` for CORS

Use `.env.local` in `frontend/` for Next.js if you keep env only in frontend.

### 3. Backend (local)

```bash
cd backend
python -m venv .venv
# Windows: .venv\Scripts\activate
# macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

API: **http://localhost:8000**  
Docs: **http://localhost:8000/docs**

### 4. Frontend (local)

From repo root:

```bash
npm run dev:frontend
```

App: **http://localhost:3000**

### 5. Run both (from root)

```bash
npm run dev
```

Runs frontend and backend concurrently (requires `concurrently` from root `package.json`).

## Docker (optional local dev)

From repo root:

```bash
docker-compose up --build
```

- Frontend: http://localhost:3000  
- Backend: http://localhost:8000  

See `docker-compose.yml` and `backend/Dockerfile` for details.

## Deployment

### Frontend → Vercel

1. Connect the repo to Vercel.
2. Set **Root Directory** to `frontend`.
3. Add env vars: `NEXT_PUBLIC_API_URL` (your backend URL), `NEXT_PUBLIC_SUPABASE_*`.
4. Deploy (Vercel will use `vercel.json` and Next.js defaults).

### Backend → Railway

1. New project from repo; set **Root Directory** to `backend`.
2. Railway will use `railway.json` / `Procfile` and `requirements.txt`.
3. Add env vars in Railway dashboard; set `FRONTEND_URL` to your Vercel URL for CORS.

### Backend → Render

1. New **Web Service** from repo.
2. **Root Directory**: `backend`.
3. **Build**: `pip install -r requirements.txt`
4. **Start**: `uvicorn main:app --host 0.0.0.0 --port $PORT`
5. Add env vars; set `FRONTEND_URL` to your Vercel URL.

Optional: use the repo’s `render.yaml` for a Blueprint deploy (set root to `backend` and add env in dashboard).

## API overview

- `GET /` — Service info  
- `GET /health` — Health check  

Further routes (HubSpot, Supabase, LLM) can be added under `backend/` (e.g. `/api/hubspot/*`, `/api/ai/*`).

## License

Private / MIT as applicable.

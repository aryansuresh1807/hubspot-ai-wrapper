# Deployment: Railway (backend) + Vercel (frontend)

The app works locally because the frontend (Next.js) and backend (FastAPI) use your local env. In production the frontend uses **same-origin API requests** that Vercel proxies to Railway, so you don't rely on build-time env or CORS for the browser.

---

## Backend (Railway)

1. **Deploy** the `backend/` directory (or repo root with Dockerfile in backend).
2. **Environment variables** – set in Railway → your service → Variables:

   | Variable | Required | Example / notes |
   |----------|----------|------------------|
   | `SUPABASE_URL` | Yes | `https://xxx.supabase.co` |
   | `SUPABASE_ANON_KEY` | Yes | From Supabase project settings |
   | `SUPABASE_SERVICE_KEY` | Yes | From Supabase project settings |
   | `CORS_ORIGINS` | Yes | Comma-separated: `http://localhost:3000,https://your-frontend.vercel.app` |
   | `HUBSPOT_ACCESS_TOKEN` or `HUBSPOT_API_KEY` | Yes (for HubSpot) | Private app token or OAuth token |
   | `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` | Yes (for AI) | At least one LLM key |
   | `PORT` | No | Railway sets this; app uses `PORT` in the start command |

3. **CORS**: `CORS_ORIGINS` must include the **exact** frontend origin (e.g. `https://hubspot-ai-wrapper-frontend.vercel.app`). Comma-separated for multiple origins.
4. **Public URL**: Copy the public URL (e.g. `https://your-app.up.railway.app`) — you need it for Vercel's `API_URL`.

---

## Frontend (Vercel) – use proxy (recommended)

When the app is **not** on localhost, the client sends API requests to the **same origin** (your Vercel URL). Next.js rewrites `/api/v1/*` to your Railway backend. So the browser never talks to Railway directly; Vercel’s server does. No CORS or build-time API URL issues.

1. **Deploy** the `frontend/` directory.
2. **Environment variables** – set in Vercel → Project → Settings → Environment Variables:

   | Variable | Required | Example / notes |
   |----------|----------|------------------|
   | **`API_URL`** | **Yes (for production)** | Your **Railway backend URL**, e.g. `https://hubspot-ai-wrapper-production.up.railway.app` (no trailing slash). Used by Next.js to proxy `/api/v1/*` to the backend. |
   | `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://xxx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | From Supabase project settings |
   | `NEXT_PUBLIC_API_URL` | Local only | Only needed for **local dev** (e.g. `http://localhost:8000`). Not required on Vercel when using `API_URL` proxy. |

3. **Redeploy** after setting or changing `API_URL`.

---

## Local development

- **Backend**: Run from `backend/` with `.env` (or `NEXT_PUBLIC_API_URL`-style env). No proxy.
- **Frontend**: Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`. The client will call the backend directly.

---

## Quick checklist

- [ ] Railway: All backend env vars set; `CORS_ORIGINS` includes your Vercel URL.
- [ ] Vercel: **`API_URL`** = Railway backend URL (e.g. `https://xxx.up.railway.app`); Supabase vars set.
- [ ] Redeploy frontend after changing `API_URL`.
- [ ] If you see no request logs on Railway: ensure `API_URL` is set on Vercel and you redeployed so the proxy is active.

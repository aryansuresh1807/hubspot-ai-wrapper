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
   | **`API_URL`** or **`NEXT_PUBLIC_API_URL`** | **Yes (for production)** | Your **Railway backend URL**, e.g. `https://hubspot-ai-wrapper-production.up.railway.app` (no trailing slash). Next.js rewrites use whichever is set at **build time** to proxy `/api/v1/*` and `/backend-health`. Set at least one; use a single URL (no space or duplicate). |
   | `NEXT_PUBLIC_SUPABASE_URL` | Yes | `https://xxx.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | From Supabase project settings |
   | `NEXT_PUBLIC_API_URL` | Optional on Vercel | For **local dev** set to `http://localhost:8000`. On Vercel, if set, it is also used for rewrites so the proxy works even if `API_URL` is not set. |

   **Important:** Add `API_URL` and/or `NEXT_PUBLIC_API_URL` for **every environment** you use: **Production** and **Preview**. Preview builds (e.g. from a branch) only get Preview env vars; if the backend URL is set only for Production, rewrites will be empty and the frontend will not reach the backend. When in doubt, set the same values for Production, Preview, and Development.

3. **Build command:** Leave the build command as **`npm run build`** (or leave default). Do not use a custom command that exits with an error on production (e.g. `if [ "$VERCEL_ENV" == "production" ]; then exit 1; fi`) or rewrites will not be applied.

4. **Redeploy** after setting or changing `API_URL`.

5. **If the frontend can’t reach the backend:**  
   - **Rewrites use `API_URL` or `NEXT_PUBLIC_API_URL`** at **build time**. Set at least one in Vercel (Production and Preview if you use preview deploys). No spaces or trailing slash.  
   - **Redeploy the frontend** after changing either variable — rewrites are baked in at build time.  
   - In the browser, requests must go to **your Vercel domain** (e.g. `https://your-app.vercel.app/api/v1/...`), not directly to Railway. The client uses same-origin URLs when not on localhost.  
   - After using the app (search, dashboard), Railway deploy logs should show `INFO:     GET /api/v1/... -> 200`. If you only see “Application startup complete” and no request lines, traffic is not reaching Railway — fix rewrites (env + redeploy) and/or check Vercel function logs for proxy errors.  
   - **Quick proxy check:** Open `https://your-frontend.vercel.app/backend-health` in the browser. You should get `{"status":"healthy"}` from the backend. If you get 404, rewrites are not active (wrong or missing env at build, or no redeploy).

---

## Local development

- **Backend**: Run from `backend/` with `.env` (or `NEXT_PUBLIC_API_URL`-style env). No proxy.
- **Frontend**: Set `NEXT_PUBLIC_API_URL=http://localhost:8000` in `.env.local`. The client will call the backend directly.

---

## Quick checklist

- [ ] Railway: All backend env vars set; `CORS_ORIGINS` includes your Vercel URL (e.g. `https://hubspot-ai-wrapper-frontend.vercel.app`). Startup logs should show `CORS_ORIGINS=...`.
- [ ] Vercel: **`API_URL`** and/or **`NEXT_PUBLIC_API_URL`** = **single** Railway URL (e.g. `https://xxx.up.railway.app`), no trailing slash; Supabase vars set. Env must exist for the environment you deploy (Production / Preview).
- [ ] Redeploy frontend after changing either URL variable (rewrites are built at deploy time).
- [ ] Verify proxy: Open `https://your-app.vercel.app/backend-health` → should return `{"status":"healthy"}`.
- [ ] Verify traffic: Use the app (search, dashboard). Railway logs should show `INFO:     GET /api/v1/... -> 200`. If you see no request lines, rewrites are not active — fix env and redeploy.

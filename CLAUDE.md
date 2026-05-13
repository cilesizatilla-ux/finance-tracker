# Finance Tracker — Project Context

## What this is
Full-stack personal finance app. FastAPI backend + React 18 frontend, served together as a single Docker container.

## Live deployment
- URL: `https://app-production-5e03.up.railway.app`
- Platform: Railway (Docker image pulled from Docker Hub)
- Image: `clszati/finance-tracker:latest`
- CI/CD: push to `main` → GitHub Actions builds → Docker Hub → Railway auto-redeploys

## Architecture
```
finance-tracker/
├── backend/          FastAPI app (Python)
│   ├── main.py       app setup, startup migrations, SPA serving
│   ├── models/       SQLAlchemy models
│   ├── routers/      API routes (auth, transactions, categories, parties, reports, chat, analyze, extract, shared)
│   ├── dependencies.py  JWT auth middleware
│   └── database.py   SQLite engine
├── frontend/         React + Vite + Tailwind
│   └── src/
│       ├── App.jsx   routes
│       ├── pages/    Dashboard, Transactions, Categories, Parties, Reports, Chat, Login, SharedReportView
│       └── components/  Layout, TransactionModal, etc.
├── Dockerfile        multi-stage: node builder → python runtime
├── requirements.txt
└── CLAUDE.md         ← you are here
```

## Local dev
```bash
# Backend (port 8001)
source venv/bin/activate
uvicorn backend.main:app --reload --port 8001

# Frontend (port 5173)
cd frontend && npm run dev
```

## Auth
- Google OAuth 2.0 client ID: `342269208592-llbk5c2uhdksltepu9kl1f8clqfos7q7.apps.googleusercontent.com`
- Google Cloud project: `personalfinance-496207`
- **TODO:** Add `https://app-production-5e03.up.railway.app` and `http://localhost:5173` to Authorized JavaScript Origins at console.cloud.google.com/apis/credentials

## Deploying
```bash
# Automatic: just push to main
git push origin main

# Manual redeploy via Railway GraphQL API
curl -X POST https://backboard.railway.app/graphql/v2 \
  -H "Authorization: Bearer 2537a1c5-a650-4bff-85c9-2e57897c018c" \
  -H "Content-Type: application/json" \
  -d '{"query":"mutation { serviceInstanceDeployV2(serviceId: \"16054d33-6e8d-4c84-a7a5-cf91681b9dae\", environmentId: \"668b6f1c-b708-4a7b-9acb-40d8b77dc919\") }"}'
```

## Key env vars (Railway)
| Var | Value |
|-----|-------|
| `DATABASE_URL` | `sqlite:////data/finance.db` |
| `CORS_ORIGINS` | `https://app-production-5e03.up.railway.app` |
| `PORT` | `8001` |
| `ANTHROPIC_API_KEY` | in Railway dashboard |
| `GOOGLE_CLIENT_ID` | `342269208592-...` |
| `JWT_SECRET` | in Railway dashboard |

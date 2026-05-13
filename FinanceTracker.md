# Finance Tracker

A full-stack personal finance management app with AI-powered insights.

## Live App

**https://app-production-5e03.up.railway.app**

## Features

- **Dashboard** — income vs. expenses overview with charts and trends
- **Transactions** — add, edit, filter, and search all transactions with receipt uploads
- **Categories** — custom income and expense categories with budget tracking
- **Parties** — manage vendors, customers, and business contacts
- **Reports** — monthly summaries with shareable public links
- **AI Chat** — ask questions about your finances in natural language
- **Receipt Scanning** — AI extracts transaction data from uploaded receipts
- **Google Sign-In** — secure authentication via Google OAuth

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | FastAPI + SQLAlchemy + SQLite |
| AI | Anthropic Claude API |
| Auth | Google OAuth 2.0 + JWT |
| Container | Docker (multi-stage build) |
| Registry | Docker Hub (`clszati/finance-tracker:latest`) |
| Hosting | Railway |
| CI/CD | GitHub Actions → Docker Hub → Railway |

## Running Locally

```bash
# Backend
pip install -r requirements.txt
cp .env.example .env   # fill in your keys
uvicorn backend.main:app --reload --port 8001

# Frontend
cd frontend
npm install
npm run dev            # runs on http://localhost:5173
```

## Deployment

Every push to `main` automatically:
1. GitHub Actions builds the Docker image
2. Pushes to Docker Hub (`clszati/finance-tracker:latest`)
3. Railway pulls the new image and redeploys

To manually trigger a redeploy, push any commit to `main`.

## Environment Variables (Railway)

| Variable | Description |
|----------|-------------|
| `ANTHROPIC_API_KEY` | Anthropic Claude API key |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `JWT_SECRET` | JWT signing secret (min 32 chars) |
| `DATABASE_URL` | `sqlite:////data/finance.db` |
| `CORS_ORIGINS` | `https://app-production-5e03.up.railway.app` |
| `PORT` | `8001` |

## Google OAuth Setup

To enable Google Sign-In, add these to **Authorized JavaScript origins** in [Google Cloud Console](https://console.cloud.google.com/apis/credentials):

- `https://app-production-5e03.up.railway.app` (production)
- `http://localhost:5173` (local development)

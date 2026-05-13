# Finance Tracker — Architecture Overview

## Goal

A personal finance web app to track income and expenses, visualize cash flow, manage budgets, and use AI agents for smart categorization and advice.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | Python 3.11 + FastAPI |
| Database | SQLite + SQLAlchemy ORM |
| Migrations | Alembic |
| AI Agents | Anthropic Claude API (`claude-sonnet-4-6`) |
| Frontend | React 18 + Vite |
| Charts | Recharts |
| HTTP Client | Axios |
| Styling | Tailwind CSS |

---

## System Architecture

```
┌─────────────────────────────────────────┐
│              React Frontend              │
│  Dashboard │ Transactions │ Budget │ Chat │
└──────────────────┬──────────────────────┘
                   │ HTTP (REST)
┌──────────────────▼──────────────────────┐
│           FastAPI Backend               │
│  /api/v1/transactions                   │
│  /api/v1/categories                     │
│  /api/v1/reports                        │
│  /api/v1/chat                           │
└──────┬──────────────────────┬───────────┘
       │                      │
┌──────▼──────┐    ┌──────────▼──────────┐
│   SQLite DB  │    │   Claude API        │
│  (SQLAlchemy)│    │  (4 Agents)         │
└─────────────┘    └─────────────────────┘
```

---

## Database Schema

### transactions
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | Auto-increment |
| date | DATE | Transaction date |
| description | TEXT | Raw bank description |
| amount_cents | INTEGER | Amount in cents (negative = expense) |
| category_id | INTEGER FK | → categories.id |
| is_income | BOOLEAN | True if positive cash flow |
| is_anomaly | BOOLEAN | Flagged by anomaly agent |
| source | TEXT | "manual" or "csv_import" |
| created_at | DATETIME | |
| updated_at | DATETIME | |
| deleted_at | DATETIME | Soft delete |

### categories
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| name | TEXT | e.g. "Groceries" |
| budget_cents | INTEGER | Monthly budget cap |
| color | TEXT | Hex color for charts |
| created_at | DATETIME | |

### imports
| Column | Type | Notes |
|---|---|---|
| id | INTEGER PK | |
| filename | TEXT | Original CSV filename |
| imported_count | INTEGER | Rows successfully imported |
| skipped_count | INTEGER | Duplicate rows skipped |
| error_count | INTEGER | Malformed rows |
| created_at | DATETIME | |

---

## API Endpoints

### Transactions
- `GET  /api/v1/transactions` — list with filters (date range, category, type)
- `POST /api/v1/transactions` — create single transaction
- `PUT  /api/v1/transactions/{id}` — update transaction
- `DELETE /api/v1/transactions/{id}` — soft delete
- `POST /api/v1/transactions/import` — upload CSV, triggers agents

### Categories
- `GET  /api/v1/categories` — list all categories with budget status
- `POST /api/v1/categories` — create category
- `PUT  /api/v1/categories/{id}` — update category or budget limit

### Reports
- `GET /api/v1/reports/cashflow?month=5&year=2026` — income vs expense by month
- `GET /api/v1/reports/budget` — budget usage per category
- `GET /api/v1/reports/anomalies` — flagged transactions

### Chat (AI Agent)
- `POST /api/v1/chat` — send message, get AI financial advice

---

## Frontend Pages

### Dashboard (`/`)
- Monthly cash flow bar chart (income vs expenses)
- Budget progress bars per category
- Recent transactions list
- Anomaly alerts

### Transactions (`/transactions`)
- Full transaction table with filters
- Add/edit/delete transaction form
- CSV import button

### Budget (`/budget`)
- Category list with monthly budget caps
- Edit budget limits inline
- Spending vs budget donut chart

### Chat (`/chat`)
- Conversational AI interface
- Talks to Budget Advisor agent
- Shows transaction data in responses

---

## Agent Integration Points

```
POST /transactions/import
  → CSV Import Agent (validates + parses)
    → Categorizer Agent (per row)
      → Anomaly Detector Agent (post-import hook)

POST /chat
  → Budget Advisor Agent (real-time Q&A)
```

---

## Local Development Setup

```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env   # add your ANTHROPIC_API_KEY
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev   # runs on http://localhost:5173
```

---

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...
DATABASE_URL=sqlite:///./finance.db
CORS_ORIGINS=http://localhost:5173
```

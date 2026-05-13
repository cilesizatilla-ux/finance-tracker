# Finance Tracker — Agents, Subagents & Hooks

## 1. Claude Agents (in-app AI features)

These agents run inside your FastAPI backend and are called via API endpoints.

### 1.1 Transaction Categorizer Agent
**File:** `backend/services/categorizer.py`  
**Triggered by:** `POST /api/v1/transactions/import` (auto, per CSV row)  
**Model:** `claude-sonnet-4-6`  
**Max iterations:** 5

**What it does:**  
Reads a raw bank description + amount, picks the best category from your existing list, and returns confidence score.

**Tool it uses:**

```json
{
  "name": "categorize_transaction",
  "input_schema": {
    "category_name": "string",
    "is_income": "boolean",
    "confidence": "number (0–1)"
  }
}
```

**Fallback:** If API key is missing or call fails → `{ category_name: "Other", is_income: false, confidence: 0.0 }`

---

### 1.2 Budget Advisor Agent
**File:** `backend/services/advisor.py`  
**Triggered by:** `POST /api/v1/chat`  
**Model:** `claude-sonnet-4-6`  
**Max iterations:** 10

**What it does:**  
Answers natural language questions about your finances. Queries live SQLite data via tools before answering.

**Tools it uses:**

| Tool | What it does |
|---|---|
| `get_spending_by_category` | Returns total spent per category for a given month/year |
| `get_budget_status` | Returns all category budget limits and current spending |
| `get_cash_flow` | Returns income vs expense totals for a given month/year |
| `get_recent_transactions` | Returns the last N non-deleted transactions |

**Example:**
```
User: "What's my biggest expense category this month?"
Agent: calls get_spending_by_category(month=5, year=2026)
     → "Your biggest expense is Food & Dining at $342.50."
```

---

### 1.3 CSV Import Agent (orchestrator)
**File:** `backend/services/csv_importer.py`  
**Triggered by:** `POST /api/v1/transactions/import`  
**Model:** N/A (pure Python orchestrator, calls Categorizer Agent per row)

**Flow:**
```
Upload CSV
  → validate headers (date, description, amount required)
  → parse rows (try YYYY-MM-DD then MM/DD/YYYY for dates)
  → deduplicate by (date + description + amount_cents)
  → for each valid row: call Categorizer Agent
  → find or create category in DB
  → bulk insert transactions
  → return ImportResult { imported, skipped, errors }
```

**Abort condition:** If >20% of rows are malformed, the import aborts early.

---

### 1.4 Anomaly Detector Agent
**File:** `backend/services/anomaly_detector.py`  
**Triggered by:** Post-import hook (runs after each import)  
**Model:** `claude-sonnet-4-6`

**Tools it uses:**

| Tool | What it does |
|---|---|
| `get_category_stats` | Returns mean + std_dev of spending for a category |
| `flag_anomaly` | Marks a transaction as anomalous in the DB |

---

## 2. Claude Code Subagents (build-time)

These are Claude Code agents used to build and maintain the project itself. They are launched via the Claude Code Agent tool.

### 2.1 Backend Builder Subagent
**Type:** `claude` (general purpose)  
**Used to:** Scaffold the entire FastAPI backend (models, routes, services, agents)  
**Outputs:** All files under `backend/`

**How to re-run if you need to regenerate:**
```
Spawn agent with prompt: "Build/fix the FastAPI backend at /Users/.../finance-tracker/backend/..."
```

---

### 2.2 Frontend Builder Subagent
**Type:** `claude` (general purpose)  
**Used to:** Scaffold the entire React + Vite + Tailwind frontend  
**Outputs:** All files under `frontend/src/`

**How to re-run if you need to regenerate:**
```
Spawn agent with prompt: "Build/fix the React frontend at /Users/.../finance-tracker/frontend/..."
```

---

### 2.3 Code Review Subagent (on-demand)
Use `/review` in Claude Code to spin up a code review agent that checks:
- API field name alignment between backend and frontend
- Missing error handling in agent loops
- Security: raw user input passed to agents
- Pydantic model mismatches

---

## 3. Hooks (`.claude/settings.json`)

Hooks run automatically during Claude Code sessions for this project.

### 3.1 PostToolUse — File Save Logger
**Trigger:** Every `Write` or `Edit` tool call  
**What it does:** Logs the saved file path to `/tmp/finance-tracker-saves.log`

```json
{
  "event": "PostToolUse",
  "matcher": "Write|Edit",
  "command": "jq -r '.tool_input.file_path ...' | ... >> /tmp/finance-tracker-saves.log"
}
```

**To view the log:**
```bash
cat /tmp/finance-tracker-saves.log
```

---

### 3.2 Stop — Session End Reminder
**Trigger:** When Claude Code session ends  
**What it does:** Displays startup commands in the UI so you know how to run the app

```json
{
  "event": "Stop",
  "command": "echo '{\"systemMessage\": \"Run: uvicorn backend.main:app --reload + npm run dev\"}'"
}
```

---

### 3.3 Permissions (pre-approved, no prompts)

The following commands run without permission prompts in this project:

| Command pattern | Why |
|---|---|
| `uvicorn *` | Start the backend dev server |
| `npm *` | Install packages, run dev, build |
| `pip * / pip3 *` | Install Python dependencies |
| `python * / python3 *` | Run Python scripts |
| `alembic *` | Database migrations |
| `vite *` | Frontend tooling |
| `curl http://localhost*` | Test API endpoints locally |
| `find .../finance-tracker *` | Search project files |
| `Read(.../finance-tracker/*)` | Read any project file |

---

## 4. Known Bugs Fixed

| Bug | Root Cause | Fix |
|---|---|---|
| Blank page on load | Missing `@tailwind` directives in `tokens.css` — no CSS classes generated | Added directives at top of `tokens.css` |
| Dashboard shows $0 everywhere | API returns `income_cents`/`expense_cents`, frontend read `income`/`expenses` | Fixed field names in `Dashboard.jsx` |
| Budget bars not rendering | API returns `spent_cents`/`budget_cents`/`category_id`, frontend read `spent`/`budget`/`id` | Fixed field names in `Budget.jsx` |
| Transaction amounts show $0 | `tx.amount_cents` used but frontend read `tx.amount`; `tx.is_income` used but read `tx.type` | Fixed in `Transactions.jsx` |
| Category not shown in transaction table | `TransactionOut` schema had no `category_name`/`category_color` | Added optional fields + `_enrich()` helper in router |
| Dates off by one day | `new Date("2026-05-13")` parsed as UTC midnight → local time shows previous day | Added `T00:00:00` suffix to force local time parsing |

---

## 5. Running the Project

```bash
# Terminal 1 — Backend (http://localhost:8000)
cd ~/Documents/finance-tracker
venv/bin/uvicorn backend.main:app --reload

# Terminal 2 — Frontend (http://localhost:5173)
cd ~/Documents/finance-tracker/frontend
npm run dev
```

**Required env var** in `.env`:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
```

Without this key, the app loads and all features work except Chat and CSV auto-categorization (both return a clear error message instead of crashing).

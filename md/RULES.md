# Finance Tracker — Project Rules

## 1. General Principles

- Keep backend and frontend strictly separated — no business logic in the frontend
- All financial calculations happen server-side only
- Never hardcode API keys or secrets — use environment variables
- All monetary values are stored and handled as integers (cents), not floats
- Every feature must have a corresponding agent that can assist with it

## 2. Backend Rules (FastAPI + SQLite)

- Every endpoint must have a Pydantic request/response model
- Database access goes through SQLAlchemy models only — no raw SQL strings
- All routes are prefixed: `/api/v1/...`
- HTTP methods follow REST conventions:
  - `GET` — read only, no side effects
  - `POST` — create new resource
  - `PUT` — full update
  - `PATCH` — partial update
  - `DELETE` — remove resource
- Every endpoint returns a consistent envelope:
  ```json
  { "data": ..., "error": null }
  { "data": null, "error": "message" }
  ```

## 3. Database Rules

- All tables have `id`, `created_at`, and `updated_at` columns
- Never delete records — use a `deleted_at` soft-delete column
- Amounts are stored in cents (integer): $12.50 → `1250`
- Use Alembic for all schema migrations — never modify DB manually

## 4. Agent Rules (Claude API)

- One agent per responsibility — no multi-purpose agents
- All agent calls are wrapped in `try/except` with a fallback response
- Agent tool schemas are defined in `backend/services/agent_tools.py`
- Never pass raw user input directly to an agent — sanitize first
- Log every agent call: model, tokens consumed, latency
- Default model: `claude-sonnet-4-6`
- Complex reasoning tasks: `claude-opus-4-7`
- Agent loop must have a max iteration cap (default: 10) to prevent infinite loops

## 5. CSV Import Rules

- Accepted columns: `date`, `description`, `amount` (case-insensitive)
- Dates must be parseable as `YYYY-MM-DD` or `MM/DD/YYYY`
- Amounts: negative = expense, positive = income
- Duplicate detection: skip rows where `(date + description + amount)` already exists
- Max file size: 5 MB per import
- Categorizer agent runs on every imported row automatically

## 6. Frontend Rules (React)

- Functional components only — no class components
- All API calls go through `src/api/` service layer — no inline `fetch()`
- Financial amounts are always formatted with currency symbol before display
- Charts use Recharts only — do not mix charting libraries
- No hardcoded colors — use CSS variables defined in `src/styles/tokens.css`

## 7. Security Rules

- Sanitize all user inputs before processing
- Validate file types on upload (CSV only, MIME check)
- Never expose internal error details to the client
- Rate-limit agent endpoints: max 20 requests/minute per user
- Store `ANTHROPIC_API_KEY` in `.env` — never commit `.env` to git

## 8. Hooks

- **Pre-import hook**: validate CSV structure before passing to agent
- **Post-categorization hook**: trigger budget check after each categorized transaction
- **Post-import hook**: recalculate monthly cash flow summary after bulk import
- **Pre-agent hook**: sanitize and truncate input to max 2000 chars

## 9. File & Folder Conventions

```
finance-tracker/
  backend/
    main.py              # App entry point
    database.py          # DB connection and session
    models.py            # SQLAlchemy models
    routers/
      transactions.py    # CRUD for transactions
      categories.py      # CRUD for categories
      reports.py         # Cash flow and budget reports
      chat.py            # Financial Q&A agent endpoint
    services/
      categorizer.py     # Transaction categorizer agent
      advisor.py         # Budget advisor agent
      csv_importer.py    # CSV parsing and import logic
      agent_tools.py     # Shared Claude tool schemas
  frontend/
    src/
      api/               # API service functions
      components/        # Reusable UI components
      pages/             # Route-level page components
  md/
    RULES.md             # This file
    AGENTS.md            # Agent usage guide
    PROJECT.md           # Architecture overview
  .env.example           # Environment variable template
  requirements.txt       # Python dependencies
```

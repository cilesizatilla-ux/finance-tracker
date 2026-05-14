# Finance Tracker — Claude Agents Guide

## Overview

This project uses the Claude API (Anthropic) to power four intelligent agents.
All agents follow the agentic loop pattern: Claude reasons → calls a tool → gets result → reasons again → until done.

---

## Agent 1: Transaction Categorizer

**File:** `backend/services/categorizer.py`
**Endpoint:** Called internally during `/api/v1/transactions/import`
**Model:** `claude-sonnet-4-6`

**What it does:**
Reads a raw bank transaction description and amount, then assigns a category.

**Tools it uses:**
- `categorize_transaction` — returns `{ category, confidence, is_expense }`

**Flow:**
```
CSV row → sanitize → Categorizer Agent → category assigned → save to DB
```

**Example:**
```
Input:  "NETFLIX.COM  $15.99"
Output: { category: "Subscriptions", confidence: 0.98, is_expense: true }
```

---

## Agent 2: Budget Advisor

**File:** `backend/services/advisor.py`
**Endpoint:** `POST /api/v1/chat`
**Model:** `claude-sonnet-4-6`

**What it does:**
Answers natural language questions about your finances by querying your SQLite database.

**Tools it uses:**
- `get_spending_by_category(month, year)` — fetches totals per category
- `get_budget_status()` — fetches all category budget limits and current spending
- `get_cash_flow(month, year)` — fetches income vs. expense totals
- `get_recent_transactions(limit)` — fetches last N transactions

**Flow:**
```
User question → Budget Advisor Agent → tool calls DB → synthesizes answer → returns text
```

**Example:**
```
User:  "How much did I spend on food last month?"
Agent: calls get_spending_by_category(month=4, year=2026)
       → "You spent $342.50 on Food & Dining in April, which is 85% of your $400 budget."
```

---

## Agent 3: CSV Import Agent

**File:** `backend/services/csv_importer.py`
**Endpoint:** `POST /api/v1/transactions/import`
**Model:** `claude-sonnet-4-6`

**What it does:**
Validates a CSV file structure, parses rows, deduplicates, and triggers the Categorizer Agent on each row.

**Flow:**
```
Upload CSV → validate headers → parse rows → deduplicate → Categorizer per row → bulk insert
```

**Rules:**
- Skips duplicate rows silently (logs them)
- Aborts entire import if >20% of rows are malformed
- Returns import summary: `{ imported, skipped, errors }`

---

## Agent 4: Anomaly Detector

**File:** `backend/services/anomaly_detector.py`
**Endpoint:** Called as a post-import hook
**Model:** `claude-sonnet-4-6`

**What it does:**
After each import, scans new transactions and flags any that are statistically unusual based on historical spending per category.

**Tools it uses:**
- `get_category_stats(category)` — returns `{ mean, std_dev }` for that category
- `flag_anomaly(transaction_id, reason)` — marks transaction as anomalous in DB

**Trigger:**
Automatically runs after `POST /api/v1/transactions/import` completes (post-import hook).

---

## Shared Tool Schemas

All tool definitions live in `backend/services/agent_tools.py`.
Import them into each agent service file:

```python
from services.agent_tools import CATEGORIZER_TOOLS, ADVISOR_TOOLS, ANOMALY_TOOLS
```

---

## Agent Loop Pattern (reference)

All agents follow this structure:

```python
from anthropic import Anthropic

client = Anthropic()

def run_agent(system_prompt: str, user_message: str, tools: list, handlers: dict):
    messages = [{"role": "user", "content": user_message}]
    max_iterations = 10
    iteration = 0

    while iteration < max_iterations:
        iteration += 1
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=system_prompt,
            tools=tools,
            messages=messages,
        )

        if response.stop_reason == "end_turn":
            return next((b.text for b in response.content if hasattr(b, "text")), "")

        if response.stop_reason == "tool_use":
            messages.append({"role": "assistant", "content": response.content})
            tool_results = []
            for block in response.content:
                if block.type == "tool_use":
                    handler = handlers.get(block.name)
                    result = handler(block.input) if handler else {"error": "unknown tool"}
                    tool_results.append({
                        "type": "tool_result",
                        "tool_use_id": block.id,
                        "content": str(result),
                    })
            messages.append({"role": "user", "content": tool_results})

    return "Agent reached max iterations without completing."
```

---

## Environment Variables

```
ANTHROPIC_API_KEY=sk-ant-...   # Required for all agents
```

Set in `.env` file. Never commit this file to git.

---

## Cost & Model Guide

| Agent | Model | Reason |
|---|---|---|
| Categorizer | `claude-sonnet-4-6` | Fast, cheap, runs per row |
| Budget Advisor | `claude-sonnet-4-6` | Conversational, moderate complexity |
| CSV Importer | `claude-sonnet-4-6` | Orchestration + validation |
| Anomaly Detector | `claude-sonnet-4-6` | Statistical reasoning, not creative |

Switch to `claude-opus-4-7` only if you need deeper financial reasoning or multi-step planning.

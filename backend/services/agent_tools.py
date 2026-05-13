"""
Tool schema definitions for Anthropic Claude agents.
"""

# ---------------------------------------------------------------------------
# Categorizer tools
# ---------------------------------------------------------------------------

CATEGORIZER_TOOLS = [
    {
        "name": "categorize_transaction",
        "description": "Assign a category and type to a bank transaction",
        "input_schema": {
            "type": "object",
            "properties": {
                "category_name": {
                    "type": "string",
                    "description": "The name of the category to assign to this transaction",
                },
                "is_income": {
                    "type": "boolean",
                    "description": "True if this transaction represents income, False for an expense",
                },
                "confidence": {
                    "type": "number",
                    "description": "Confidence score between 0 and 1 for this categorization",
                },
            },
            "required": ["category_name", "is_income", "confidence"],
        },
    }
]

# ---------------------------------------------------------------------------
# Advisor tools
# ---------------------------------------------------------------------------

ADVISOR_TOOLS = [
    {
        "name": "get_spending_by_category",
        "description": "Get total spending grouped by category for a given month and year",
        "input_schema": {
            "type": "object",
            "properties": {
                "month": {
                    "type": "integer",
                    "description": "Month number (1-12)",
                },
                "year": {
                    "type": "integer",
                    "description": "Four-digit year (e.g. 2024)",
                },
            },
            "required": ["month", "year"],
        },
    },
    {
        "name": "get_budget_status",
        "description": "Get budget vs actual spending status for all categories in the current month",
        "input_schema": {
            "type": "object",
            "properties": {},
            "required": [],
        },
    },
    {
        "name": "get_cash_flow",
        "description": "Get total income vs total expenses for a given month and year",
        "input_schema": {
            "type": "object",
            "properties": {
                "month": {
                    "type": "integer",
                    "description": "Month number (1-12)",
                },
                "year": {
                    "type": "integer",
                    "description": "Four-digit year (e.g. 2024)",
                },
            },
            "required": ["month", "year"],
        },
    },
    {
        "name": "get_recent_transactions",
        "description": "Get the most recent transactions",
        "input_schema": {
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Number of transactions to return (default 10)",
                },
            },
            "required": [],
        },
    },
]

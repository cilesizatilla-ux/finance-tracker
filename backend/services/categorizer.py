import json
import os
from typing import List

import anthropic

from backend.services.agent_tools import CATEGORIZER_TOOLS

_MODEL = "claude-sonnet-4-6"
_MAX_ITERATIONS = 5


def categorize_transaction(
    description: str,
    amount_cents: int,
    db_categories: List[str],
) -> dict:
    """
    Use Claude to assign a category and income/expense type to a transaction.

    Returns a dict with keys: category_name, is_income, confidence.
    Falls back to sensible defaults if the API key is missing or an error occurs.
    """
    fallback = {
        "category_name": "Other",
        "is_income": amount_cents > 0,
        "confidence": 0.0,
    }

    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        return fallback

    try:
        client = anthropic.Anthropic(api_key=api_key)

        categories_list = ", ".join(db_categories) if db_categories else "Other"
        system_prompt = (
            "You are a financial transaction categorizer. "
            "Given a transaction description and amount, assign the most appropriate category "
            f"from this list: {categories_list}. "
            "If none fit well, you may suggest a new short category name. "
            "Use the categorize_transaction tool to return your answer."
        )

        user_content = (
            f"Transaction description: {description}\n"
            f"Amount (in cents, negative = expense): {amount_cents}"
        )

        messages = [{"role": "user", "content": user_content}]
        result = fallback.copy()

        for _ in range(_MAX_ITERATIONS):
            response = client.messages.create(
                model=_MODEL,
                max_tokens=256,
                system=system_prompt,
                tools=CATEGORIZER_TOOLS,
                messages=messages,
            )

            # Collect tool uses from this response
            tool_use_block = None
            for block in response.content:
                if block.type == "tool_use" and block.name == "categorize_transaction":
                    tool_use_block = block
                    break

            if tool_use_block is not None:
                inp = tool_use_block.input
                result = {
                    "category_name": inp.get("category_name", "Other"),
                    "is_income": bool(inp.get("is_income", amount_cents > 0)),
                    "confidence": float(inp.get("confidence", 0.5)),
                }
                # Return tool result and let the model finish
                messages.append({"role": "assistant", "content": response.content})
                messages.append({
                    "role": "user",
                    "content": [
                        {
                            "type": "tool_result",
                            "tool_use_id": tool_use_block.id,
                            "content": json.dumps(result),
                        }
                    ],
                })

            if response.stop_reason == "end_turn":
                break

            if response.stop_reason != "tool_use":
                break

        return result

    except Exception:
        return fallback

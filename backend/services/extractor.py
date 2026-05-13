import base64
import json
import os

from anthropic import Anthropic


def extract_receipt(image_bytes: bytes, media_type: str) -> dict:
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key or api_key.startswith("sk-ant-your"):
        return {"error": "AI extraction requires a valid ANTHROPIC_API_KEY"}

    client = Anthropic(api_key=api_key)
    b64 = base64.standard_b64encode(image_bytes).decode()

    prompt = """Extract financial data from this receipt or invoice. Return ONLY valid JSON (no markdown) with exactly this structure:
{
  "date": "YYYY-MM-DD or null",
  "amount": <total amount as decimal number, positive, or null>,
  "currency": "detected currency code like USD, EUR, TRY, or null",
  "is_expense": true,
  "description": "brief description of what this is",
  "vendor_name": "name of vendor/company or null",
  "invoice_number": "invoice/receipt/document number or null",
  "tax_amount": <tax amount as decimal number or null>,
  "payment_method": "cash/card/transfer/check/other or null",
  "notes": "any additional relevant info or null",
  "detected_language": "ISO 639-1 code: en, tr, de, fr, es, ar, zh, ja, etc.",
  "category_hint": "one of: Groceries, Rent/Mortgage, Utilities, Transportation, Entertainment, Food & Dining, Subscriptions, Salary, Other"
}"""

    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": b64}},
            {"type": "text", "text": prompt}
        ]}]
    )

    text = response.content[0].text.strip()
    if "```" in text:
        start = text.find("{")
        end = text.rfind("}") + 1
        text = text[start:end]

    return json.loads(text)

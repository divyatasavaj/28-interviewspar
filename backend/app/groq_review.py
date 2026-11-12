"""Shared structured Groq requests for opted-in coaching."""

import json
import os

DEFAULT_MODEL = "openai/gpt-oss-20b"


def request_review(instruction, data, max_tokens):
    from groq import Groq

    response = Groq(
        api_key=os.environ["GROQ_API_KEY"], timeout=12, max_retries=0
    ).chat.completions.create(
        model=os.getenv("GROQ_MODEL") or DEFAULT_MODEL,
        temperature=0,
        response_format={"type": "json_object"},
        max_tokens=max_tokens,
        messages=[
            {"role": "system", "content": instruction},
            {"role": "user", "content": json.dumps(data)},
        ],
    )
    return json.loads(response.choices[0].message.content)

import json
import os
import re

from groq import Groq

# Default matches Groq deprecations: llama3-70b-8192 removed; see console.groq.com/docs/deprecations
DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"


def generate_ad_copy(
    product_name: str,
    description: str,
    benefits: list[str],
    brand_tone: str,
    brand_name: str,
) -> dict:
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise RuntimeError("GROQ_API_KEY is not set")

    client = Groq(api_key=key)
    prompt = f"""
You are an expert advertising copywriter. Generate 4 ad variants for this product.

Product: {product_name}
Description: {description or 'N/A'}
Key Benefits: {', '.join(benefits or ['quality'])}
Brand: {brand_name}
Tone: {brand_tone}

Generate exactly 4 variants, one for each angle:
1. social_proof: Use testimonials, popularity, trust signals
2. urgency: Limited time, scarcity, FOMO
3. benefit: Lead with the strongest functional benefit
4. curiosity: Intrigue, question-led, unexpected angle

Respond ONLY with valid JSON, no markdown:
{{
  "variants": [
    {{
      "angle": "social_proof",
      "headline": "...",
      "subheadline": "...",
      "cta": "..."
    }}
  ]
}}

Rules:
- Headline: max 8 words, punchy
- Subheadline: max 15 words, supports headline
- CTA: max 4 words, action verb first
- Match the brand tone: {brand_tone}
- Include exactly 4 objects in "variants" with angles social_proof, urgency, benefit, curiosity in that order.
"""
    model = os.environ.get("GROQ_MODEL") or DEFAULT_GROQ_MODEL
    response = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.8,
        max_tokens=800,
    )
    raw = response.choices[0].message.content or "{}"
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    return json.loads(raw)

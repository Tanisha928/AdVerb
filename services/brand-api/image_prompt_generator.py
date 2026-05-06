"""Groq-authored prompts for Replicate SDXL ad images."""

from __future__ import annotations

import os

from groq import Groq

from groq_copy import DEFAULT_GROQ_MODEL

ANGLE_STYLES = {
    "social_proof": "lifestyle photography, people enjoying the product, warm authentic atmosphere, candid real moments, community feel",
    "urgency": "dramatic lighting, bold high-contrast colors, intense composition, cinematic tension, dark moody atmosphere",
    "benefit": "clean product photography, bright studio lighting, white or minimal background, crisp sharp details, professional commercial shot",
    "curiosity": "artistic surreal composition, unexpected creative angle, editorial fashion photography style, visually striking and unusual",
}

LAYOUT_COMPOSITIONS = {
    "bottom_bar": "wide landscape composition 16:9, subject centered or slightly upper, empty negative space along bottom edge for typography, rule of thirds",
    "centered": "perfectly centered hero product, symmetrical composition, subject dead center, dramatic lighting from above",
    "left_text": "subject positioned clearly on right half of frame, left half quieter background or softer bokeh, landscape aspect",
    "top_bar": "primary subject occupying lower half of frame, upper half clean open sky smooth gradient backdrop, uplifting composition",
}

TONE_STYLES = {
    "professional": "clean corporate photography, neutral tones, sophisticated minimalist",
    "playful": "vibrant saturated colors, fun dynamic angles, bright cheerful lighting",
    "bold": "high contrast dramatic shadows, powerful composition, intense colors",
    "luxury": "dark rich moody tones, gold accents, premium editorial photography, velvet textures",
}


def generate_image_prompt(
    product_name: str,
    product_description: str,
    brand_name: str,
    brand_tone: str,
    industry: str,
    angle: str,
    layout: str,
    headline: str,
    brand_color_hex: str,
) -> str:
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise RuntimeError("GROQ_API_KEY is not set")

    client = Groq(api_key=key)
    model = os.environ.get("GROQ_MODEL") or DEFAULT_GROQ_MODEL

    angle_key = (angle or "benefit").lower().strip().replace("-", "_")
    layout_key = (layout or "centered").lower().strip()

    tone_key = (brand_tone or "professional").lower().strip()

    system_prompt = (
        "You are an expert AI image prompt engineer specializing in advertising photography.\n"
        "You write prompts for Stable Diffusion that produce professional commercial advertisement images.\n"
        "Your prompts always describe photorealistic, high-quality ad images—not cartoons unless asked.\n"
        "Respond with a single paragraph of comma-separated visual descriptors.\n"
        "Do not use quotation marks around the paragraph. Do not add explanations before or after."
    )

    user_prompt = f"""Write a Stable Diffusion image generation prompt for this advertisement:

Product: {product_name}
Description: {product_description or "N/A"}
Brand: {brand_name}
Industry: {industry or "consumer goods"}
Ad headline (mood cue only — do NOT render text): {headline}
Visual angle: {angle_key} — {ANGLE_STYLES.get(angle_key, "")}
Composition / layout cue: {layout_key} — {LAYOUT_COMPOSITIONS.get(layout_key, "")}
Brand tone: {brand_tone} — {TONE_STYLES.get(tone_key, TONE_STYLES["professional"]) }
Brand accent color hex (use sparingly as lighting or accents only): {brand_color_hex}

Requirements:
- Photorealistic premium commercial advertisement quality with the item as unmistakable hero
- Absolutely NO text, words, letters, logos, or watermarks in the image frame
- Professional advertising portrait/lifestyle photographic aesthetic suited to ecommerce
- 8k-detail look, razor sharp selective focus where appropriate

Write only the prompt body in one cohesive paragraph (~60–80 words)."""

    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=400,
    )

    base_prompt = (response.choices[0].message.content or "").strip()

    quality_suffix = (
        ", professional commercial advertisement photography, no text, no words, no watermarks,"
        " no letters, studio quality lighting, ultra detailed, sharp focus, 8k, cinematic,"
        " award winning advertising"
    )

    combined = base_prompt + quality_suffix
    return combined[:4500]

"""Prompt composition helpers for premium Pollinations creatives."""

from __future__ import annotations

from urllib.parse import urlparse

ANGLE_STYLES = {
    "social_proof": "lifestyle editorial scene with authentic human context and premium retail ambience",
    "urgency": "dramatic high-contrast editorial mood with cinematic tension and controlled highlights",
    "benefit": "clean hero product photography with commercial-grade detail and modern retail polish",
    "curiosity": "visually striking artistic editorial framing that stays photorealistic and premium",
}

LAYOUT_COMPOSITIONS = {
    "bottom_bar": "landscape framing with product as focal hero and clean lower whitespace reserved for optional copy overlay",
    "centered": "center-framed hero composition with refined symmetry and depth",
    "left_text": "rule-of-thirds product hero framing with cleaner space on left side for optional headline",
    "top_bar": "product hero in lower thirds with premium upper negative space for optional typography",
}

TONE_STYLES = {
    "professional": "sophisticated premium retail look, refined and trustworthy",
    "playful": "vibrant premium lifestyle mood with polished production quality",
    "bold": "assertive luxury editorial energy with dramatic but controlled lighting",
    "luxury": "high-end luxury retail aesthetic with rich premium materials and textures",
}


def _infer_product_context(product_name: str, product_description: str, image_url: str | None) -> str:
    source = f"{product_name} {product_description} {image_url or ''}".lower()
    cues: list[str] = []
    keyword_to_cue = {
        "leather": "premium leather material cues",
        "metal": "brushed metal finish cues",
        "glass": "clean reflective glass surface cues",
        "wood": "natural wood grain texture cues",
        "shoe": "fashion footwear editorial styling cues",
        "watch": "luxury timepiece detail cues",
        "jewel": "fine jewelry sparkle and macro-detail cues",
        "bottle": "premium packaging and label-preservation cues",
    }
    for keyword, cue in keyword_to_cue.items():
        if keyword in source:
            cues.append(cue)

    if image_url:
        parsed = urlparse(image_url)
        if parsed.path:
            cues.append("reference image silhouette and color fidelity cues")

    if not cues:
        cues.append("category-appropriate premium product material cues")
    return ", ".join(dict.fromkeys(cues))


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
    product_image_url: str | None = None,
    brand_logo_url: str | None = None,
) -> str:
    angle_key = (angle or "benefit").lower().strip().replace("-", "_")
    layout_key = (layout or "centered").lower().strip()
    tone_key = (brand_tone or "professional").lower().strip()
    product_context = _infer_product_context(product_name, product_description, product_image_url)
    logo_placement = "subtle brand watermark badge in a corner, crisp and undistorted"
    if not brand_logo_url:
        logo_placement = "subtle corner brand-mark style badge, clean and undistorted"

    sections = [
        f"high-end editorial photography of {product_name}",
        f"product details: {product_description or 'premium commercial product showcase'}",
        f"brand identity: {brand_name}, tone {TONE_STYLES.get(tone_key, TONE_STYLES['professional'])}",
        f"industry context: {industry or 'consumer goods'}",
        f"visual angle: {ANGLE_STYLES.get(angle_key, ANGLE_STYLES['benefit'])}",
        f"composition: {LAYOUT_COMPOSITIONS.get(layout_key, LAYOUT_COMPOSITIONS['centered'])}",
        "hero product remains dominant focal subject (center or rule-of-thirds framing)",
        f"product context cues: {product_context}",
        f"background: premium, on-brand, luxurious, clean depth and premium textures with accents from {brand_color_hex}",
        "soft cinematic lighting, realistic shadows and reflections, realistic lens depth",
        f"logo treatment: {logo_placement}",
        "preserve product silhouette and true color accuracy",
        "keep ad-safe whitespace for optional headline and CTA overlays",
        "ultra-detailed premium retail ad style, photorealistic, high resolution",
        "avoid cluttered scenes, noisy backgrounds, distorted logos, extra text artifacts, low-resolution look",
        f"mood cue only from headline concept: {headline}",
    ]
    return ", ".join(sections)[:4500]


def generate_background_prompt(
    brand_name: str,
    brand_tone: str,
    industry: str,
    angle: str,
    layout: str,
    brand_color_hex: str,
) -> str:
    angle_key = (angle or "benefit").lower().strip().replace("-", "_")
    layout_key = (layout or "centered").lower().strip()
    tone_key = (brand_tone or "professional").lower().strip()
    sections = [
        f"premium high-end studio ad background for brand {brand_name}",
        f"tone: {TONE_STYLES.get(tone_key, TONE_STYLES['professional'])}",
        f"context: {industry or 'consumer goods'}",
        f"style: {ANGLE_STYLES.get(angle_key, ANGLE_STYLES['benefit'])}",
        f"layout: {LAYOUT_COMPOSITIONS.get(layout_key, LAYOUT_COMPOSITIONS['centered'])}",
        f"plain elegant backdrop with subtle gradient and premium material cues accented by {brand_color_hex}",
        "minimal uncluttered composition with soft cinematic lighting and realistic soft shadows",
        "empty center area reserved for composited product hero",
        "no products, no shoes, no sneakers, no footwear, no product silhouettes, no objects, no people, no logos, no text, no watermark",
        "clean premium look, photorealistic, high-resolution",
    ]
    return ", ".join(sections)[:2200]

"""Local generative backgrounds ported from AdVerb (AdVerb/ui + AdVerb/ml).

Uses deterministic palette selection and PIL gradients only — no Pollinations,
picsum, or other third-party image APIs.
"""

from __future__ import annotations

from io import BytesIO

from PIL import Image, ImageDraw

# Named solid backdrops from AdVerb/ml/generate_backgrounds.py (optional accent blend).
NAMED_BACKDROPS: list[tuple[str, tuple[int, int, int]]] = [
    ("black", (10, 10, 10)),
    ("white", (255, 255, 255)),
    ("deep-navy", (15, 27, 45)),
    ("slate", (30, 41, 59)),
    ("charcoal", (45, 45, 45)),
    ("cream", (250, 247, 242)),
    ("electric-blue", (26, 26, 255)),
    ("forest-green", (26, 58, 42)),
    ("deep-red", (45, 10, 10)),
    ("warm-grey", (232, 228, 223)),
]


def _hex_to_rgb(h: str) -> tuple[int, int, int]:
    h = h.strip().lstrip("#")
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


# Palettes from AdVerb/ui/src/lib/aiImageGenerator.ts (categoryPalettes + defaults).
_CATEGORY_PALETTES: dict[str, list[dict[str, str]]] = {
    "shoes": [
        {"start": "#1d4ed8", "end": "#38bdf8", "accent": "#facc15", "ink": "#0f172a"},
        {"start": "#7c3aed", "end": "#60a5fa", "accent": "#f59e0b", "ink": "#111827"},
    ],
    "nutrition": [
        {"start": "#15803d", "end": "#4ade80", "accent": "#f59e0b", "ink": "#052e16"},
        {"start": "#0891b2", "end": "#22d3ee", "accent": "#fb7185", "ink": "#083344"},
    ],
    "wearable": [
        {"start": "#0f172a", "end": "#334155", "accent": "#22d3ee", "ink": "#e2e8f0"},
        {"start": "#312e81", "end": "#4f46e5", "accent": "#67e8f9", "ink": "#eef2ff"},
    ],
    "yoga": [
        {"start": "#6d28d9", "end": "#c084fc", "accent": "#f472b6", "ink": "#faf5ff"},
        {"start": "#0f766e", "end": "#2dd4bf", "accent": "#f0abfc", "ink": "#f0fdfa"},
    ],
    "cycling": [
        {"start": "#0f766e", "end": "#06b6d4", "accent": "#f97316", "ink": "#042f2e"},
        {"start": "#1e3a8a", "end": "#3b82f6", "accent": "#fb923c", "ink": "#eff6ff"},
    ],
    "apparel": [
        {"start": "#4b5563", "end": "#94a3b8", "accent": "#f472b6", "ink": "#111827"},
        {"start": "#7f1d1d", "end": "#ef4444", "accent": "#fcd34d", "ink": "#fef2f2"},
    ],
}

_DEFAULT_PALETTES: list[dict[str, str]] = [
    {"start": "#1e293b", "end": "#64748b", "accent": "#22d3ee", "ink": "#f8fafc"},
    {"start": "#4c1d95", "end": "#a78bfa", "accent": "#f97316", "ink": "#f5f3ff"},
]


def hash_seed(input_str: str) -> int:
    """Match AdVerb aiImageGenerator hashSeed (uint32)."""
    h = 2166136261 & 0xFFFFFFFF
    for ch in input_str:
        h = (h ^ ord(ch)) & 0xFFFFFFFF
        h = (
            h
            + ((h << 1) & 0xFFFFFFFF)
            + ((h << 4) & 0xFFFFFFFF)
            + ((h << 7) & 0xFFFFFFFF)
            + ((h << 8) & 0xFFFFFFFF)
            + ((h << 24) & 0xFFFFFFFF)
        ) & 0xFFFFFFFF
    return h & 0xFFFFFFFF


def _industry_to_category(industry: str) -> str:
    s = (industry or "").lower()
    if any(k in s for k in ("shoe", "sneaker", "footwear", "boot")):
        return "shoes"
    if any(k in s for k in ("nutrition", "supplement", "food", "vitamin", "protein")):
        return "nutrition"
    if any(k in s for k in ("watch", "wearable", "fitness tracker")):
        return "wearable"
    if "yoga" in s or "pilates" in s:
        return "yoga"
    if "cycl" in s or "bike" in s:
        return "cycling"
    if any(k in s for k in ("apparel", "fashion", "clothing", "textile")):
        return "apparel"
    return "general"


def select_palette(category: str, seed: int) -> dict[str, str]:
    key = category.lower().strip() if category else "general"
    options = _CATEGORY_PALETTES.get(key, _DEFAULT_PALETTES)
    return options[seed % len(options)]


def infer_visual_tone(brand_tone: str | None) -> str:
    if not brand_tone:
        return "vibrant"
    normalized = brand_tone.lower()
    if any(w in normalized for w in ("minimal", "clean", "simple")):
        return "minimal"
    if any(w in normalized for w in ("premium", "luxury", "elegant")):
        return "premium"
    return "vibrant"


def _palette_for_context(
    *,
    industry: str,
    brand_tone: str | None,
    angle: str | None,
    seed: int,
) -> dict[str, str]:
    category = _industry_to_category(industry)
    angle_mix = hash_seed((angle or "benefit").lower()) & 0xFF
    base = select_palette(category, seed ^ angle_mix)
    tone = infer_visual_tone(brand_tone)
    if tone == "minimal":
        return {"start": "#0f172a", "end": "#334155", "accent": "#e2e8f0", "ink": "#f8fafc"}
    if tone == "premium":
        return {"start": "#3f2a1d", "end": "#8b5e34", "accent": "#facc15", "ink": "#fff7ed"}
    return base


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _vertical_gradient_rgb(
    width: int,
    height: int,
    top: tuple[int, int, int],
    bottom: tuple[int, int, int],
) -> Image.Image:
    img = Image.new("RGB", (width, height))
    pix = img.load()
    assert pix is not None
    max_y = max(height - 1, 1)
    for y in range(height):
        t = y / max_y
        r = int(_lerp(top[0], bottom[0], t))
        g = int(_lerp(top[1], bottom[1], t))
        b = int(_lerp(top[2], bottom[2], t))
        for x in range(width):
            pix[x, y] = (r, g, b)
    return img


def _accent_radial_soft(
    base: Image.Image,
    accent: tuple[int, int, int],
    seed: int,
) -> Image.Image:
    """Subtle corner wash using accent color (deterministic)."""
    w, h = base.size
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    cx = int(w * (0.25 + (seed % 47) / 200.0))
    cy = int(h * (0.2 + ((seed >> 3) % 37) / 200.0))
    r = int(min(w, h) * 0.55)
    ar, ag, ab = accent
    draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=(ar, ag, ab, 38))
    return Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")


def _named_backdrop_tint(seed: int) -> tuple[int, int, int]:
    _, rgb = NAMED_BACKDROPS[seed % len(NAMED_BACKDROPS)]
    return rgb


def render_adverb_background_bytes(
    width: int,
    height: int,
    *,
    industry: str = "",
    brand_tone: str | None = None,
    angle: str | None = None,
    brand_name: str = "",
    seed: int | None = None,
) -> bytes:
    """Raster background: gradient from AdVerb palettes + light named-backdrop tint."""
    seed_val = int(seed) if seed is not None else 0
    palette_key = f"{brand_name}|{industry}|{angle or ''}|{seed_val}"
    palette_seed = hash_seed(palette_key)
    pal = _palette_for_context(
        industry=industry,
        brand_tone=brand_tone,
        angle=angle,
        seed=palette_seed,
    )
    top = _hex_to_rgb(pal["start"])
    bottom = _hex_to_rgb(pal["end"])
    accent = _hex_to_rgb(pal["accent"])

    img = _vertical_gradient_rgb(width, height, top, bottom)
    img = _accent_radial_soft(img, accent, palette_seed)

    # Blend a sliver of catalog solid (AdVerb/ml/generate_backgrounds.py) for variety.
    tint = _named_backdrop_tint(palette_seed ^ seed_val)
    tint_layer = Image.new("RGB", (width, height), tint)
    img = Image.blend(img, tint_layer, alpha=0.08)

    buf = BytesIO()
    img.save(buf, format="WEBP", quality=92)
    return buf.getvalue()

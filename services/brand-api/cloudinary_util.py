import os
import re
from typing import Optional

import cloudinary
import cloudinary.uploader


def configure():
    cloudinary.config(
        cloud_name=os.environ.get("CLOUDINARY_CLOUD_NAME"),
        api_key=os.environ.get("CLOUDINARY_API_KEY"),
        api_secret=os.environ.get("CLOUDINARY_API_SECRET"),
    )


def upload_file(file_bytes: bytes, folder: str, public_id_prefix: str) -> str:
    configure()
    res = cloudinary.uploader.upload(
        file_bytes,
        folder=folder,
        resource_type="image",
        use_filename=True,
        unique_filename=True,
    )
    return res.get("secure_url") or res.get("url")


def extract_public_id_from_url(url: str) -> Optional[str]:
    """Extract Cloudinary public_id from a full URL if hosted on cloudinary."""
    if not url or "res.cloudinary.com" not in url:
        return None
    m = re.search(r"/upload/(?:v\d+/)?(.+)$", url)
    if not m:
        return None
    path = m.group(1)
    if "." in path:
        path = path.rsplit(".", 1)[0]
    return path


# Order pairs variant index i with compose style (aligned with replicate image_prompt_generator cues).
LAYOUTS = ["bottom_bar", "centered", "left_text", "top_bar"]
BACKGROUND_HEX = ["1a1a2e", "0f3460", "16213e", "533483"]

_CANVAS_W = 1200
_CANVAS_H = 628
_PHOTO_W = 696  # ~58% photo strip — remainder is a dedicated copy rail (no text/product overlap)

_RAIL_LINE = 18  # chars — fits ~504px rail at headline sizes


def _sanitize_overlay_text(s: str, max_len: int) -> str:
    if not s:
        return ""
    s = s.strip()
    if not s:
        return ""
    for old, new in (
        ("%", "%25"),
        (",", "%2C"),
        ("\n", " "),
        ("\r", ""),
        ("#", "%23"),
    ):
        s = s.replace(old, new)
    return s[:max_len]


def _wrap_to_lines(text: str, max_chars: int, max_lines: int = 5) -> str:
    words = text.split()
    if not words:
        return ""
    lines: list[str] = []
    cur: list[str] = []
    for w in words:
        trial = " ".join(cur + [w])
        if len(trial) <= max_chars:
            cur.append(w)
        else:
            if cur:
                lines.append(" ".join(cur))
                if len(lines) >= max_lines:
                    break
            if len(lines) < max_lines:
                if len(w) > max_chars:
                    w = w[: max_chars - 1] + "…"
                cur = [w]
    if len(lines) < max_lines and cur:
        lines.append(" ".join(cur))
    return "\n".join(lines[:max_lines])


def _brand_bg_rgb(brand_hex: str, alpha_suffix: str = "e6") -> str:
    h = brand_hex.lstrip("#").lower()
    if len(h) != 6 or not re.fullmatch(r"[0-9a-f]{6}", h):
        h = "6366f1"
    return f"rgb:{h}{alpha_suffix}"


def _split_rail_base(bg_hex: str) -> list[dict]:
    """
    Build a fixed split: color block on the left (copy safe zone) + product/lifestyle
    image on the right only. Prevents text from ever sitting on top of the product.

    1) Smart-crop the photo to the right column.
    2) Pad to full canvas with gravity east → left ~504px is solid brand panel.
    """
    return [
        {"width": _PHOTO_W, "height": _CANVAS_H, "crop": "fill", "gravity": "auto"},
        {
            "width": _CANVAS_W,
            "height": _CANVAS_H,
            "crop": "pad",
            "gravity": "east",
            "background": f"#{bg_hex}",
        },
        {"effect": "improve"},
    ]


def _rail_headline(text: str, font_size: int, y: int, line_chars: int) -> dict:
    return {
        "overlay": {
            "font_family": "Arial",
            "font_size": font_size,
            "font_weight": "bold",
            "text": _wrap_to_lines(text, line_chars),
        },
        "color": "white",
        "gravity": "west",
        "x": 40,
        "y": y,
    }


def _rail_sub(text: str, y: int, line_chars: int) -> dict:
    return {
        "overlay": {
            "font_family": "Arial",
            "font_size": 22,
            "text": _wrap_to_lines(text, line_chars, max_lines=3),
        },
        "color": "white",
        "gravity": "west",
        "x": 40,
        "y": y,
    }


def _rail_cta(text: str, brand_hex: str, y: int, font_size: int = 28) -> dict:
    return {
        "overlay": {
            "font_family": "Arial",
            "font_size": font_size,
            "font_weight": "bold",
            "text": text,
        },
        "color": "white",
        "background": _brand_bg_rgb(brand_hex),
        "flags": "text_no_trim",
        "gravity": "west",
        "x": 40,
        "y": y,
    }


def _brand_tag_rail(name: str) -> dict:
    return {
        "overlay": {
            "font_family": "Arial",
            "font_size": 19,
            "font_weight": "bold",
            "text": name,
        },
        "color": "white",
        "gravity": "north_west",
        "x": 36,
        "y": 32,
    }


def assemble_creative_url(
    product_image_url: str,
    headline: str,
    subheadline: str,
    cta: str,
    layout: str,
    bg_hex: str,
    brand_hex: str,
    brand_name: str = "",
) -> str:
    """
    Split-rail social ad: copy lives only in the left panel; photo never has type on it.
    `product_image_url` may be the catalog shot or an AI lifestyle scene URL on Cloudinary.
    """
    configure()
    public_id = extract_public_id_from_url(product_image_url)
    if not public_id or not os.environ.get("CLOUDINARY_CLOUD_NAME"):
        return product_image_url

    h = _sanitize_overlay_text(headline, 220) or "Discover more"
    sub = _sanitize_overlay_text(subheadline, 260)
    c = _sanitize_overlay_text(cta, 36) or "Shop now"
    brand_tag = _sanitize_overlay_text(brand_name, 36)

    transformations = _split_rail_base(bg_hex)

    if brand_tag:
        transformations.append(_brand_tag_rail(brand_tag))

    tag_bump = 48 if brand_tag else 0

    # y offsets are for gravity=west (horizontal rail); tuned so stacks stay inside left panel.
    if layout == "centered":
        transformations += [
            _rail_headline(h, 34, -108 + tag_bump // 4, _RAIL_LINE),
        ]
        if sub:
            transformations.append(_rail_sub(sub, -18 + tag_bump // 4, _RAIL_LINE))
        transformations.append(_rail_cta(c, brand_hex, 115 + tag_bump // 3))

    elif layout == "bottom_bar":
        transformations += [
            _rail_headline(h, 33, 38 + tag_bump, _RAIL_LINE),
        ]
        if sub:
            transformations.append(_rail_sub(sub, 128 + tag_bump, _RAIL_LINE))
        transformations.append(_rail_cta(c, brand_hex, 232 + min(tag_bump, 20)))

    elif layout == "top_bar":
        y0 = -195 + (tag_bump if brand_tag else 0)
        transformations += [
            _rail_headline(h, 32, y0, _RAIL_LINE),
        ]
        if sub:
            transformations.append(_rail_sub(sub, y0 + 86, _RAIL_LINE))
        transformations.append(_rail_cta(c, brand_hex, y0 + 178, font_size=26))

    else:
        # left_text: editorial stack in the middle of the rail
        transformations += [
            _rail_headline(h, 33, -95 + tag_bump // 3, _RAIL_LINE),
        ]
        if sub:
            transformations.append(_rail_sub(sub, 12 + tag_bump // 3, _RAIL_LINE))
        transformations.append(_rail_cta(c, brand_hex, 125 + tag_bump // 2))

    try:
        from cloudinary import CloudinaryImage

        url = CloudinaryImage(public_id).build_url(
            transformation=transformations,
            secure=True,
        )
        return url or product_image_url
    except Exception:
        return product_image_url

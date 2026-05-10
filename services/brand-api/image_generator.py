"""Generate ad creatives: Pollinations or local PIL backdrops, Cloudinary upload."""

from __future__ import annotations

import json
import logging
import os
import threading
import time
from io import BytesIO
from urllib.parse import quote

import cloudinary.uploader
import httpx
from PIL import Image, ImageFilter

from adverb_creative_gen import render_adverb_background_bytes
from cloudinary_util import configure

POLLINATIONS_BASE_URL = (
    os.environ.get("POLLINATIONS_BASE_URL") or "https://image.pollinations.ai/prompt"
).rstrip("/")

DEFAULT_NEGATIVE = (
    "text, words, letters, watermark, blurry, low quality, distorted, ugly, cartoon"
)

logger = logging.getLogger(__name__)

# Serialize Pollinations HTTP calls — concurrent variants share one free-tier quota.
_POLLINATIONS_HTTP_LOCK = threading.Lock()

def _upload_cloudinary(image_data: bytes) -> dict[str, int | str]:
    configure()
    res = cloudinary.uploader.upload(
        BytesIO(image_data),
        folder="adverb/ai-creatives",
        resource_type="image",
        use_filename=False,
        unique_filename=True,
        format="webp",
        quality="auto",
    )
    return {
        "url": res.get("secure_url") or res.get("url") or "",
        "width": int(res.get("width") or 0),
        "height": int(res.get("height") or 0),
    }


def _basic_quality_score(width: int, height: int, image_bytes: bytes) -> float:
    # Heuristic score for rejecting visibly weak generations before persistence.
    px = width * height
    size = len(image_bytes)
    score = 0.0
    if px >= 512 * 512:
        score += 0.45
    if px >= 1024 * 576:
        score += 0.25
    if size >= 120_000:
        score += 0.2
    if size >= 240_000:
        score += 0.1
    return min(score, 1.0)


def _contain_size(src_w: int, src_h: int, max_w: int, max_h: int) -> tuple[int, int]:
    if src_w <= 0 or src_h <= 0:
        return max_w, max_h
    ratio = min(max_w / src_w, max_h / src_h)
    out_w = max(1, int(src_w * ratio))
    out_h = max(1, int(src_h * ratio))
    return out_w, out_h


def _compose_final(
    background_bytes: bytes,
    width: int,
    height: int,
    product_image_url: str | None,
    brand_logo_url: str | None,
) -> bytes:
    with Image.open(BytesIO(background_bytes)) as bg_img:
        canvas = bg_img.convert("RGBA").resize((width, height))

    with httpx.Client(timeout=60.0, follow_redirects=True) as http:
        if product_image_url:
            resp = http.get(product_image_url)
            if resp.status_code == 200 and (resp.headers.get("content-type") or "").lower().startswith("image/"):
                with Image.open(BytesIO(resp.content)) as product_img:
                    product = product_img.convert("RGBA")
                    max_w = int(width * 0.72)
                    max_h = int(height * 0.68)
                    prod_w, prod_h = _contain_size(product.width, product.height, max_w, max_h)
                    product = product.resize((prod_w, prod_h))

                    # Subtle shadow so pasted product feels grounded in generated background.
                    shadow = Image.new("RGBA", (prod_w, prod_h), (0, 0, 0, 0))
                    shadow_alpha = product.split()[-1].point(lambda p: int(p * 0.35))
                    shadow.putalpha(shadow_alpha)
                    shadow = shadow.filter(ImageFilter.GaussianBlur(radius=8))

                    x = (width - prod_w) // 2
                    y = int(height * 0.22)
                    shadow_y = min(height - prod_h, y + 12)
                    canvas.alpha_composite(shadow, (x, shadow_y))
                    canvas.alpha_composite(product, (x, y))

        if brand_logo_url:
            resp = http.get(brand_logo_url)
            if resp.status_code == 200 and (resp.headers.get("content-type") or "").lower().startswith("image/"):
                with Image.open(BytesIO(resp.content)) as logo_img:
                    logo = logo_img.convert("RGBA")
                    logo_max_w = int(width * 0.22)
                    logo_max_h = int(height * 0.18)
                    logo_w, logo_h = _contain_size(logo.width, logo.height, logo_max_w, logo_max_h)
                    logo = logo.resize((logo_w, logo_h))

                    margin = int(min(width, height) * 0.03)
                    pad = max(6, int(min(width, height) * 0.01))
                    badge_w = logo_w + (pad * 2)
                    badge_h = logo_h + (pad * 2)
                    badge = Image.new("RGBA", (badge_w, badge_h), (255, 255, 255, 225))

                    lx = width - badge_w - margin
                    ly = margin
                    canvas.alpha_composite(badge, (lx, ly))
                    canvas.alpha_composite(logo, (lx + pad, ly + pad))

    out = BytesIO()
    canvas.convert("RGB").save(out, format="WEBP", quality=92)
    return out.getvalue()


def _composite_from_background_bytes(
    background_bytes: bytes,
    width: int,
    height: int,
    product_image_url: str | None,
    brand_logo_url: str | None,
) -> dict[str, int | float | str]:
    final_bytes = _compose_final(
        background_bytes=background_bytes,
        width=width,
        height=height,
        product_image_url=product_image_url,
        brand_logo_url=brand_logo_url,
    )
    uploaded = _upload_cloudinary(final_bytes)
    width_out = int(uploaded.get("width") or 0)
    height_out = int(uploaded.get("height") or 0)
    score = _basic_quality_score(width_out, height_out, final_bytes)
    uploaded["quality_score"] = score
    return uploaded


def generate_ad_image(
    prompt: str,
    negative_prompt: str | None = None,
    width: int = 1024,
    height: int = 576,
    product_image_url: str | None = None,
    brand_logo_url: str | None = None,
) -> str:
    data = generate_ad_image_with_meta(
        prompt=prompt,
        negative_prompt=negative_prompt,
        width=width,
        height=height,
        product_image_url=product_image_url,
        brand_logo_url=brand_logo_url,
    )
    return str(data["url"])


def generate_ad_image_with_meta(
    prompt: str,
    negative_prompt: str | None = None,
    width: int = 1024,
    height: int = 576,
    seed: int | None = None,
    product_image_url: str | None = None,
    brand_logo_url: str | None = None,
    background_variant: int | None = None,
    industry: str | None = None,
    brand_tone: str | None = None,
    angle: str | None = None,
    brand_name: str | None = None,
) -> dict[str, int | float | str]:
    # Always use Pollinations (default) or local PIL (`AD_IMAGE_BACKEND=adverb`); no plain-background shortcut.
    # Default Pollinations; set AD_IMAGE_BACKEND=adverb for local-only PIL gradients.
    backend = (os.environ.get("AD_IMAGE_BACKEND") or "pollinations").strip().lower()
    if backend != "pollinations":
        bg_bytes = render_adverb_background_bytes(
            width,
            height,
            industry=industry or "",
            brand_tone=brand_tone,
            angle=angle,
            brand_name=brand_name or "",
            seed=seed,
        )
        return _composite_from_background_bytes(
            bg_bytes, width, height, product_image_url, brand_logo_url
        )

    neg = negative_prompt if negative_prompt is not None else DEFAULT_NEGATIVE
    full_prompt = f"{prompt}, negative constraints: {neg}"
    encoded = quote(full_prompt, safe="")
    endpoint = f"{POLLINATIONS_BASE_URL}/{encoded}"

    params = {"width": width, "height": height, "nologo": "true"}
    if seed is not None:
        params["seed"] = seed

    max_retries = int(os.environ.get("POLLINATIONS_MAX_RETRIES", "6"))
    retry_base_seconds = float(os.environ.get("POLLINATIONS_RETRY_BASE_SECONDS", "2.0"))
    jitter_seconds = float(os.environ.get("POLLINATIONS_RETRY_JITTER_SECONDS", "0.25"))
    last_error = "unknown error"
    response = None

    with _POLLINATIONS_HTTP_LOCK:
        with httpx.Client(timeout=180.0, follow_redirects=True) as http:
            for attempt in range(max_retries + 1):
                try:
                    response = http.get(endpoint, params=params)
                except Exception as exc:  # noqa: BLE001
                    last_error = f"Pollinations request failed: {exc}"
                    if attempt >= max_retries:
                        break
                    time.sleep(retry_base_seconds * (2**attempt) + jitter_seconds)
                    continue

                if response.status_code == 200:
                    break

                snippet = response.text[:500]
                try:
                    decoded = json.loads(response.content)
                    if isinstance(decoded, dict):
                        snippet = str(decoded.get("error") or decoded)
                except json.JSONDecodeError:
                    pass

                if response.status_code == 429 and attempt < max_retries:
                    retry_after_raw = response.headers.get("retry-after")
                    retry_after = 0.0
                    if retry_after_raw:
                        try:
                            retry_after = float(retry_after_raw)
                        except ValueError:
                            retry_after = 0.0
                    exp = retry_base_seconds * (2**attempt)
                    sleep_for = max(retry_after, 4.0, exp) + jitter_seconds
                    logger.warning(
                        "Pollinations 429 (attempt %s/%s), sleeping %.2fs",
                        attempt + 1,
                        max_retries + 1,
                        sleep_for,
                    )
                    time.sleep(sleep_for)
                    last_error = f"Pollinations rate limited (429): {snippet}"
                    continue

                last_error = f"Pollinations error {response.status_code}: {snippet}"
                if attempt >= max_retries:
                    break
                time.sleep((retry_base_seconds * (2**attempt)) + jitter_seconds)
            else:
                response = None  # pragma: no cover

    if response is None or response.status_code != 200:
        fallback = os.environ.get("POLLINATIONS_FALLBACK_TO_LOCAL", "true").strip().lower() in (
            "1",
            "true",
            "yes",
            "on",
        )
        if fallback:
            logger.warning(
                "Pollinations failed after retries (%s); using local PIL background",
                last_error,
            )
            bg_bytes = render_adverb_background_bytes(
                width,
                height,
                industry=industry or "",
                brand_tone=brand_tone,
                angle=angle,
                brand_name=brand_name or "",
                seed=seed,
            )
            return _composite_from_background_bytes(
                bg_bytes, width, height, product_image_url, brand_logo_url
            )
        if response is None:
            raise RuntimeError(f"Pollinations failed after retries: {last_error}")
        raise RuntimeError(last_error)

    ct = (response.headers.get("content-type") or "").lower()
    if not ct.startswith("image/"):
        raise RuntimeError(f"Pollinations unexpected content-type {ct!r} len={len(response.content)}")

    return _composite_from_background_bytes(
        response.content,
        width,
        height,
        product_image_url,
        brand_logo_url,
    )


def generate_ad_image_fast(prompt: str) -> str:
    """Alias for creatives that toggle fast generation mode."""
    return generate_ad_image(prompt)


def replicate_service_enabled() -> bool:
    """Name kept for ``routers.creatives`` imports."""
    return True

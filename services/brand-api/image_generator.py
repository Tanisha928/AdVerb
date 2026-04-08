"""Generate ad creatives via Hugging Face Inference API, persist to Cloudinary."""

from __future__ import annotations

import json
import os
from io import BytesIO

import cloudinary.uploader
import httpx

from cloudinary_util import configure

# Routed HF Inference hosts only an allow-listed catalog — try resilient defaults first.
MODELS = (
    "black-forest-labs/FLUX.1-schnell",
    "stabilityai/stable-diffusion-xl-base-1.0",
    "runwayml/stable-diffusion-v1-5",
)

DEFAULT_NEGATIVE = (
    "text, words, letters, watermark, blurry, low quality, distorted, ugly, cartoon"
)

# Legacy https://api-inference.huggingface.co is shut down; router serves hf-inference now.
HF_INFERENCE_ORIGIN = (
    os.environ.get("HF_INFERENCE_ORIGIN") or "https://router.huggingface.co/hf-inference"
).rstrip("/")


def _upload_cloudinary(image_data: bytes) -> str:
    configure()
    res = cloudinary.uploader.upload(
        BytesIO(image_data),
        folder="adaptai/ai-creatives",
        resource_type="image",
        use_filename=False,
        unique_filename=True,
        format="webp",
        quality="auto",
    )
    return res.get("secure_url") or res.get("url") or ""


def generate_ad_image(
    prompt: str,
    negative_prompt: str | None = None,
    width: int = 1024,
    height: int = 576,
) -> str:
    """
    Text-to-image via Hugging Face Inference API (sync for ThreadPoolExecutor workers).
    Tries MODELS sequentially; skips duplicate ids if overridden via env primary.
    """
    token = (
        os.environ.get("HF_API_TOKEN")
        or os.environ.get("HF_TOKEN")
        or os.environ.get("HUGGINGFACEHUB_API_TOKEN")
        or ""
    ).strip()
    if not token:
        raise RuntimeError("HF_API_TOKEN (or HF_TOKEN) is not set")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }

    neg = negative_prompt if negative_prompt is not None else DEFAULT_NEGATIVE
    payload = {
        "inputs": prompt,
        "parameters": {
            "negative_prompt": neg,
            "num_inference_steps": int(os.environ.get("HF_DIFFUSION_STEPS", "25")),
            "guidance_scale": float(os.environ.get("HF_GUIDANCE_SCALE", "7.5")),
            "width": width,
            "height": height,
        },
        "options": {
            "wait_for_model": True,
            "use_cache": False,
        },
    }

    tried: list[str] = []
    models_order: list[str] = []
    for m in MODELS:
        if m and m not in models_order:
            models_order.append(m)

    last_error: str | None = None

    with httpx.Client(timeout=180.0, follow_redirects=True) as http:
        for model in models_order:
            tried.append(model)
            endpoint = f"{HF_INFERENCE_ORIGIN}/models/{model}"
            try:
                response = http.post(endpoint, headers=headers, json=payload)
            except Exception as exc:  # noqa: BLE001
                last_error = str(exc)
                continue

            if response.status_code == 200:
                ct = (response.headers.get("content-type") or "").lower()
                if ct.startswith("image/"):
                    return _upload_cloudinary(response.content)
                # Occasionally JSON wraps base64 errors
                last_error = f"{model}: unexpected content-type {ct!r} len={len(response.content)}"
                continue

            if response.status_code == 503:
                last_error = f"Model {model} unavailable (503)"
                continue

            snippet = response.text[:500]
            last_error = f"Model {model} error {response.status_code}: {snippet}"
            # Parse HF JSON error once for clarity
            if response.headers.get("content-type", "").startswith("application/json"):
                try:
                    decoded = json.loads(response.content)
                    if isinstance(decoded, dict) and "error" in decoded:
                        last_error = f"{model}: {decoded.get('error')}"
                except json.JSONDecodeError:
                    pass

    raise RuntimeError(f"All HuggingFace Inference models failed. Tried={tried!r}. Last: {last_error}")


def generate_ad_image_fast(prompt: str) -> str:
    """Alias for creatives that toggle ``AD_REPLICATE_FAST`` — identical HF pipeline."""
    return generate_ad_image(prompt)


def replicate_service_enabled() -> bool:
    """Name kept for ``routers.creatives`` imports — checks HF token."""
    return bool(
        (os.environ.get("HF_API_TOKEN") or os.environ.get("HF_TOKEN") or "").strip()
    )

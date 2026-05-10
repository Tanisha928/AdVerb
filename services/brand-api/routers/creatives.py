import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Brand, Campaign, Creative, Product
from schemas import CreativeGenerateRequest, CreativeOut, CreativeReview
from groq_copy import generate_ad_copy
from cloudinary_util import LAYOUTS
from image_prompt_generator import generate_background_prompt
from image_generator import (
    replicate_service_enabled,
    generate_ad_image,
    generate_ad_image_fast,
    generate_ad_image_with_meta,
)

router = APIRouter(tags=["creatives"])

VARIANT_ANGLES = ["social_proof", "urgency", "benefit", "curiosity"]

ANGLE_BACKGROUND_HEX = {
    "social_proof": "#7c3aed",
    "urgency": "#dc2626",
    "benefit": "#0d9488",
    "curiosity": "#d97706",
}


def _background_for_angle(angle: str) -> str:
    norm = (angle or "").lower().strip().replace("-", "_")
    return ANGLE_BACKGROUND_HEX.get(norm, "#6366f1")


def _replicate_generation_fn():
    flag = os.environ.get("AD_REPLICATE_FAST", "").strip().lower()
    if flag in ("1", "true", "yes", "on"):
        return generate_ad_image_fast
    return generate_ad_image


def _worker_render_variant(payload: tuple) -> dict:
    """Runs in ThreadPoolExecutor; must not touch SQLAlchemy session."""
    (
        product_name,
        product_description,
        brand_name,
        brand_tone,
        industry,
        primary_hex,
        brand_logo_url,
        product_image_url,
        i,
        v,
    ) = payload

    headline = v.get("headline") or "Discover more"
    sub = (v.get("subheadline") or "")[:300]
    cta = (v.get("cta") or "Shop now")[:80]
    angle_raw = v.get("angle") or VARIANT_ANGLES[i]
    angle_norm = angle_raw.lower().strip().replace("-", "_")

    layout = LAYOUTS[i % len(LAYOUTS)]

    image_prompt = generate_background_prompt(
        brand_name=brand_name,
        brand_tone=brand_tone,
        industry=industry or "consumer goods",
        angle=angle_norm,
        layout=layout,
        brand_color_hex=primary_hex or "#6366f1",
    )

    gen_fn = _replicate_generation_fn()
    max_attempts = int(os.environ.get("AD_CREATIVE_VARIANT_ATTEMPTS", "2"))
    best_candidate: dict | None = None
    last_error: str | None = None
    for attempt in range(max_attempts):
        seed = ((i + 1) * 1000) + attempt
        try:
            candidate = generate_ad_image_with_meta(
                image_prompt,
                negative_prompt="shoe, sneaker, footwear, product, extra object, text, watermark, logo distortion, clutter",
                width=1024,
                height=576,
                seed=seed,
                product_image_url=product_image_url,
                brand_logo_url=brand_logo_url,
                background_variant=i,
                industry=industry or "",
                brand_tone=brand_tone,
                angle=angle_norm,
                brand_name=brand_name,
            )
        except Exception as exc:  # noqa: BLE001
            last_error = str(exc)
            continue
        quality_score = float(candidate.get("quality_score") or 0.0)
        if (best_candidate is None) or (quality_score > float(best_candidate.get("quality_score") or 0.0)):
            best_candidate = candidate
        if quality_score >= 0.65:
            break

    assembled_url = ""
    quality_score = 0.0
    if best_candidate:
        assembled_url = str(best_candidate.get("url") or "")
        quality_score = float(best_candidate.get("quality_score") or 0.0)
    if not assembled_url:
        # Fallback keeps previous behavior if metadata call unexpectedly fails.
        try:
            assembled_url = gen_fn(
                image_prompt,
                negative_prompt="shoe, sneaker, footwear, product, extra object, text, watermark, logo distortion, clutter",
                product_image_url=product_image_url,
                brand_logo_url=brand_logo_url,
            )
        except Exception as exc:  # noqa: BLE001
            detail = last_error or str(exc)
            raise RuntimeError(f"Variant render failed after retries: {detail}") from exc

    return {
        "headline": headline[:200],
        "subheadline": sub,
        "cta": cta[:80],
        "angle": angle_raw,
        "layout": layout,
        "assembled_image_url": assembled_url,
        "background_color": _background_for_angle(angle_norm),
        "quality_score": quality_score,
    }


@router.post("/campaigns/{campaign_id}/generate-creatives", response_model=list[CreativeOut])
def generate_creatives(
    campaign_id: UUID,
    body: CreativeGenerateRequest,
    db: Session = Depends(get_db),
):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    brand = db.query(Brand).filter(Brand.id == campaign.brand_id).first()
    product = (
        db.query(Product)
        .filter(Product.campaign_id == campaign_id, Product.id == body.product_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=400, detail="Selected product was not found in this campaign")

    if not replicate_service_enabled():
        raise HTTPException(
            status_code=503,
            detail="Image generation is not available — check brand-api configuration",
        )
    initial_status = campaign.status or "draft"

    if campaign.status == "generating":
        existing_count = (
            db.query(Creative).filter(Creative.campaign_id == campaign_id).count()
        )
        target_ready_count = 3
        if existing_count >= target_ready_count:
            # Recovery path: prior run completed enough creatives but status wasn't flipped.
            campaign.status = "review"
            db.commit()
            existing_count = 0
        elif existing_count == 0:
            # Recovery path for interrupted generation runs (e.g., container restart mid-request).
            campaign.status = "review"
            db.commit()
        if existing_count > 0:
            raise HTTPException(status_code=409, detail="Creative generation already in progress for this campaign")

    campaign.status = "generating"
    db.commit()

    created: list[Creative] = []
    try:
        data = generate_ad_copy(
            product.name,
            product.description or "",
            list(product.key_benefits or []),
            brand.tone if brand else "professional",
            brand.name if brand else "Brand",
        )
        variants = data.get("variants") or []
        if len(variants) < 3:
            raise HTTPException(status_code=502, detail="AI returned fewer than 3 variants")

        brand_primary = brand.color_primary if brand else "#6366f1"
        brand_logo_url = (brand.logo_url if brand else None)
        target_variant_count = 3
        payloads = tuple(
            (
                product.name,
                product.description or "",
                brand.name if brand else "Brand",
                brand.tone if brand else "professional",
                (brand.industry if brand else None),
                brand_primary,
                brand_logo_url,
                product.image_url,
                i,
                variants[i],
            )
            for i in range(target_variant_count)
        )

        max_workers = int(os.environ.get("AD_CREATIVE_MAX_WORKERS", "1"))
        max_workers = max(1, min(max_workers, target_variant_count))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_map = {executor.submit(_worker_render_variant, p): p[-2] for p in payloads}

            merged: dict[int, dict] = {}
            for fut in as_completed(future_map):
                idx = future_map[fut]
                merged[idx] = fut.result()

        ranked_rows = sorted(
            [merged[i] for i in range(target_variant_count)],
            key=lambda r: float(r.get("quality_score") or 0.0),
            reverse=True,
        )

        selected_rows = ranked_rows[:3]
        if len(selected_rows) < 3:
            raise HTTPException(status_code=502, detail="AI returned fewer than 3 acceptable variants")

        for row in selected_rows:
            cr = Creative(
                product_id=product.id,
                campaign_id=campaign_id,
                headline=row["headline"],
                subheadline=row["subheadline"],
                cta=row["cta"],
                angle=row["angle"],
                layout=row["layout"],
                background_color=row["background_color"],
                assembled_image_url=row["assembled_image_url"],
                status="pending",
            )
            db.add(cr)
            created.append(cr)

        db.commit()
        for cr in created:
            db.refresh(cr)
        campaign.status = "live" if initial_status == "live" else "review"
        db.commit()
    except HTTPException:
        db.rollback()
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if campaign:
            campaign.status = "live" if initial_status == "live" else "review"
            db.commit()
        raise
    except Exception as e:
        db.rollback()
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if campaign:
            campaign.status = "live" if initial_status == "live" else "review"
            db.commit()
        raise HTTPException(status_code=502, detail=str(e)) from e

    return created


@router.get("/campaigns/{campaign_id}/creatives", response_model=list[CreativeOut])
def list_creatives(campaign_id: UUID, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if campaign.status == "generating":
        count = db.query(Creative).filter(Creative.campaign_id == campaign_id).count()
        if count == 0 or count >= 3:
            campaign.status = "review"
            db.commit()
    return (
        db.query(Creative)
        .filter(Creative.campaign_id == campaign_id)
        .order_by(Creative.created_at)
        .all()
    )


@router.patch("/creatives/{creative_id}/review", response_model=CreativeOut)
def review_creative(creative_id: UUID, body: CreativeReview, db: Session = Depends(get_db)):
    if body.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="status must be approved or rejected")
    cr = db.query(Creative).filter(Creative.id == creative_id).first()
    if not cr:
        raise HTTPException(status_code=404, detail="Creative not found")
    cr.status = body.status
    cr.rejection_note = body.rejection_note if body.status == "rejected" else None
    db.commit()
    db.refresh(cr)
    return cr

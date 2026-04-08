import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Brand, Campaign, Creative, Product
from schemas import CreativeOut, CreativeReview
from groq_copy import generate_ad_copy
from cloudinary_util import LAYOUTS
from image_prompt_generator import generate_image_prompt
from image_generator import replicate_service_enabled, generate_ad_image, generate_ad_image_fast

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
        i,
        v,
    ) = payload

    headline = v.get("headline") or "Discover more"
    sub = (v.get("subheadline") or "")[:300]
    cta = (v.get("cta") or "Shop now")[:80]
    angle_raw = v.get("angle") or VARIANT_ANGLES[i]
    angle_norm = angle_raw.lower().strip().replace("-", "_")

    layout = LAYOUTS[i % len(LAYOUTS)]

    image_prompt = generate_image_prompt(
        product_name=product_name,
        product_description=product_description or "",
        brand_name=brand_name,
        brand_tone=brand_tone,
        industry=industry or "consumer goods",
        angle=angle_norm,
        layout=layout,
        headline=headline,
        brand_color_hex=primary_hex or "#6366f1",
    )

    gen_fn = _replicate_generation_fn()
    assembled_url = gen_fn(image_prompt)

    return {
        "headline": headline[:200],
        "subheadline": sub,
        "cta": cta[:80],
        "angle": angle_raw,
        "layout": layout,
        "assembled_image_url": assembled_url,
        "background_color": _background_for_angle(angle_norm),
    }


@router.post("/campaigns/{campaign_id}/generate-creatives", response_model=list[CreativeOut])
def generate_creatives(campaign_id: UUID, db: Session = Depends(get_db)):
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    brand = db.query(Brand).filter(Brand.id == campaign.brand_id).first()
    products = db.query(Product).filter(Product.campaign_id == campaign_id).all()
    if not products:
        raise HTTPException(status_code=400, detail="Add at least one product before generating creatives")

    if not replicate_service_enabled():
        raise HTTPException(
            status_code=503,
            detail="HF_API_TOKEN is not configured — set it on brand-api for AI image creatives",
        )

    campaign.status = "generating"
    db.commit()

    created: list[Creative] = []
    try:
        for product in products:
            data = generate_ad_copy(
                product.name,
                product.description or "",
                list(product.key_benefits or []),
                brand.tone if brand else "professional",
                brand.name if brand else "Brand",
            )
            variants = data.get("variants") or []
            if len(variants) < 4:
                raise HTTPException(status_code=502, detail="AI returned fewer than 4 variants")

            brand_primary = brand.color_primary if brand else "#6366f1"
            payloads = tuple(
                (
                    product.name,
                    product.description or "",
                    brand.name if brand else "Brand",
                    brand.tone if brand else "professional",
                    (brand.industry if brand else None),
                    brand_primary,
                    i,
                    variants[i],
                )
                for i in range(4)
            )

            with ThreadPoolExecutor(max_workers=4) as executor:
                future_map = {executor.submit(_worker_render_variant, p): p[-2] for p in payloads}

                merged: dict[int, dict] = {}
                for fut in as_completed(future_map):
                    idx = future_map[fut]
                    merged[idx] = fut.result()

            for i in range(4):
                row = merged[i]
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
        campaign.status = "review"
        db.commit()
    except HTTPException:
        db.rollback()
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if campaign:
            campaign.status = "review"
            db.commit()
        raise
    except Exception as e:
        db.rollback()
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
        if campaign:
            campaign.status = "review"
            db.commit()
        raise HTTPException(status_code=502, detail=str(e)) from e

    return created


@router.get("/campaigns/{campaign_id}/creatives", response_model=list[CreativeOut])
def list_creatives(campaign_id: UUID, db: Session = Depends(get_db)):
    if not db.query(Campaign).filter(Campaign.id == campaign_id).first():
        raise HTTPException(status_code=404, detail="Campaign not found")
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

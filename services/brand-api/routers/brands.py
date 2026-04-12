from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from database import get_db
from models import AdEvent, Brand, Campaign
from schemas import BrandOut
from cloudinary_util import upload_file

router = APIRouter(prefix="/brands", tags=["brands"])


@router.post("", response_model=BrandOut)
async def create_brand(
    name: str = Form(...),
    tone: str = Form("professional"),
    industry: str | None = Form(None),
    target_interests: str = Form(""),  # comma-separated
    target_age_min: int = Form(18),
    target_age_max: int = Form(65),
    color_primary: str = Form("#6366f1"),
    color_secondary: str = Form("#a5b4fc"),
    logo: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    logo_url = None
    if logo and logo.filename:
        body = await logo.read()
        logo_url = upload_file(body, folder="adaptai/brands", public_id_prefix="logo")

    interests = [s.strip() for s in target_interests.split(",") if s.strip()]
    brand = Brand(
        name=name,
        tone=tone,
        industry=industry,
        target_interests=interests or None,
        target_age_min=target_age_min,
        target_age_max=target_age_max,
        color_primary=color_primary,
        color_secondary=color_secondary,
        logo_url=logo_url,
    )
    db.add(brand)
    db.commit()
    db.refresh(brand)
    return brand


@router.get("", response_model=list[BrandOut])
def list_brands(db: Session = Depends(get_db)):
    return db.query(Brand).order_by(Brand.created_at.desc()).all()


@router.get("/{brand_id}", response_model=BrandOut)
def get_brand(brand_id: UUID, db: Session = Depends(get_db)):
    b = db.query(Brand).filter(Brand.id == brand_id).first()
    if not b:
        raise HTTPException(status_code=404, detail="Brand not found")
    return b


@router.get("/{brand_id}/stats")
def brand_stats(brand_id: UUID, db: Session = Depends(get_db)):
    if not db.query(Brand).filter(Brand.id == brand_id).first():
        raise HTTPException(status_code=404, detail="Brand not found")
    q = (
        db.query(
            func.coalesce(
                func.sum(case((AdEvent.event_type == "impression", 1), else_=0)), 0
            ),
            func.coalesce(
                func.sum(case((AdEvent.event_type == "click", 1), else_=0)), 0
            ),
        )
        .join(Campaign, AdEvent.campaign_id == Campaign.id)
        .filter(Campaign.brand_id == brand_id)
        .one()
    )
    imp, clk = int(q[0] or 0), int(q[1] or 0)
    ctr = (clk / imp) if imp else 0.0
    active = (
        db.query(func.count(Campaign.id))
        .filter(Campaign.brand_id == brand_id, Campaign.status == "live")
        .scalar()
    )
    return {
        "total_impressions": imp,
        "total_clicks": clk,
        "avg_ctr": round(ctr, 4),
        "active_campaigns": int(active or 0),
    }

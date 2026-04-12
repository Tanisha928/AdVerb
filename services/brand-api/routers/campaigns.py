from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from database import get_db
from models import AdEvent, Brand, Campaign, Creative
from schemas import CampaignCreate, CampaignOut, CampaignStatusPatch

router = APIRouter(tags=["campaigns"])


@router.post("/brands/{brand_id}/campaigns", response_model=CampaignOut)
def create_campaign(brand_id: UUID, body: CampaignCreate, db: Session = Depends(get_db)):
    if not db.query(Brand).filter(Brand.id == brand_id).first():
        raise HTTPException(status_code=404, detail="Brand not found")
    c = Campaign(
        brand_id=brand_id,
        name=body.name,
        objective=body.objective,
        status="draft",
        budget=body.budget,
        start_date=body.start_date,
        end_date=body.end_date,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


@router.get("/brands/{brand_id}/campaigns", response_model=list[CampaignOut])
def list_campaigns(brand_id: UUID, db: Session = Depends(get_db)):
    if not db.query(Brand).filter(Brand.id == brand_id).first():
        raise HTTPException(status_code=404, detail="Brand not found")
    return (
        db.query(Campaign)
        .filter(Campaign.brand_id == brand_id)
        .order_by(Campaign.created_at.desc())
        .all()
    )


@router.get("/campaigns/{campaign_id}", response_model=CampaignOut)
def get_campaign(campaign_id: UUID, db: Session = Depends(get_db)):
    c = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    if c.status == "generating":
        count = db.query(Creative).filter(Creative.campaign_id == campaign_id).count()
        if count == 0:
            c.status = "review"
            db.commit()
            db.refresh(c)
    return c


@router.patch("/campaigns/{campaign_id}/status", response_model=CampaignOut)
def patch_campaign_status(campaign_id: UUID, body: CampaignStatusPatch, db: Session = Depends(get_db)):
    c = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")
    c.status = body.status
    db.commit()
    db.refresh(c)
    return c


@router.get("/campaigns/{campaign_id}/analytics")
def campaign_analytics(campaign_id: UUID, db: Session = Depends(get_db)):
    c = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Campaign not found")

    creatives = (
        db.query(Creative.id, Creative.headline, Creative.angle, Creative.mab_weight)
        .filter(Creative.campaign_id == campaign_id)
        .all()
    )
    stats_rows = (
        db.query(
            AdEvent.creative_id,
            func.coalesce(
                func.sum(case((AdEvent.event_type == "impression", 1), else_=0)), 0
            ).label("impressions"),
            func.coalesce(
                func.sum(case((AdEvent.event_type == "click", 1), else_=0)), 0
            ).label("clicks"),
        )
        .filter(AdEvent.campaign_id == campaign_id)
        .group_by(AdEvent.creative_id)
        .all()
    )
    by_creative = {row.creative_id: (int(row.impressions), int(row.clicks)) for row in stats_rows}

    import os
    import redis

    mab = {}
    rurl = os.environ.get("REDIS_URL", "redis://localhost:6379")
    try:
        r = redis.Redis.from_url(rurl, decode_responses=True)
        mab = r.hgetall(f"mab:{campaign_id}")
    except Exception:
        pass

    variants = []
    for row in creatives:
        cid = str(row.id)
        imp, clk = by_creative.get(row.id, (0, 0))
        ctr = (clk / imp) if imp else 0.0
        variants.append(
            {
                "creative_id": cid,
                "headline": row.headline,
                "angle": row.angle,
                "impressions": imp,
                "clicks": clk,
                "ctr": round(ctr, 4),
                "mab_weight_redis": float(mab.get(cid, row.mab_weight or 0.25)),
            }
        )
    return {"campaign_id": str(campaign_id), "variants": variants}

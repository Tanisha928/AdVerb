from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models import Brand, Campaign, Creative, Product
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

    rows = (
        db.query(
            Creative.id,
            Creative.headline,
            Creative.angle,
            Creative.impressions,
            Creative.clicks,
            Creative.mab_weight,
        )
        .filter(Creative.campaign_id == campaign_id)
        .all()
    )

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
    for row in rows:
        cid = str(row.id)
        ctr = (row.clicks / row.impressions) if row.impressions else 0.0
        variants.append(
            {
                "creative_id": cid,
                "headline": row.headline,
                "angle": row.angle,
                "impressions": row.impressions,
                "clicks": row.clicks,
                "ctr": round(ctr, 4),
                "mab_weight_redis": float(mab.get(cid, row.mab_weight or 0.25)),
            }
        )
    return {"campaign_id": str(campaign_id), "variants": variants}

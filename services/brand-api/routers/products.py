from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Campaign, Product
from schemas import ProductOut
from cloudinary_util import upload_file

router = APIRouter(tags=["products"])


@router.post("/campaigns/{campaign_id}/products", response_model=ProductOut)
async def create_product(
    campaign_id: UUID,
    name: str = Form(...),
    description: str | None = Form(None),
    key_benefits: str = Form(""),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    if not db.query(Campaign).filter(Campaign.id == campaign_id).first():
        raise HTTPException(status_code=404, detail="Campaign not found")
    normalized_name = (name or "").strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Product name is required")
    duplicate = (
        db.query(Product)
        .filter(
            Product.campaign_id == campaign_id,
            func.lower(func.trim(Product.name)) == normalized_name.lower(),
        )
        .first()
    )
    if duplicate:
        raise HTTPException(status_code=409, detail="A product with this name already exists in the campaign")
    image_url = None
    if image and image.filename:
        body = await image.read()
        image_url = upload_file(body, folder="adverb/products", public_id_prefix="product")

    benefits = [s.strip() for s in key_benefits.split(",") if s.strip()]
    p = Product(
        campaign_id=campaign_id,
        name=normalized_name,
        description=description,
        image_url=image_url,
        key_benefits=benefits or None,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


@router.get("/campaigns/{campaign_id}/products", response_model=list[ProductOut])
def list_products(campaign_id: UUID, db: Session = Depends(get_db)):
    if not db.query(Campaign).filter(Campaign.id == campaign_id).first():
        raise HTTPException(status_code=404, detail="Campaign not found")
    return db.query(Product).filter(Product.campaign_id == campaign_id).order_by(Product.created_at).all()

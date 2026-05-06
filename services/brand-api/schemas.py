from datetime import date, datetime
from decimal import Decimal
from typing import Optional
from uuid import UUID
from pydantic import BaseModel, Field


class BrandCreate(BaseModel):
    name: str
    tone: str = "professional"
    industry: Optional[str] = None
    target_interests: list[str] = Field(default_factory=list)
    target_age_min: int = 18
    target_age_max: int = 65
    color_primary: str = "#6366f1"
    color_secondary: str = "#a5b4fc"


class BrandOut(BaseModel):
    id: UUID
    name: str
    logo_url: Optional[str] = None
    color_primary: str
    color_secondary: str
    tone: str
    industry: Optional[str] = None
    target_interests: Optional[list[str]] = None
    target_age_min: int
    target_age_max: int
    created_at: datetime

    class Config:
        from_attributes = True


class CampaignCreate(BaseModel):
    name: str
    objective: str = "clicks"
    budget: Optional[Decimal] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None


class CampaignOut(BaseModel):
    id: UUID
    brand_id: UUID
    name: str
    objective: str
    status: str
    budget: Optional[Decimal] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CampaignStatusPatch(BaseModel):
    status: str


class ProductCreate(BaseModel):
    name: str
    description: Optional[str] = None
    key_benefits: list[str] = Field(default_factory=list)


class ProductOut(BaseModel):
    id: UUID
    campaign_id: UUID
    name: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    key_benefits: Optional[list[str]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class CreativeOut(BaseModel):
    id: UUID
    product_id: UUID
    campaign_id: UUID
    headline: Optional[str] = None
    subheadline: Optional[str] = None
    cta: Optional[str] = None
    angle: Optional[str] = None
    layout: Optional[str] = None
    background_color: Optional[str] = None
    assembled_image_url: Optional[str] = None
    status: str
    rejection_note: Optional[str] = None
    impressions: int
    clicks: int
    mab_weight: Decimal
    created_at: datetime

    class Config:
        from_attributes = True


class CreativeReview(BaseModel):
    status: str
    rejection_note: Optional[str] = None

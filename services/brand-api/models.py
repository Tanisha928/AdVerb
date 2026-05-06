import uuid
from sqlalchemy import Column, String, Integer, Numeric, Date, DateTime, ForeignKey, Text, ARRAY
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from database import Base


class Brand(Base):
    __tablename__ = "brands"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(Text, nullable=False)
    logo_url = Column(Text)
    color_primary = Column(String, default="#6366f1")
    color_secondary = Column(String, default="#a5b4fc")
    tone = Column(String, default="professional")
    industry = Column(Text)
    target_interests = Column(ARRAY(Text))
    target_age_min = Column(Integer, default=18)
    target_age_max = Column(Integer, default=65)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    campaigns = relationship("Campaign", back_populates="brand")


class Campaign(Base):
    __tablename__ = "campaigns"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    brand_id = Column(UUID(as_uuid=True), ForeignKey("brands.id"), nullable=False)
    name = Column(Text, nullable=False)
    objective = Column(String, default="clicks")
    status = Column(String, default="draft")
    budget = Column(Numeric(10, 2))
    start_date = Column(Date)
    end_date = Column(Date)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    brand = relationship("Brand", back_populates="campaigns")
    products = relationship("Product", back_populates="campaign")
    creatives = relationship("Creative", back_populates="campaign")


class Product(Base):
    __tablename__ = "products"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    name = Column(Text, nullable=False)
    description = Column(Text)
    image_url = Column(Text)
    key_benefits = Column(ARRAY(Text))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    campaign = relationship("Campaign", back_populates="products")
    creatives = relationship("Creative", back_populates="product")


class Creative(Base):
    __tablename__ = "creatives"
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    product_id = Column(UUID(as_uuid=True), ForeignKey("products.id"), nullable=False)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("campaigns.id"), nullable=False)
    headline = Column(Text)
    subheadline = Column(Text)
    cta = Column(Text)
    angle = Column(Text)
    layout = Column(Text)
    background_color = Column(Text)
    assembled_image_url = Column(Text)
    status = Column(String, default="pending")
    rejection_note = Column(Text)
    impressions = Column(Integer, default=0)
    clicks = Column(Integer, default=0)
    mab_weight = Column(Numeric(5, 4), default=0.25)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    product = relationship("Product", back_populates="creatives")
    campaign = relationship("Campaign", back_populates="creatives", foreign_keys=[campaign_id])

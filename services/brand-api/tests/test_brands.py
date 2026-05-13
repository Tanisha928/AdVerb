"""Tests for /brands routes (brands router)."""
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest


# ── fixtures / helpers ─────────────────────────────────────────────────────────

def _make_brand(**kwargs):
    brand = MagicMock()
    brand.id = kwargs.get("id", uuid.uuid4())
    brand.name = kwargs.get("name", "BrewCo")
    brand.tone = kwargs.get("tone", "professional")
    brand.industry = kwargs.get("industry", "food & beverage")
    brand.logo_url = kwargs.get("logo_url", None)
    brand.color_primary = kwargs.get("color_primary", "#6366f1")
    brand.color_secondary = kwargs.get("color_secondary", "#a5b4fc")
    brand.target_interests = kwargs.get("target_interests", ["coffee", "tech"])
    brand.target_age_min = kwargs.get("target_age_min", 18)
    brand.target_age_max = kwargs.get("target_age_max", 65)
    brand.created_at = kwargs.get("created_at", datetime.now(timezone.utc))
    return brand


# ── GET /brands ────────────────────────────────────────────────────────────────

class TestListBrands:
    def test_returns_empty_list(self, client, mock_db, chain_helper):
        chain_helper(mock_db, all_=[])
        resp = client.get("/brands")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_brands(self, client, mock_db, chain_helper):
        b = _make_brand()
        chain_helper(mock_db, all_=[b])
        resp = client.get("/brands")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "BrewCo"

    def test_response_contains_expected_fields(self, client, mock_db, chain_helper):
        b = _make_brand()
        chain_helper(mock_db, all_=[b])
        resp = client.get("/brands")
        item = resp.json()[0]
        for field in ("id", "name", "tone", "color_primary", "color_secondary", "created_at"):
            assert field in item


# ── GET /brands/{id} ──────────────────────────────────────────────────────────

class TestGetBrand:
    def test_returns_brand(self, client, mock_db, chain_helper):
        b = _make_brand()
        chain_helper(mock_db, first=b)
        resp = client.get(f"/brands/{b.id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "BrewCo"

    def test_404_when_not_found(self, client, mock_db, chain_helper):
        chain_helper(mock_db, first=None)
        resp = client.get(f"/brands/{uuid.uuid4()}")
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()


# ── GET /brands/{id}/stats ─────────────────────────────────────────────────────

class TestBrandStats:
    def test_404_when_brand_not_found(self, client, mock_db, chain_helper):
        chain_helper(mock_db, first=None)
        resp = client.get(f"/brands/{uuid.uuid4()}/stats")
        assert resp.status_code == 404

    def test_returns_zero_stats_for_new_brand(self, client, mock_db, chain_helper):
        b = _make_brand()

        call_count = 0
        original_query = mock_db.query

        def side_effect(*args):
            nonlocal call_count
            call_count += 1
            chain = MagicMock()
            for m in ("filter", "order_by", "join", "group_by"):
                getattr(chain, m).return_value = chain
            if call_count == 1:
                # brand existence check
                chain.first.return_value = b
            elif call_count == 2:
                # impressions/clicks aggregate
                chain.one.return_value = (0, 0)
            else:
                # active campaign count
                chain.scalar.return_value = 0
            return chain

        mock_db.query.side_effect = side_effect

        resp = client.get(f"/brands/{b.id}/stats")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_impressions"] == 0
        assert data["total_clicks"] == 0
        assert data["avg_ctr"] == 0.0
        assert data["active_campaigns"] == 0


# ── POST /brands (multipart form) ─────────────────────────────────────────────

class TestCreateBrand:
    def test_creates_brand_without_logo(self, client, mock_db):
        created = _make_brand(name="NewBrand")
        mock_db.refresh.side_effect = lambda obj: None

        call_count = 0
        def query_side(*args):
            nonlocal call_count
            call_count += 1
            chain = MagicMock()
            for m in ("filter", "order_by"):
                getattr(chain, m).return_value = chain
            chain.first.return_value = created
            return chain

        mock_db.query.side_effect = query_side
        mock_db.refresh = MagicMock(side_effect=lambda obj: setattr(obj, "id", created.id))

        with patch("routers.brands.upload_file", return_value=None):
            resp = client.post(
                "/brands",
                data={
                    "name": "NewBrand",
                    "tone": "casual",
                    "color_primary": "#ff0000",
                    "color_secondary": "#00ff00",
                    "target_interests": "coffee,tech",
                    "target_age_min": "20",
                    "target_age_max": "40",
                },
            )
        # brand is added to the session
        assert mock_db.add.called
        assert mock_db.commit.called

    def test_brand_name_is_required(self, client, mock_db):
        resp = client.post("/brands", data={})
        assert resp.status_code == 422

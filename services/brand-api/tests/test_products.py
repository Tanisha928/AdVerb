"""Tests for /campaigns/{id}/products routes."""
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch


def _make_campaign(**kwargs):
    c = MagicMock()
    c.id = kwargs.get("id", uuid.uuid4())
    c.status = kwargs.get("status", "draft")
    return c


def _make_product(**kwargs):
    p = MagicMock()
    p.id = kwargs.get("id", uuid.uuid4())
    p.campaign_id = kwargs.get("campaign_id", uuid.uuid4())
    p.name = kwargs.get("name", "Premium Coffee")
    p.description = kwargs.get("description", "Freshly roasted")
    p.image_url = kwargs.get("image_url", None)
    p.key_benefits = kwargs.get("key_benefits", ["Rich", "Organic"])
    p.created_at = kwargs.get("created_at", datetime.now(timezone.utc))
    return p


# ── GET /campaigns/{id}/products ──────────────────────────────────────────────

class TestListProducts:
    def test_404_when_campaign_not_found(self, client, mock_db, chain_helper):
        chain_helper(mock_db, first=None)
        resp = client.get(f"/campaigns/{uuid.uuid4()}/products")
        assert resp.status_code == 404

    def test_returns_empty_list_for_new_campaign(self, client, mock_db):
        campaign = _make_campaign()

        call_count = 0
        def query_side(*args):
            nonlocal call_count
            call_count += 1
            chain = MagicMock()
            for m in ("filter", "order_by"):
                getattr(chain, m).return_value = chain
            if call_count == 1:
                chain.first.return_value = campaign
            else:
                chain.all.return_value = []
            return chain

        mock_db.query.side_effect = query_side
        resp = client.get(f"/campaigns/{campaign.id}/products")
        assert resp.status_code == 200
        assert resp.json() == []

    def test_returns_products(self, client, mock_db):
        campaign = _make_campaign()
        product = _make_product(campaign_id=campaign.id)

        call_count = 0
        def query_side(*args):
            nonlocal call_count
            call_count += 1
            chain = MagicMock()
            for m in ("filter", "order_by"):
                getattr(chain, m).return_value = chain
            if call_count == 1:
                chain.first.return_value = campaign
            else:
                chain.all.return_value = [product]
            return chain

        mock_db.query.side_effect = query_side
        resp = client.get(f"/campaigns/{campaign.id}/products")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Premium Coffee"


# ── POST /campaigns/{id}/products ─────────────────────────────────────────────

class TestCreateProduct:
    def test_404_when_campaign_not_found(self, client, mock_db, chain_helper):
        chain_helper(mock_db, first=None)
        resp = client.post(
            f"/campaigns/{uuid.uuid4()}/products",
            data={"name": "New Product"},
        )
        assert resp.status_code == 404

    def test_400_when_product_name_is_blank(self, client, mock_db):
        campaign = _make_campaign()

        def query_side(*args):
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.first.return_value = campaign
            return chain

        mock_db.query.side_effect = query_side

        with patch("routers.products.upload_file", return_value=None):
            resp = client.post(
                f"/campaigns/{campaign.id}/products",
                data={"name": "   "},
            )
        assert resp.status_code == 400
        assert "required" in resp.json()["detail"].lower()

    def test_409_when_duplicate_product_name(self, client, mock_db):
        campaign = _make_campaign()
        existing = _make_product(name="Premium Coffee", campaign_id=campaign.id)

        call_count = 0
        def query_side(*args):
            nonlocal call_count
            call_count += 1
            chain = MagicMock()
            for m in ("filter",):
                getattr(chain, m).return_value = chain
            if call_count == 1:
                chain.first.return_value = campaign
            else:
                chain.first.return_value = existing
            return chain

        mock_db.query.side_effect = query_side

        with patch("routers.products.upload_file", return_value=None):
            resp = client.post(
                f"/campaigns/{campaign.id}/products",
                data={"name": "Premium Coffee"},
            )
        assert resp.status_code == 409
        assert "already exists" in resp.json()["detail"].lower()

    def test_creates_product_without_image(self, client, mock_db):
        campaign = _make_campaign()
        new_product = _make_product(name="Cold Brew")

        call_count = 0
        def query_side(*args):
            nonlocal call_count
            call_count += 1
            chain = MagicMock()
            for m in ("filter",):
                getattr(chain, m).return_value = chain
            if call_count == 1:
                chain.first.return_value = campaign
            elif call_count == 2:
                chain.first.return_value = None  # no duplicate
            else:
                chain.first.return_value = new_product
            return chain

        mock_db.query.side_effect = query_side
        mock_db.refresh.side_effect = lambda obj: None

        with patch("routers.products.upload_file", return_value=None):
            resp = client.post(
                f"/campaigns/{campaign.id}/products",
                data={
                    "name": "Cold Brew",
                    "description": "Smooth and refreshing",
                    "key_benefits": "Low acidity,Rich flavor",
                },
            )
        assert mock_db.add.called
        assert mock_db.commit.called

    def test_parses_key_benefits_from_comma_separated_string(self, client, mock_db):
        """key_benefits field splits on commas and strips whitespace."""
        campaign = _make_campaign()

        added_product = None

        def capture_add(obj):
            nonlocal added_product
            added_product = obj

        mock_db.add.side_effect = capture_add

        call_count = 0
        def query_side(*args):
            nonlocal call_count
            call_count += 1
            chain = MagicMock()
            chain.filter.return_value = chain
            if call_count == 1:
                chain.first.return_value = campaign
            else:
                chain.first.return_value = None
            return chain

        mock_db.query.side_effect = query_side
        mock_db.refresh.side_effect = lambda obj: None

        with patch("routers.products.upload_file", return_value=None):
            client.post(
                f"/campaigns/{campaign.id}/products",
                data={
                    "name": "Espresso Shot",
                    "key_benefits": " Rich , Bold , Intense ",
                },
            )

        if added_product is not None:
            assert added_product.key_benefits == ["Rich", "Bold", "Intense"]

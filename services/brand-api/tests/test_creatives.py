"""Tests for creative review and listing routes."""
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock


def _make_campaign(**kwargs):
    c = MagicMock()
    c.id = kwargs.get("id", uuid.uuid4())
    c.status = kwargs.get("status", "review")
    return c


def _make_creative(**kwargs):
    cr = MagicMock()
    cr.id = kwargs.get("id", uuid.uuid4())
    cr.product_id = kwargs.get("product_id", uuid.uuid4())
    cr.campaign_id = kwargs.get("campaign_id", uuid.uuid4())
    cr.headline = kwargs.get("headline", "Try it today")
    cr.subheadline = kwargs.get("subheadline", "You won't regret it")
    cr.cta = kwargs.get("cta", "Shop Now")
    cr.angle = kwargs.get("angle", "benefit")
    cr.layout = kwargs.get("layout", "hero")
    cr.background_color = kwargs.get("background_color", "#4f46e5")
    cr.assembled_image_url = kwargs.get("assembled_image_url", None)
    cr.status = kwargs.get("status", "pending")
    cr.rejection_note = kwargs.get("rejection_note", None)
    cr.impressions = kwargs.get("impressions", 0)
    cr.clicks = kwargs.get("clicks", 0)
    cr.mab_weight = kwargs.get("mab_weight", Decimal("0.2500"))
    cr.created_at = kwargs.get("created_at", datetime.now(timezone.utc))
    return cr


# ── GET /campaigns/{id}/creatives ─────────────────────────────────────────────

class TestListCreatives:
    def test_404_when_campaign_not_found(self, client, mock_db, chain_helper):
        chain_helper(mock_db, first=None)
        resp = client.get(f"/campaigns/{uuid.uuid4()}/creatives")
        assert resp.status_code == 404

    def test_returns_creatives_for_campaign(self, client, mock_db):
        camp = _make_campaign(status="review")
        cr = _make_creative(campaign_id=camp.id)

        call_count = 0
        def query_side(*args):
            nonlocal call_count
            call_count += 1
            chain = MagicMock()
            for m in ("filter", "order_by"):
                getattr(chain, m).return_value = chain
            if call_count == 1:
                chain.first.return_value = camp
            else:
                chain.all.return_value = [cr]
                chain.count.return_value = 1
            return chain

        mock_db.query.side_effect = query_side
        resp = client.get(f"/campaigns/{camp.id}/creatives")
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)

    def test_resets_generating_campaign_with_enough_creatives(self, client, mock_db):
        """A 'generating' campaign with ≥3 creatives auto-resets to 'review'."""
        camp = _make_campaign(status="generating")

        call_count = 0
        def query_side(*args):
            nonlocal call_count
            call_count += 1
            chain = MagicMock()
            for m in ("filter", "order_by"):
                getattr(chain, m).return_value = chain
            if call_count == 1:
                chain.first.return_value = camp
                chain.count.return_value = 3
            else:
                chain.all.return_value = []
                chain.count.return_value = 3
            return chain

        mock_db.query.side_effect = query_side
        resp = client.get(f"/campaigns/{camp.id}/creatives")
        assert resp.status_code == 200
        assert camp.status == "review"


# ── PATCH /creatives/{id}/review ──────────────────────────────────────────────

class TestReviewCreative:
    def test_approves_a_creative(self, client, mock_db):
        cr = _make_creative(status="pending")

        def query_side(*args):
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.first.return_value = cr
            return chain

        mock_db.query.side_effect = query_side
        mock_db.refresh.side_effect = lambda obj: setattr(obj, "status", "approved")

        resp = client.patch(
            f"/creatives/{cr.id}/review",
            json={"status": "approved"},
        )
        assert resp.status_code == 200
        assert cr.status == "approved"
        assert mock_db.commit.called

    def test_rejects_a_creative_with_note(self, client, mock_db):
        cr = _make_creative(status="pending")

        def query_side(*args):
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.first.return_value = cr
            return chain

        mock_db.query.side_effect = query_side
        mock_db.refresh.side_effect = lambda obj: None

        resp = client.patch(
            f"/creatives/{cr.id}/review",
            json={"status": "rejected", "rejection_note": "Poor image quality"},
        )
        assert resp.status_code == 200
        assert cr.status == "rejected"
        assert cr.rejection_note == "Poor image quality"

    def test_approved_creative_has_no_rejection_note(self, client, mock_db):
        """Approving a creative clears any previous rejection_note."""
        cr = _make_creative(status="pending", rejection_note="Old note")

        def query_side(*args):
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.first.return_value = cr
            return chain

        mock_db.query.side_effect = query_side
        mock_db.refresh.side_effect = lambda obj: None

        client.patch(f"/creatives/{cr.id}/review", json={"status": "approved"})
        assert cr.rejection_note is None

    def test_400_for_invalid_status(self, client, mock_db, chain_helper):
        chain_helper(mock_db, first=_make_creative())
        resp = client.patch(
            f"/creatives/{uuid.uuid4()}/review",
            json={"status": "invalid_status"},
        )
        assert resp.status_code == 400
        assert "approved or rejected" in resp.json()["detail"]

    def test_404_when_creative_not_found(self, client, mock_db, chain_helper):
        chain_helper(mock_db, first=None)
        resp = client.patch(
            f"/creatives/{uuid.uuid4()}/review",
            json={"status": "approved"},
        )
        assert resp.status_code == 404

    def test_review_requires_status_field(self, client, mock_db):
        resp = client.patch(f"/creatives/{uuid.uuid4()}/review", json={})
        assert resp.status_code == 422

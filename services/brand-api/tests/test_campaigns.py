"""Tests for campaigns routes."""
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock


def _make_brand(**kwargs):
    b = MagicMock()
    b.id = kwargs.get("id", uuid.uuid4())
    b.name = kwargs.get("name", "BrewCo")
    return b


def _make_campaign(**kwargs):
    c = MagicMock()
    c.id = kwargs.get("id", uuid.uuid4())
    c.brand_id = kwargs.get("brand_id", uuid.uuid4())
    c.name = kwargs.get("name", "Summer Sale")
    c.objective = kwargs.get("objective", "clicks")
    c.status = kwargs.get("status", "draft")
    c.budget = kwargs.get("budget", None)
    c.start_date = kwargs.get("start_date", None)
    c.end_date = kwargs.get("end_date", None)
    c.created_at = kwargs.get("created_at", datetime.now(timezone.utc))
    return c


def _make_creative(**kwargs):
    cr = MagicMock()
    cr.id = kwargs.get("id", uuid.uuid4())
    cr.campaign_id = kwargs.get("campaign_id", uuid.uuid4())
    cr.headline = kwargs.get("headline", "Great Coffee")
    cr.angle = kwargs.get("angle", "benefit")
    cr.mab_weight = kwargs.get("mab_weight", 0.25)
    return cr


# ── GET /brands/{id}/campaigns ─────────────────────────────────────────────────

class TestListCampaigns:
    def test_404_when_brand_not_found(self, client, mock_db, chain_helper):
        chain_helper(mock_db, first=None)
        resp = client.get(f"/brands/{uuid.uuid4()}/campaigns")
        assert resp.status_code == 404

    def test_returns_campaigns(self, client, mock_db, chain_helper):
        brand = _make_brand()
        camp = _make_campaign(brand_id=brand.id)

        call_count = 0
        def query_side(*args):
            nonlocal call_count
            call_count += 1
            chain = MagicMock()
            for m in ("filter", "order_by"):
                getattr(chain, m).return_value = chain
            if call_count == 1:
                chain.first.return_value = brand
            else:
                chain.all.return_value = [camp]
            return chain

        mock_db.query.side_effect = query_side
        resp = client.get(f"/brands/{brand.id}/campaigns")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["name"] == "Summer Sale"


# ── POST /brands/{id}/campaigns ───────────────────────────────────────────────

class TestCreateCampaign:
    def test_creates_campaign_for_valid_brand(self, client, mock_db):
        brand = _make_brand()
        new_camp = _make_campaign(brand_id=brand.id, name="Holiday Campaign")

        call_count = 0
        def query_side(*args):
            nonlocal call_count
            call_count += 1
            chain = MagicMock()
            for m in ("filter",):
                getattr(chain, m).return_value = chain
            chain.first.return_value = brand if call_count == 1 else new_camp
            return chain

        mock_db.query.side_effect = query_side
        mock_db.refresh.side_effect = lambda obj: None

        resp = client.post(
            f"/brands/{brand.id}/campaigns",
            json={"name": "Holiday Campaign", "objective": "clicks"},
        )
        assert mock_db.add.called
        assert mock_db.commit.called

    def test_404_when_brand_does_not_exist(self, client, mock_db, chain_helper):
        chain_helper(mock_db, first=None)
        resp = client.post(
            f"/brands/{uuid.uuid4()}/campaigns",
            json={"name": "Test Campaign"},
        )
        assert resp.status_code == 404

    def test_requires_campaign_name(self, client, mock_db):
        resp = client.post(f"/brands/{uuid.uuid4()}/campaigns", json={})
        assert resp.status_code == 422


# ── GET /campaigns/{id} ───────────────────────────────────────────────────────

class TestGetCampaign:
    def test_returns_campaign(self, client, mock_db, chain_helper):
        camp = _make_campaign()
        chain_helper(mock_db, first=camp)
        resp = client.get(f"/campaigns/{camp.id}")
        assert resp.status_code == 200
        assert resp.json()["name"] == "Summer Sale"
        assert resp.json()["status"] == "draft"

    def test_404_when_not_found(self, client, mock_db, chain_helper):
        chain_helper(mock_db, first=None)
        resp = client.get(f"/campaigns/{uuid.uuid4()}")
        assert resp.status_code == 404

    def test_resets_stuck_generating_campaign_with_no_creatives(self, client, mock_db):
        """A campaign in 'generating' status with 0 creatives auto-transitions to 'review'."""
        camp = _make_campaign(status="generating")

        call_count = 0
        def query_side(*args):
            nonlocal call_count
            call_count += 1
            chain = MagicMock()
            for m in ("filter",):
                getattr(chain, m).return_value = chain
            if call_count == 1:
                chain.first.return_value = camp
            else:
                chain.count.return_value = 0
            return chain

        mock_db.query.side_effect = query_side
        resp = client.get(f"/campaigns/{camp.id}")
        assert resp.status_code == 200
        assert camp.status == "review"


# ── PATCH /campaigns/{id}/status ──────────────────────────────────────────────

class TestPatchCampaignStatus:
    def test_updates_status_to_live(self, client, mock_db, chain_helper):
        camp = _make_campaign(status="review")

        def _side(*args):
            chain = MagicMock()
            chain.filter.return_value = chain
            chain.first.return_value = camp
            return chain

        mock_db.query.side_effect = _side
        mock_db.refresh.side_effect = lambda obj: setattr(obj, "status", "live")

        resp = client.patch(
            f"/campaigns/{camp.id}/status",
            json={"status": "live"},
        )
        assert resp.status_code == 200
        assert mock_db.commit.called

    def test_404_when_campaign_not_found(self, client, mock_db, chain_helper):
        chain_helper(mock_db, first=None)
        resp = client.patch(
            f"/campaigns/{uuid.uuid4()}/status",
            json={"status": "live"},
        )
        assert resp.status_code == 404


# ── GET /campaigns/{id}/analytics ─────────────────────────────────────────────

class TestCampaignAnalytics:
    def test_404_when_campaign_not_found(self, client, mock_db, chain_helper):
        chain_helper(mock_db, first=None)
        resp = client.get(f"/campaigns/{uuid.uuid4()}/analytics")
        assert resp.status_code == 404

    def test_returns_variants_for_campaign(self, client, mock_db):
        camp = _make_campaign()
        creative = _make_creative(campaign_id=camp.id)

        call_count = 0
        def query_side(*args):
            nonlocal call_count
            call_count += 1
            chain = MagicMock()
            for m in ("filter", "group_by"):
                getattr(chain, m).return_value = chain
            if call_count == 1:
                chain.first.return_value = camp
            elif call_count == 2:
                chain.all.return_value = [creative]
            else:
                chain.all.return_value = []
            return chain

        mock_db.query.side_effect = query_side

        # redis is imported inside the function body and wrapped in try/except,
        # so a ConnectionError is silently swallowed; no mocking required.
        resp = client.get(f"/campaigns/{camp.id}/analytics")

        assert resp.status_code == 200
        data = resp.json()
        assert "campaign_id" in data
        assert "variants" in data

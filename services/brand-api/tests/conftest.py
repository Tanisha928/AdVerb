"""
Shared fixtures for brand-api tests.

Strategy: override the `get_db` FastAPI dependency with a MagicMock so tests
never need a live PostgreSQL instance.  Each test receives a fresh `mock_db`
and a `TestClient` wired to that mock.
"""
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient

from main import app
from database import get_db


# ── helpers ───────────────────────────────────────────────────────────────────

def _chain(mock_db: MagicMock, *, first=None, all_=None, count=0, scalar=0, one=None):
    """
    Configure a single query-chain on mock_db so that
      mock_db.query(...).filter(...).first()  → first
      mock_db.query(...).filter(...).all()    → all_
      mock_db.query(...).filter(...).count()  → count
      mock_db.query(...).filter(...).scalar() → scalar
      mock_db.query(...).filter(...).one()    → one
    Also handles .order_by, .join, .group_by chaining.
    """
    chain = MagicMock()
    # make every chain method return the same chain so .filter().order_by()…
    for method in ("filter", "order_by", "join", "group_by", "label"):
        getattr(chain, method).return_value = chain
    chain.first.return_value = first
    chain.all.return_value = all_ or []
    chain.count.return_value = count
    chain.scalar.return_value = scalar
    chain.one.return_value = one or (0, 0)
    mock_db.query.return_value = chain
    return chain


# ── fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture()
def mock_db() -> MagicMock:
    db = MagicMock()
    db.add = MagicMock()
    db.commit = MagicMock()
    db.refresh = MagicMock()
    db.rollback = MagicMock()
    return db


@pytest.fixture()
def client(mock_db: MagicMock):
    def _override():
        yield mock_db

    app.dependency_overrides[get_db] = _override
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture()
def chain_helper():
    """Return the _chain helper so individual tests can call it."""
    return _chain

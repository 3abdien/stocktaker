"""Pytest configuration: point the app at a throwaway SQLite DB BEFORE any `app` module is imported (settings are read once at
import time), and give every test a clean database + a fresh TestClient
(so `ensure_default_admin` re-creates the admin user each test).
"""

import os
import tempfile

_tmp_dir = tempfile.mkdtemp(prefix="stocktaker-api-tests-")
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp_dir}/test.db"
os.environ["JWT_SECRET"] = "test-secret-not-for-production"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(app) as c:
        yield c


def login(client, username="admin", password="admin123") -> dict:
    r = client.post("/auth/login", json={"username": username, "password": password})
    assert r.status_code == 200, r.text
    return r.json()


def auth_headers(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def admin_headers(client) -> dict:
    return auth_headers(login(client, "admin", "admin123"))


def create_site(client, headers, name="Main Warehouse") -> dict:
    r = client.post("/sites", json={"name": name, "address": "1 Industrial Way"}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def create_user(client, headers, username, password, role, site_id=None, full_name="") -> dict:
    r = client.post(
        "/users",
        json={
            "username": username, "password": password, "full_name": full_name,
            "role": role, "site_id": site_id,
        },
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def create_category(client, headers, name="Wires", code="WIR") -> dict:
    r = client.post("/categories", json={"name": name, "code": code}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()

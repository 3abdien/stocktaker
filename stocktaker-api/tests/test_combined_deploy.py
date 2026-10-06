"""The combined deploy: API under /api and the built web dashboard at /,
from one process (see the root Dockerfile and render.yaml)."""

import pytest
from fastapi.testclient import TestClient

from app import main
from app.config import settings


@pytest.fixture()
def combined(client, tmp_path, monkeypatch):
    # `client` resets the database; then build a second app with the
    # combined-deploy settings against it.
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<!doctype html><div id=root></div>")
    (dist / "assets" / "index-abc123.js").write_text("console.log('app')")
    (dist / "favicon.svg").write_text("<svg/>")
    (tmp_path / "secret.txt").write_text("outside dist")

    monkeypatch.setattr(settings, "api_prefix", "/api")
    monkeypatch.setattr(settings, "web_dist_dir", dist)
    with TestClient(main.create_app()) as c:
        yield c


def test_api_is_served_under_prefix(combined):
    assert combined.get("/api/health").json() == {"status": "ok"}

    r = combined.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    r = combined.get("/api/users/me", headers={"Authorization": f"Bearer {token}"})
    assert r.json()["username"] == "admin"


def test_dashboard_routes_get_index_html(combined):
    # /items is a dashboard page here, not the API's item list.
    for path in ("/", "/items", "/reports", "/admin"):
        r = combined.get(path)
        assert r.status_code == 200, path
        assert "<div id=root>" in r.text
        assert r.headers["cache-control"] == "no-cache"


def test_static_files_are_served_with_caching(combined):
    r = combined.get("/assets/index-abc123.js")
    assert r.text == "console.log('app')"
    assert "immutable" in r.headers["cache-control"]

    r = combined.get("/favicon.svg")
    assert r.text == "<svg/>"
    assert r.headers["cache-control"] == "no-cache"


def test_unknown_api_path_is_json_404_not_dashboard(combined):
    r = combined.get("/api/nope")
    assert r.status_code == 404
    assert r.json() == {"detail": "Not Found"}


def test_cannot_escape_dist_dir(combined):
    r = combined.get("/..%2Fsecret.txt")
    assert "outside dist" not in r.text


def test_initial_admin_password_is_configurable(client, monkeypatch):
    from app.database import Base, engine

    monkeypatch.setattr(settings, "initial_admin_password", "a-real-secret-123")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    with TestClient(main.create_app()) as c:
        assert c.post("/auth/login", json={"username": "admin", "password": "admin123"}).status_code == 401
        assert c.post("/auth/login", json={"username": "admin", "password": "a-real-secret-123"}).status_code == 200


@pytest.mark.parametrize("given, expected", [
    ("postgres://u:p@host/db", "postgresql+psycopg2://u:p@host/db"),
    ("postgresql://u:p@host/db?sslmode=require", "postgresql+psycopg2://u:p@host/db?sslmode=require"),
    ("postgresql+psycopg2://u:p@host/db", "postgresql+psycopg2://u:p@host/db"),
    ("sqlite:///./x.db", "sqlite:///./x.db"),
])
def test_database_url_scheme_is_normalized(given, expected):
    from app.config import Settings

    assert Settings(database_url=given).database_url == expected


def test_api_prefix_must_be_a_path():
    from pydantic import ValidationError
    from app.config import Settings

    assert Settings(api_prefix="/api/").api_prefix == "/api"
    with pytest.raises(ValidationError):
        Settings(api_prefix="C:/Program Files/Git/api")

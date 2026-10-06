from .conftest import login, auth_headers, admin_headers, create_site, create_user


def test_login_success_and_me(client):
    tokens = login(client, "admin", "admin123")
    assert tokens["token_type"] == "bearer"

    r = client.get("/users/me", headers=auth_headers(tokens))
    assert r.status_code == 200
    assert r.json()["username"] == "admin"
    assert r.json()["role"] == "admin"


def test_login_wrong_password(client):
    r = client.post("/auth/login", json={"username": "admin", "password": "wrong"})
    assert r.status_code == 401


def test_login_unknown_user(client):
    r = client.post("/auth/login", json={"username": "nobody", "password": "whatever"})
    assert r.status_code == 401


def test_protected_endpoint_requires_token(client):
    r = client.get("/users/me")
    assert r.status_code == 401


def test_protected_endpoint_rejects_garbage_token(client):
    r = client.get("/users/me", headers={"Authorization": "Bearer not-a-real-token"})
    assert r.status_code == 401


def test_deactivated_user_cannot_login(client):
    headers = admin_headers(client)
    site = create_site(client, headers)
    create_user(client, headers, "bob", "password123", "worker", site_id=site["id"])

    tokens = login(client, "bob", "password123")
    r = client.patch(f"/users/2/active?active=false", headers=headers)
    assert r.status_code == 200
    assert r.json()["active"] is False

    r = client.post("/auth/login", json={"username": "bob", "password": "password123"})
    assert r.status_code == 401


def test_refresh_token_rotates_and_old_one_stops_working(client):
    tokens = login(client, "admin", "admin123")

    r = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r.status_code == 200
    new_tokens = r.json()
    assert new_tokens["refresh_token"] != tokens["refresh_token"]

    # Reusing the original (now-rotated) refresh token must fail.
    r2 = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r2.status_code == 401

    # The new refresh token works.
    r3 = client.post("/auth/refresh", json={"refresh_token": new_tokens["refresh_token"]})
    assert r3.status_code == 200


def test_logout_revokes_refresh_token(client):
    tokens = login(client, "admin", "admin123")
    headers = auth_headers(tokens)

    r = client.post("/auth/logout", json={"refresh_token": tokens["refresh_token"]}, headers=headers)
    assert r.status_code == 204

    r2 = client.post("/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert r2.status_code == 401

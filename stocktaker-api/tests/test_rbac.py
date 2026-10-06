from .conftest import admin_headers, auth_headers, login, create_site, create_user, create_category


def test_worker_cannot_create_category(client):
    admin = admin_headers(client)
    site = create_site(client, admin)
    create_user(client, admin, "worker1", "password123", "worker", site_id=site["id"])
    worker_headers = auth_headers(login(client, "worker1", "password123"))

    r = client.post("/categories", json={"name": "Steel", "code": "STL"}, headers=worker_headers)
    assert r.status_code == 403


def test_manager_can_create_category_worker_cannot_register_item(client):
    admin = admin_headers(client)
    site = create_site(client, admin)
    category = create_category(client, admin)
    create_user(client, admin, "mgr1", "password123", "manager", site_id=site["id"])
    create_user(client, admin, "worker1", "password123", "worker", site_id=site["id"])
    mgr_headers = auth_headers(login(client, "mgr1", "password123"))
    worker_headers = auth_headers(login(client, "worker1", "password123"))

    r = client.post("/items", json={
        "name": "Rebar", "category_id": category["id"], "site_id": site["id"], "initial_quantity": 10,
    }, headers=worker_headers)
    assert r.status_code == 403

    r = client.post("/items", json={
        "name": "Rebar", "category_id": category["id"], "site_id": site["id"], "initial_quantity": 10,
    }, headers=mgr_headers)
    assert r.status_code == 201


def test_worker_can_check_in_and_out_but_not_adjust(client):
    admin = admin_headers(client)
    site = create_site(client, admin)
    category = create_category(client, admin)
    create_user(client, admin, "worker1", "password123", "worker", site_id=site["id"])
    worker_headers = auth_headers(login(client, "worker1", "password123"))

    r = client.post("/items", json={
        "name": "Rebar", "category_id": category["id"], "site_id": site["id"], "initial_quantity": 10,
    }, headers=admin)
    item_id = r.json()["id"]

    r = client.post(f"/items/{item_id}/check-out", json={"quantity": 2}, headers=worker_headers)
    assert r.status_code == 200

    r = client.post(f"/items/{item_id}/check-in", json={"quantity": 5}, headers=worker_headers)
    assert r.status_code == 200

    r = client.post(f"/items/{item_id}/adjust", json={"new_quantity": 100}, headers=worker_headers)
    assert r.status_code == 403


def test_manager_cannot_act_on_another_sites_item(client):
    admin = admin_headers(client)
    site_a = create_site(client, admin, "Warehouse A")
    site_b = create_site(client, admin, "Warehouse B")
    category = create_category(client, admin)

    create_user(client, admin, "mgr_a", "password123", "manager", site_id=site_a["id"])
    mgr_a_headers = auth_headers(login(client, "mgr_a", "password123"))

    r = client.post("/items", json={
        "name": "Widget", "category_id": category["id"], "site_id": site_b["id"], "initial_quantity": 5,
    }, headers=mgr_a_headers)
    assert r.status_code == 403  # can't even register into a site they don't manage

    # Item created by admin at site B...
    r = client.post("/items", json={
        "name": "Widget", "category_id": category["id"], "site_id": site_b["id"], "initial_quantity": 5,
    }, headers=admin)
    item_id = r.json()["id"]

    # ...manager for site A can't see or touch it.
    r = client.get(f"/items/{item_id}", headers=mgr_a_headers)
    assert r.status_code == 403

    r = client.post(f"/items/{item_id}/check-out", json={"quantity": 1}, headers=mgr_a_headers)
    assert r.status_code == 403


def test_admin_sees_all_sites_manager_sees_only_their_own(client):
    admin = admin_headers(client)
    site_a = create_site(client, admin, "Warehouse A")
    site_b = create_site(client, admin, "Warehouse B")
    category = create_category(client, admin)
    create_user(client, admin, "mgr_a", "password123", "manager", site_id=site_a["id"])
    mgr_a_headers = auth_headers(login(client, "mgr_a", "password123"))

    client.post("/items", json={
        "name": "Item A", "category_id": category["id"], "site_id": site_a["id"], "initial_quantity": 1,
    }, headers=admin)
    client.post("/items", json={
        "name": "Item B", "category_id": category["id"], "site_id": site_b["id"], "initial_quantity": 1,
    }, headers=admin)

    r = client.get("/items", headers=admin)
    assert len(r.json()) == 2

    r = client.get("/items", headers=mgr_a_headers)
    names = {i["name"] for i in r.json()}
    assert names == {"Item A"}


def test_non_admin_cannot_manage_users(client):
    admin = admin_headers(client)
    site = create_site(client, admin)
    create_user(client, admin, "mgr1", "password123", "manager", site_id=site["id"])
    mgr_headers = auth_headers(login(client, "mgr1", "password123"))

    r = client.get("/users", headers=mgr_headers)
    assert r.status_code == 403

    r = client.post("/users", json={
        "username": "sneaky", "password": "password123", "role": "worker", "site_id": site["id"],
    }, headers=mgr_headers)
    assert r.status_code == 403

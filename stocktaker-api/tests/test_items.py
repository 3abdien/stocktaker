from .conftest import admin_headers, create_site, create_category


def _setup(client):
    headers = admin_headers(client)
    site = create_site(client, headers)
    category = create_category(client, headers, "Steel", "STL")
    return headers, site, category


def test_register_item_with_auto_generated_barcode(client):
    headers, site, category = _setup(client)

    r = client.post("/items", json={
        "name": "Rebar 12mm", "category_id": category["id"], "site_id": site["id"],
        "initial_quantity": 100, "unit": "kg", "min_stock": 20,
    }, headers=headers)
    assert r.status_code == 201, r.text
    item = r.json()
    assert item["barcode"].startswith("STL-")
    assert item["quantity"] == 100
    assert item["is_low_stock"] is False


def test_register_item_with_existing_barcode(client):
    headers, site, category = _setup(client)
    r = client.post("/items", json={
        "name": "Dell Latitude 5420", "category_id": category["id"], "site_id": site["id"],
        "barcode": "DELL-0001", "initial_quantity": 3,
    }, headers=headers)
    assert r.status_code == 201
    assert r.json()["barcode"] == "DELL-0001"


def test_duplicate_barcode_rejected(client):
    headers, site, category = _setup(client)
    body = {
        "name": "Thing", "category_id": category["id"], "site_id": site["id"],
        "barcode": "DUPE-1", "initial_quantity": 1,
    }
    r1 = client.post("/items", json=body, headers=headers)
    assert r1.status_code == 201
    r2 = client.post("/items", json=body, headers=headers)
    assert r2.status_code == 409


def test_lookup_by_barcode(client):
    headers, site, category = _setup(client)
    client.post("/items", json={
        "name": "Cable", "category_id": category["id"], "site_id": site["id"],
        "barcode": "CBL-1", "initial_quantity": 5,
    }, headers=headers)

    r = client.get("/items?barcode=CBL-1", headers=headers)
    assert r.status_code == 200
    results = r.json()
    assert len(results) == 1
    assert results[0]["name"] == "Cable"

    r2 = client.get("/items?barcode=DOES-NOT-EXIST", headers=headers)
    assert r2.status_code == 200
    assert r2.json() == []


def test_check_in_check_out_and_adjust(client):
    headers, site, category = _setup(client)
    r = client.post("/items", json={
        "name": "Cat6 cable", "category_id": category["id"], "site_id": site["id"],
        "initial_quantity": 10,
    }, headers=headers)
    item_id = r.json()["id"]

    r = client.post(f"/items/{item_id}/check-out", json={"quantity": 4, "note": "used"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["resulting_quantity"] == 6

    r = client.post(f"/items/{item_id}/check-in", json={"quantity": 20}, headers=headers)
    assert r.status_code == 200
    assert r.json()["resulting_quantity"] == 26

    r = client.post(f"/items/{item_id}/adjust", json={"new_quantity": 30, "note": "recount"}, headers=headers)
    assert r.status_code == 200
    assert r.json()["resulting_quantity"] == 30
    assert r.json()["quantity_delta"] == 4


def test_check_out_more_than_available_fails(client):
    headers, site, category = _setup(client)
    r = client.post("/items", json={
        "name": "Cat6 cable", "category_id": category["id"], "site_id": site["id"],
        "initial_quantity": 3,
    }, headers=headers)
    item_id = r.json()["id"]

    r = client.post(f"/items/{item_id}/check-out", json={"quantity": 5}, headers=headers)
    assert r.status_code == 400

    r = client.get(f"/items/{item_id}", headers=headers)
    assert r.json()["quantity"] == 3  # unchanged


def test_low_stock_dashboard(client):
    headers, site, category = _setup(client)
    client.post("/items", json={
        "name": "Low item", "category_id": category["id"], "site_id": site["id"],
        "initial_quantity": 2, "min_stock": 5,
    }, headers=headers)
    client.post("/items", json={
        "name": "OK item", "category_id": category["id"], "site_id": site["id"],
        "initial_quantity": 50, "min_stock": 5,
    }, headers=headers)

    r = client.get("/dashboard/low-stock", headers=headers)
    assert r.status_code == 200
    names = {i["name"] for i in r.json()}
    assert "Low item" in names
    assert "OK item" not in names

    r = client.get("/dashboard/summary", headers=headers)
    body = r.json()
    assert body["total_items"] == 2
    assert body["low_stock_count"] == 1

from .conftest import admin_headers, auth_headers, login, create_site, create_user, create_category


def _flag(client, headers, site_id, barcode="UNKNOWN-1", note="found in aisle 3"):
    return client.post(
        "/reports/unidentified",
        data={"barcode": barcode, "note": note, "site_id": site_id},
        files={"photo": ("scan.jpg", b"fake-jpeg-bytes", "image/jpeg")},
        headers=headers,
    )


def test_worker_can_flag_unidentified_item(client):
    admin = admin_headers(client)
    site = create_site(client, admin)
    create_user(client, admin, "worker1", "password123", "worker", site_id=site["id"])
    worker_headers = auth_headers(login(client, "worker1", "password123"))

    r = _flag(client, worker_headers, site["id"])
    assert r.status_code == 201, r.text
    report = r.json()
    assert report["status"] == "pending"
    assert report["barcode"] == "UNKNOWN-1"


def test_flag_without_photo_is_rejected(client):
    admin = admin_headers(client)
    site = create_site(client, admin)
    create_user(client, admin, "worker1", "password123", "worker", site_id=site["id"])
    worker_headers = auth_headers(login(client, "worker1", "password123"))

    r = client.post(
        "/reports/unidentified",
        data={"barcode": "UNKNOWN-1", "note": "", "site_id": site["id"]},
        files={"photo": ("empty.jpg", b"", "image/jpeg")},
        headers=worker_headers,
    )
    assert r.status_code == 400


def test_manager_resolves_report_into_item(client):
    admin = admin_headers(client)
    site = create_site(client, admin)
    category = create_category(client, admin, "Networking", "NET")
    create_user(client, admin, "worker1", "password123", "worker", site_id=site["id"])
    create_user(client, admin, "mgr1", "password123", "manager", site_id=site["id"])
    worker_headers = auth_headers(login(client, "worker1", "password123"))
    mgr_headers = auth_headers(login(client, "mgr1", "password123"))

    report = _flag(client, worker_headers, site["id"], barcode="ROUTER-99").json()

    # Worker cannot resolve their own report.
    r = client.post(
        f"/reports/unidentified/{report['id']}/resolve",
        json={"name": "TP-Link Router", "category_id": category["id"], "initial_quantity": 1},
        headers=worker_headers,
    )
    assert r.status_code == 403

    r = client.post(
        f"/reports/unidentified/{report['id']}/resolve",
        json={"name": "TP-Link Router", "category_id": category["id"], "initial_quantity": 1},
        headers=mgr_headers,
    )
    assert r.status_code == 200, r.text
    item = r.json()
    assert item["barcode"] == "ROUTER-99"
    assert item["name"] == "TP-Link Router"

    # The item is now scannable directly.
    r = client.get("/items?barcode=ROUTER-99", headers=mgr_headers)
    assert len(r.json()) == 1

    # And the worker can see their report is resolved.
    r = client.get("/reports/unidentified/mine", headers=worker_headers)
    mine = r.json()
    assert len(mine) == 1
    assert mine[0]["status"] == "resolved"
    assert mine[0]["resolved_item_id"] == item["id"]


def test_manager_rejects_report_with_reason(client):
    admin = admin_headers(client)
    site = create_site(client, admin)
    create_user(client, admin, "worker1", "password123", "worker", site_id=site["id"])
    create_user(client, admin, "mgr1", "password123", "manager", site_id=site["id"])
    worker_headers = auth_headers(login(client, "worker1", "password123"))
    mgr_headers = auth_headers(login(client, "mgr1", "password123"))

    report = _flag(client, worker_headers, site["id"]).json()

    r = client.post(
        f"/reports/unidentified/{report['id']}/reject",
        json={"reason": "duplicate of an existing report"},
        headers=mgr_headers,
    )
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"
    assert r.json()["rejection_reason"] == "duplicate of an existing report"


def test_cannot_resolve_or_reject_a_report_twice(client):
    admin = admin_headers(client)
    site = create_site(client, admin)
    category = create_category(client, admin)
    create_user(client, admin, "worker1", "password123", "worker", site_id=site["id"])
    worker_headers = auth_headers(login(client, "worker1", "password123"))

    report = _flag(client, worker_headers, site["id"]).json()

    r = client.post(
        f"/reports/unidentified/{report['id']}/reject",
        json={"reason": "junk"}, headers=admin,
    )
    assert r.status_code == 200

    r2 = client.post(
        f"/reports/unidentified/{report['id']}/reject",
        json={"reason": "junk again"}, headers=admin,
    )
    assert r2.status_code == 409

    r3 = client.post(
        f"/reports/unidentified/{report['id']}/resolve",
        json={"name": "X", "category_id": category["id"]}, headers=admin,
    )
    assert r3.status_code == 409


def test_review_queue_is_site_scoped_for_managers(client):
    admin = admin_headers(client)
    site_a = create_site(client, admin, "Warehouse A")
    site_b = create_site(client, admin, "Warehouse B")
    create_user(client, admin, "worker_a", "password123", "worker", site_id=site_a["id"])
    create_user(client, admin, "worker_b", "password123", "worker", site_id=site_b["id"])
    create_user(client, admin, "mgr_a", "password123", "manager", site_id=site_a["id"])
    worker_a = auth_headers(login(client, "worker_a", "password123"))
    worker_b = auth_headers(login(client, "worker_b", "password123"))
    mgr_a = auth_headers(login(client, "mgr_a", "password123"))

    _flag(client, worker_a, site_a["id"], barcode="A-1")
    _flag(client, worker_b, site_b["id"], barcode="B-1")

    r = client.get("/reports/unidentified?status=pending", headers=mgr_a)
    barcodes = {rep["barcode"] for rep in r.json()}
    assert barcodes == {"A-1"}

    r = client.get("/reports/unidentified?status=pending", headers=admin)
    barcodes = {rep["barcode"] for rep in r.json()}
    assert barcodes == {"A-1", "B-1"}


def test_photo_access_is_restricted_to_same_site(client):
    admin = admin_headers(client)
    site_a = create_site(client, admin, "Warehouse A")
    site_b = create_site(client, admin, "Warehouse B")
    create_user(client, admin, "worker_a", "password123", "worker", site_id=site_a["id"])
    create_user(client, admin, "mgr_b", "password123", "manager", site_id=site_b["id"])
    worker_a = auth_headers(login(client, "worker_a", "password123"))
    mgr_b = auth_headers(login(client, "mgr_b", "password123"))

    report = _flag(client, worker_a, site_a["id"]).json()
    photo_name = report["photo_path"]

    r = client.get(f"/photos/{photo_name}", headers=mgr_b)
    assert r.status_code == 403

    r = client.get(f"/photos/{photo_name}", headers=worker_a)
    assert r.status_code == 200
    # The exact bytes uploaded come back out of the database.
    assert r.content == b"fake-jpeg-bytes"
    assert r.headers["content-type"] == "image/jpeg"


def test_rejected_flag_does_not_leave_an_orphan_photo(client):
    """The photo is saved in the same transaction as its report, so a
    failed report (here: blank barcode) mustn't leave the photo behind."""
    from app.database import SessionLocal
    from app.models import Photo

    admin = admin_headers(client)
    site = create_site(client, admin)
    r = _flag(client, admin, site["id"], barcode="   ")
    assert r.status_code == 400

    with SessionLocal() as db:
        assert db.query(Photo).count() == 0

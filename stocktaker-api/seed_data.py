#!/usr/bin/env python3
"""Populate the database with example data: one site, a few categories and
items, and one user per role, so you can explore the API (or point a
client at it) immediately. Safe to run once after first setup - it skips
seeding if any categories already exist.

Usage:  python seed_data.py
"""

from app.database import Base, engine, SessionLocal
from app import services
from app.models import UserRole


def main():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        services.ensure_default_admin(db)
        db.commit()

        if services.list_categories(db):
            print("Database already has categories - skipping seed to avoid duplicates.")
            return

        from app.models import Site
        site = Site(name="Main Warehouse", address="1 Industrial Way")
        db.add(site)
        db.flush()

        admin = services.authenticate(db, "admin", "admin123")

        mgr = services.create_user(db, "manager1", "password123", "Sam Manager", UserRole.MANAGER, site.id)
        services.create_user(db, "worker1", "password123", "Wael Worker", UserRole.WORKER, site.id)

        wires = services.create_category(db, "Wires", "WIR", "Network & power cables")
        laptops = services.create_category(db, "Laptops", "LAP", "Company laptops")
        monitors = services.create_category(db, "Monitors", "MON", "Desk monitors")
        steel = services.create_category(db, "Steel", "STL", "Raw steel stock")

        services.register_new_item(db, mgr, wires, site.id, "Cat6 Ethernet cable 2m", 80, unit="pcs", min_stock=20)
        services.register_new_item(db, mgr, wires, site.id, "Power extension cable 5m", 15, unit="pcs", min_stock=5)
        services.register_new_item(
            db, mgr, laptops, site.id, "Dell Latitude 5420", 6, unit="pcs", min_stock=2,
            barcode="DELL-5420-STOCK",
        )
        services.register_new_item(db, mgr, monitors, site.id, "Dell 24in Monitor", 12, unit="pcs", min_stock=3)
        services.register_new_item(db, mgr, steel, site.id, "Rebar 12mm", 500, unit="kg", min_stock=100)

        db.commit()
        print("Seeded 1 site, 4 categories, 5 items, and 3 users:")
        print("  admin    / admin123    (company-wide admin)")
        print("  manager1 / password123 (Main Warehouse manager)")
        print("  worker1  / password123 (Main Warehouse worker)")
    finally:
        db.close()


if __name__ == "__main__":
    main()

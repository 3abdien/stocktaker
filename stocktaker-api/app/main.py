from __future__ import annotations

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import Base, engine, SessionLocal
from .routers import auth, sites, categories, items, reports, photos, dashboard, transactions, users
from . import services


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        services.ensure_default_admin(db)
        db.commit()
    finally:
        db.close()
    yield


def create_app() -> FastAPI:
    prefix = settings.api_prefix.rstrip("/")

    app = FastAPI(
        title="Stocktaker API",
        description="Shared backend for the web dashboard and warehouse-worker mobile app.",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=f"{prefix}/docs",
        redoc_url=f"{prefix}/redoc",
        openapi_url=f"{prefix}/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    for router in (auth.router, sites.router, categories.router, items.router,
                   reports.router, photos.router, dashboard.router, transactions.router, users.router):
        app.include_router(router, prefix=prefix)

    @app.get(f"{prefix}/health")
    def health():
        return {"status": "ok"}

    if settings.web_dist_dir is not None:
        # Registered last: its catch-all route must not shadow the API.
        _serve_web_dashboard(app, settings.web_dist_dir, prefix)

    return app


def _serve_web_dashboard(app: FastAPI, dist_dir: Path, api_prefix: str) -> None:
    """Serve the built React dashboard from the same origin as the API.

    Real files (JS/CSS bundles, icons) are served as-is. Any other path gets
    index.html, so a browser refresh on a client-side route like /items
    still loads the app and React Router takes it from there. That's why
    the API needs a prefix in this mode: without one, /items would be both
    a dashboard page and an API endpoint.
    """
    root = dist_dir.resolve()
    index = root / "index.html"
    if not index.is_file():
        raise RuntimeError(f"WEB_DIST_DIR is set but {index} doesn't exist - build stocktaker-web first.")

    api_root = api_prefix.strip("/")

    @app.get("/{full_path:path}", include_in_schema=False)
    def web_dashboard(full_path: str):
        if api_root and (full_path == api_root or full_path.startswith(api_root + "/")):
            # An unknown API path should be a JSON 404, not the dashboard.
            raise HTTPException(status_code=404, detail="Not Found")

        candidate = (root / full_path).resolve()
        if full_path and candidate.is_file() and candidate.is_relative_to(root):
            # Vite fingerprints everything under assets/ (index-3f9a1c.js), so
            # those can be cached forever; other files may change in place.
            immutable = candidate.is_relative_to(root / "assets")
            cache = "public, max-age=31536000, immutable" if immutable else "no-cache"
            return FileResponse(candidate, headers={"Cache-Control": cache})

        return FileResponse(index, headers={"Cache-Control": "no-cache"})


app = create_app()

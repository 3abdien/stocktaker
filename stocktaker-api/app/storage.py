"""Photo storage for flagged-item reports.

Photos live in the `photos` table rather than on local disk, so the app
works on hosts whose filesystem is wiped on every deploy (Render's free
tier) and the database is the only thing that needs backing up. At this
app's scale - one ~0.5 MB photo per flagged item - that's comfortably
within what Postgres handles well. Moving to S3-compatible object storage
later would only change this file.
"""

from __future__ import annotations

import uuid
from pathlib import Path

from sqlalchemy.orm import Session

from .models import Photo

_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
}


def save_photo(db: Session, content: bytes, original_filename: str) -> str:
    """Store photo bytes; return the name that's saved on the report and
    served back via /photos/<name>. Joins the caller's transaction - it's
    committed together with the report that references it."""
    suffix = Path(original_filename).suffix.lower()
    if suffix not in _CONTENT_TYPES:
        suffix = ".jpg"
    name = f"{uuid.uuid4().hex}{suffix}"
    db.add(Photo(name=name, content_type=_CONTENT_TYPES[suffix], content=content))
    return name


def load_photo(db: Session, stored_name: str) -> Photo | None:
    return db.get(Photo, stored_name)

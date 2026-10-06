# One image for the whole Stocktaker server: builds the web dashboard, then
# runs the API, which serves the API under /api and the dashboard at /.
# Used by render.yaml; works on any host that runs a Dockerfile.
#
# (stocktaker-api/Dockerfile still builds the API on its own, for the
# docker-compose Postgres setup in that folder.)

# --- Stage 1: build the web dashboard ---------------------------------------
FROM node:24-alpine AS web
WORKDIR /web
COPY stocktaker-web/package.json stocktaker-web/package-lock.json ./
RUN npm ci
COPY stocktaker-web/ ./
# Same origin as the API, so the dashboard calls a relative /api.
ENV VITE_API_BASE_URL=/api
RUN npm run build

# --- Stage 2: the API, serving the built dashboard --------------------------
FROM python:3.12-slim

# libzbar0 is needed by pyzbar (barcode decoding for the dashboard's
# photo-upload scan flow); libpq5 by psycopg2 at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libzbar0 \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY stocktaker-api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY stocktaker-api/app ./app
COPY stocktaker-api/alembic ./alembic
COPY stocktaker-api/alembic.ini .
COPY --from=web /web/dist ./web

ENV API_PREFIX=/api \
    WEB_DIST_DIR=/srv/web \
    PYTHONUNBUFFERED=1

EXPOSE 8000

# Apply migrations, then start. Hosts like Render pass the port in $PORT.
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'

FROM python:3.11-slim

# libzbar0 is needed by pyzbar (barcode decoding for the web-dashboard
# photo-upload scan flow); libpq5 by psycopg2 at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libzbar0 \
        libpq5 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY alembic ./alembic
COPY alembic.ini .

EXPOSE 8000

# Apply migrations, then start the API. Using migrations here (not
# create_all) is what makes future schema changes deployable safely.
CMD alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000

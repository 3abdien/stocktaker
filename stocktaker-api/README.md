# Stocktaker API

The shared backend for the Stocktaker platform: one Postgres database, one
set of business rules, and a REST API that both the web dashboard and the
warehouse-worker mobile app talk to. Neither client ever touches the
database directly.

This implements the schema and API surface from the platform requirements
spec: sites (multi-warehouse support), role-based access (admin / manager /
worker), items and stock movements, and the flag-for-review workflow for
barcodes nobody recognizes yet.

## Roles & access control

- **admin** - company-wide. Manages sites, users, categories; full access to every site.
- **manager** - runs one site's office side. Registers/edits items, resolves that site's flagged reports, check-in/out/adjust.
- **worker** - the mobile app. Check-in/out known items; can flag an unknown barcode with a photo, but cannot categorize it or adjust stock - that stays with the office.

Every endpoint enforces this server-side (see `app/deps.py`): a worker's
token literally cannot query another site's data, whatever the client asks
for. This is the reason the API exists at all instead of clients hitting
Postgres directly - see the architecture spec.

## Quick start (SQLite, no setup)

```bash
pip install -r requirements.txt
python seed_data.py      # optional: one site, a few items, one user per role
uvicorn app.main:app --reload
```

Open `http://localhost:8000/docs` for interactive API docs (Swagger UI) -
every endpoint below can be tried directly from there. On first run, a
default admin account is created automatically:

- **Username:** `admin`
- **Password:** `admin123`

That default is for local use only: on a public deploy, set
`INITIAL_ADMIN_PASSWORD` so the `admin` account is created with your own
password instead (it only applies when the users table is empty).

## Running against Postgres (matches production)

```bash
docker compose up --build
```

This starts Postgres and the API together, with the API's migrations
applied automatically on container start. The API is on
`http://localhost:8000`, Postgres on `localhost:5432` (user/password/db:
`stocktaker`/`stocktaker`/`stocktaker`).

## Configuration

Copy `.env.example` to `.env` and adjust. Key variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | SQLite by default; a Postgres URL in production (`postgres://`, `postgresql://` and `postgresql+psycopg2://` all work) |
| `JWT_SECRET` | **Must** be overridden in production - anyone who knows it can forge tokens |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | How long an access token is valid (default 30) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | How long a refresh token is valid before re-login is required (default 30) |
| `INITIAL_ADMIN_PASSWORD` | Password for the `admin` account created on first startup (default `admin123` - **set it** on any public deploy) |
| `CORS_ORIGINS` | Comma-separated browser origins allowed to call the API (default includes the dashboard's `http://localhost:5173`). Not needed in the combined deploy (same origin) or for the mobile app |
| `API_PREFIX` | Path prefix for every route - empty locally, `/api` in the combined deploy |
| `WEB_DIST_DIR` | Built web dashboard to serve at `/` (combined deploy only) |

## Auth flow

1. `POST /auth/login` with `{username, password}` → `{access_token, refresh_token}`.
2. Send `Authorization: Bearer <access_token>` on every other request.
3. When the access token expires (~30 min), `POST /auth/refresh` with the
   refresh token to get a new pair. The old refresh token is revoked the
   moment it's used (rotation), so a stolen-but-unused token can't be
   replayed after the legitimate client refreshes.
4. `POST /auth/logout` with a refresh token revokes it immediately (e.g.
   on "sign out" or when a phone is reported lost).

Passwords are bcrypt-hashed; tokens are JWTs signed with `JWT_SECRET`.

## API surface

Full interactive reference at `/docs`. Highlights:

| | |
|---|---|
| `POST /auth/login`, `/auth/refresh`, `/auth/logout` | Session lifecycle |
| `GET /items?barcode=...` | Scan lookup - the core mobile-app call |
| `POST /items` | Register a new item (admin/manager) |
| `POST /items/{id}/check-in` \| `/check-out` | Move stock (any signed-in role) |
| `POST /items/{id}/adjust` | Recount correction (admin/manager only) |
| `POST /reports/unidentified` | Worker flags an unknown barcode + required photo |
| `GET /reports/unidentified?status=pending` | Office review queue (site-scoped) |
| `POST /reports/unidentified/{id}/resolve` \| `/reject` | Office closes out a flagged report |
| `GET /reports/unidentified/mine` | A worker's own flagged reports + status |
| `GET /dashboard/summary`, `/dashboard/low-stock` | Live stock health |
| `GET /export/stock.csv`, `/export/transactions.csv` | Reporting, same as the desktop prototype |
| `POST /items/decode-photo` | Web-dashboard helper: upload a photo, get back any barcode found in it (mobile decodes on-device instead) |

## Database migrations (Alembic)

The schema is managed with Alembic, not ad-hoc `create_all` calls, so
future changes ship as reviewable migrations:

```bash
alembic upgrade head                              # apply migrations
alembic revision --autogenerate -m "add X"         # after changing app/models.py
```

(`app/main.py`'s startup also calls `create_all` as a convenience so the
SQLite quick-start above works with zero setup - in production, the Docker
image runs `alembic upgrade head` explicitly before starting the server,
which is the path that actually matters once there's real data to preserve
across schema changes.)

## Flagged-item photos

Stored in the database (`photos` table), served back through
`GET /photos/{name}` with the same site-scoped access control as
everything else. Keeping them in Postgres means the server needs no
persistent disk - which is what lets it run on Render's free tier, where
the filesystem is wiped on every deploy - and the database is the only
thing to back up. `app/storage.py` is the one file that would change to
move this to S3-compatible object storage if volume ever grows.

## Deploying

The whole platform deploys as **one service**: the root `Dockerfile`
builds the web dashboard and bakes it into this API's image, which then
serves the API under `/api` and the dashboard at `/`. See the root
`README.md` for the step-by-step (Render free tier + Neon free Postgres,
described by the root `render.yaml`).

The container runs `alembic upgrade head` before starting, so schema
changes deploy themselves. To move to raw AWS later (ECS/Fargate + RDS),
nothing in the application changes - only `DATABASE_URL` and where the
container runs.

`docker compose up --build` in this folder still runs the API alone
(at the root path, no dashboard) against a local Postgres.

## Running the tests

```bash
pip install -r requirements.txt   # includes pytest
python -m pytest tests -q
```

40 tests, no database or network setup required (each test gets a fresh
throwaway SQLite DB). Coverage includes: login/refresh/logout token
lifecycle and rotation, the full check-in/check-out/adjust stock flow,
barcode uniqueness and lookup, and - the two areas most likely to hide a
real bug - the complete flag-for-review workflow (flag → office resolves
or rejects → item appears in inventory) and role/site access control
(a worker can't adjust stock; a manager for one site can't see or touch
another site's items or reports; photos are only visible to that site's
staff and the worker who took them), plus the combined deploy (API
under `/api`, dashboard routes served `index.html`, unknown API paths
still a JSON 404).

## Project layout

```
app/
  config.py     # Settings via environment variables / .env
  database.py   # SQLAlchemy engine/session
  models.py     # Site, User, Category, Item, Transaction, UnidentifiedReport, Photo, RefreshToken
  schemas.py    # Pydantic request/response models
  security.py   # Password hashing, JWT issuing/verification
  deps.py       # Auth dependency, role checks, site-scoping - the RBAC layer
  services.py   # Business logic (framework-agnostic, directly unit-tested)
  barcode_utils.py  # Barcode generation + photo decoding
  storage.py    # Flagged-item photo storage - in the DB (swap for S3 here)
  routers/      # One file per resource - auth, items, reports, etc.
  main.py       # FastAPI app assembly (+ serving the dashboard when WEB_DIST_DIR is set)
alembic/        # Database migrations
tests/          # pytest suite (see above)
seed_data.py    # Example site/categories/items/users
docker-compose.yml  # API + Postgres for local development
Dockerfile      # API-only image (the deployed image is ../Dockerfile)
```

## The other pieces

`../stocktaker-web` (office dashboard) and `../stocktaker-mobile`
(warehouse-worker app) are both built against this API, and neither
touches the database directly.

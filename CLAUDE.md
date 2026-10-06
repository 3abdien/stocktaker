# CLAUDE.md

## Project overview

This workspace contains three separate applications that work together:

- `stocktaker-api/` — FastAPI backend with SQLAlchemy, JWT auth, RBAC, and site-scoped business logic.
- `stocktaker-web/` — React + TypeScript + Vite dashboard for office users.
- `stocktaker-mobile/` — Expo (React Native) app for warehouse workers: scan, check in/out, flag unknown barcodes.

The backend is the source of truth for authentication, authorization, inventory rules, and database access. The web and mobile apps are clients that consume the API contract.

## Repo layout

```text
stocktaker/
├── stocktaker-api/
│   ├── app/
│   ├── alembic/
│   ├── tests/
│   ├── requirements.txt
│   ├── docker-compose.yml
│   ├── Dockerfile
│   ├── README.md
│   └── seed_data.py
├── stocktaker-web/
│   ├── src/
│   ├── public/
│   ├── package.json
│   ├── vite.config.ts
│   └── README.md
├── stocktaker-mobile/
│   ├── src/app/        (Expo Router routes)
│   ├── src/api/
│   ├── app.json
│   └── README.md
└── CLAUDE.md
```

## Stack

### Backend
- Python 3.12+
- FastAPI
- SQLAlchemy
- PostgreSQL by default, SQLite for local quick start
- Alembic migrations
- Pytest

### Mobile
- Expo SDK 57, React Native, TypeScript
- Expo Router, expo-camera (barcode scanning), expo-secure-store

### Frontend
- React 19
- TypeScript
- Vite
- React Router
- Vitest + React Testing Library

## How to run

### Backend

From `stocktaker-api/`:

```bash
python -m venv .venv
. .venv/Scripts/activate  # Windows PowerShell
pip install -r requirements.txt
python seed_data.py  # optional demo data
uvicorn app.main:app --reload
```

API docs: http://localhost:8000/docs

Default admin credentials:
- username: `admin`
- password: `admin123`

### Frontend

From `stocktaker-web/`:

```bash
npm install
npm run dev
```

The app runs at http://localhost:5173 and expects the API at http://localhost:8000.

### Mobile

From `stocktaker-mobile/` (start the API with `--host 0.0.0.0` so the phone can reach it):

```bash
npm install
npx expo start   # open in Expo Go on a phone on the same Wi-Fi
```

## Key commands

### Backend verification

```bash
cd stocktaker-api
pip install -r requirements.txt
python -m pytest tests -q
```

### Frontend verification

```bash
cd stocktaker-web
npm install
npm run build
npm test
npm run lint
```

### Mobile verification

```bash
cd stocktaker-mobile
npm run typecheck
npm run lint
npx expo-doctor
```

## Deployment

- One git repo at the root. `Dockerfile` + `render.yaml` at the root deploy API + dashboard as a single Render service (free tier) with Neon Postgres; see root `README.md`.
- In that deploy the API is under `/api` (`API_PREFIX`) and serves the built dashboard (`WEB_DIST_DIR`). Locally the API has no prefix.
- Flagged-item photos are stored in the database (`photos` table), not on disk.
- Mobile release = APK via EAS (`stocktaker-mobile/eas.json`, `preview` profile), with the hosted URL baked in.
- When building from Git Bash, set `MSYS_NO_PATHCONV=1` or values like `/api` get rewritten to Windows paths.

## Important project conventions

- The API, web app and mobile app are intentionally separate deployables; they agree on an HTTP contract but do not share code.
- Role and site enforcement are enforced in the backend, not just in UI checks.
- Frontend route guards are UX protections, not security boundaries.
- `src/api/*.ts` mirrors backend routers in `app/routers/*.py` (in both web and mobile).
- `src/types/index.ts` mirrors backend Pydantic schemas (in both web and mobile).
- In `stocktaker-mobile/`, use `npx expo install <pkg>` (not `npm install <pkg>`) so versions match the Expo SDK, and check the versioned Expo docs before using an Expo API (see its AGENTS.md).
- The backend uses Alembic for schema changes and prefers migrations over ad hoc table creation.

## Typical tasks

When working here:

1. Check the matching backend router or service for server-side behavior.
2. Mirror the contract in the frontend API helper or type definition when needed.
3. Validate with the smallest relevant test or build command.
4. Prefer root-cause fixes over UI-only patches when role or data access is involved.

## Notes

- The backend default README already describes the system architecture and requirements.
- The workspace currently has Python dependencies not yet installed in the environment; install them before running backend tests.
- Use the API contract and existing code patterns as the source of truth rather than assuming a different structure.

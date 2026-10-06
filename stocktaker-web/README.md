# Stocktaker — Web Dashboard

The office-side web app for the Stocktaker platform: the tool admins and
site managers use to register items, check stock in and out, review items
warehouse workers couldn't identify, and manage sites and user accounts.
It's the third piece of the system, after the `stocktaker-api` backend and
before the (not-yet-built) mobile app for warehouse workers.

This README is written to double as interview prep — each section ends
with the questions you're most likely to get asked about that part, and
short answers you can give in your own words.

## Tech stack and why

- **React 19 + TypeScript + Vite** — Vite for a fast dev server and simple
  build; TypeScript so the compiler catches a typo'd field name (`site_Id`
  vs `site_id`) before it ships, not at runtime in a browser.
- **react-router-dom** — client-side routing and the `<ProtectedRoute>`
  guard pattern (see below).
- **React Context**, not Redux — the only genuinely global state this app
  has is "who is signed in." One `AuthContext` covers that; adding a state
  management library for one piece of state would be over-engineering.
- **Plain CSS with design tokens**, not a component library — the app is
  small enough that hand-rolled CSS variables (`--accent`, `--danger`,
  etc. in `src/index.css`) give full control without a dependency.
- **Vitest + React Testing Library** — Vite's own test runner, so no
  separate Jest config; tests render real components and assert on what a
  user would see, not implementation details.

## Project layout, and the "mirror the backend" idea

```
src/
  types/index.ts       - TypeScript types, one for one with the backend's
                          Pydantic schemas (app/schemas.py)
  api/                 - one file per backend router (items.ts mirrors
                          routers/items.py, reports.ts mirrors
                          routers/reports.py, etc.)
  auth/                - AuthContext (who's signed in) + ProtectedRoute
                          (route guard)
  hooks/                - useAsync (generic data-fetching state),
                          useSiteSelection (the site-filter dropdown logic,
                          shared by every page that needs it)
  components/           - reusable pieces: Layout (sidebar shell), Modal
                          (dialog shell), SiteSelector, NewItemModal,
                          StockActionModal, ReportPhoto
  pages/                - one component per route: Login, Dashboard,
                          Items, Categories, Reports, Admin
```

The deliberate choice worth calling out: **`src/api/*.ts` mirrors
`app/routers/*.py` file-for-file, and `src/types/index.ts` mirrors
`app/schemas.py`.** If you're looking at `routers/reports.py` on the
backend and wondering how the frontend calls it, the answer is always
"the file with the same name in `src/api/`." This isn't shared code (the
two projects don't import from each other — they're separate deployables
that only agree on the HTTP contract between them), but keeping the same
shape on both sides makes that contract easy to audit by eye, and it's
the first thing to point at when asked "how do the two halves of this
system stay in sync."

**Interview questions this section answers:**
- *"Walk me through how a click in the UI turns into a database change."*
  A page calls a function in `src/api/*.ts` → that calls `apiRequest()` in
  `src/api/client.ts`, which attaches the auth token and calls
  `fetch()` → the backend's matching router in `app/routers/*.py`
  validates the request against a Pydantic schema → calls into
  `app/services.py` → which touches the database via SQLAlchemy.
- *"Why not a monorepo / shared types package?"* Honest answer: at this
  size, hand-mirroring the types is simpler than the tooling overhead of
  a shared package, and it's an explicit decision, not an oversight —
  worth saying so if asked, rather than pretending it wasn't considered.

## Authentication: access + refresh tokens

The backend issues two tokens on login: a short-lived **access token**
(30 minutes) sent with every API request, and a longer-lived **refresh
token** (30 days) used only to get a new access token when the old one
expires.

On the frontend (`src/api/client.ts`):
- The access token lives **only in memory** (a plain module-level
  variable) — never in `localStorage`. It's gone the instant the tab is
  refreshed. This shrinks the window in which an XSS bug could read a
  usable token off disk.
- The refresh token lives in **`localStorage`**, so a page refresh
  doesn't force a full re-login. `AuthContext`'s bootstrap effect uses it
  on mount to silently fetch a fresh access token before rendering
  anything that needs auth.
- Every request goes through `apiRequest()`. On a `401`, it calls
  `/auth/refresh` once, swaps in the new access token, and retries the
  original request — the calling page never sees the 401 at all.
- **Refresh token rotation**: each refresh token is single-use — using it
  returns a *new* refresh token and invalidates the old one (enforced by
  the backend). This limits the damage if a refresh token is ever stolen:
  it stops working the next time the legitimate client refreshes.
- **Deduplication**: if five components each fire a request at the
  moment the access token expires, all five get `401` almost
  simultaneously. Without care, that would trigger five separate
  `/auth/refresh` calls — and because refresh tokens are single-use, four
  of them would fail. `client.ts` stashes the *in-flight refresh promise*
  in a module variable (`refreshInFlight`), so every caller that asks "is
  a refresh already happening?" gets handed the same promise instead of
  starting a new one. `src/api/client.test.ts` has a test that fires
  three concurrent requests and asserts exactly one refresh call happens.

**Interview questions this section answers:**
- *"Where's the access token stored, and why not `localStorage` for
  everything?"* In memory only, precisely to limit what an XSS
  vulnerability could steal; the tradeoff (losing it on refresh) is
  covered by the refresh token, which is safe to keep in `localStorage`
  because it rotates on every use.
- *"What happens if two tabs are open and both try to refresh at the
  same time?"* Each tab has its own in-memory `refreshInFlight`
  deduplication, but if both tabs' access tokens expire around the same
  moment, whichever tab refreshes first invalidates the other tab's
  stored refresh token — the second tab's refresh attempt would fail and
  it would be logged out. This is a known limitation, worth naming
  proactively: a production system might move refresh coordination into
  a `BroadcastChannel` or a shared worker to avoid it.
- *"How would you test this?"* Mock `fetch`, assert on call count and
  order rather than end-to-end through a real server — see
  `client.test.ts`.

## Role-based access control: two layers, one real

The backend has three roles — `admin`, `manager`, `worker` — each scoped
to zero, one, or all sites. `ProtectedRoute` (`src/auth/ProtectedRoute.tsx`)
checks the current user's role before rendering a route, and pages hide
buttons a role can't use (e.g. workers don't see "+ Register new item").

**This is UX polish, not security.** The real enforcement is the
backend's `app/deps.py`, which checks the same roles on every request
independently of what the frontend does. A user who opens dev tools and
bypasses `ProtectedRoute` would still get a real `403` from every API
call the backend doesn't allow for their role. `src/auth/ProtectedRoute.test.tsx`
tests three cases: signed out → redirect to login; wrong role → an
in-app "you don't have access" message (not a blank screen, not a silent
redirect); correct role → the page renders.

**Interview questions this section answers:**
- *"If I disabled JavaScript's routing check, could I see the admin
  page?"* You'd see the React component render, yes — but every API call
  it makes would fail with a 403 from the backend, so there'd be nothing
  to look at. Never rely on a frontend guard as the actual boundary.
- *"Why test the frontend guard at all, if it's not the real security?"*
  Because a broken guard is still a broken *user experience* — showing a
  worker a blank screen or a raw network error instead of a clear
  message is a bug worth catching, even though it isn't a vulnerability.

## Site scoping

Multi-site companies need every list (items, reports, transactions) to
be filterable by site — but who's *allowed* to filter is role-dependent:
an admin can view any site or "all sites"; a manager or worker is pinned
to their own site and never sees the dropdown at all. `useSiteSelection()`
(`src/hooks/useSiteSelection.ts`) centralizes this once, instead of every
page re-implementing "is this user an admin?" logic. It mirrors the
backend's own `effective_site_filter` in `app/deps.py`: even if a
non-admin's request somehow specified a different `site_id`, the backend
ignores it and uses their real site anyway — so the frontend is never
able to construct a request the backend would treat differently.

## The flag-for-review workflow

This is the feature that ties the whole platform together: a warehouse
worker (on the not-yet-built mobile app) scans a barcode the system
doesn't recognize, is required to take a photo of the item, and submits
an "unidentified report." `ReportsPage.tsx` is where the office resolves
those:

- **Resolve** — turns the report into a real `Item` (the report's own
  barcode becomes the item's barcode), asking only for what the report
  doesn't already know: name, category, starting quantity.
- **Reject** — no new item; just a reason, which the original reporter
  can see when they check their own submitted reports.
- **Photos are fetched, not linked.** The photo endpoint requires the
  same `Authorization` header as every other API call, and a plain
  `<img src="...">` has no way to attach one. `ReportPhoto.tsx` instead
  fetches the photo as a `Blob` through the authenticated client and
  hands the browser a local `URL.createObjectURL()` pointing at it in
  memory — cleaning the object URL up (`URL.revokeObjectURL`) when the
  component unmounts or the photo changes, so scrolling through a long
  list of reports doesn't leak memory.

## Running it locally

```bash
npm install
cp .env.example .env.local   # VITE_API_BASE_URL, defaults to http://localhost:8000
npm run dev                  # http://localhost:5173
```

Needs the backend (`stocktaker-api`) running separately — see its own
README. The backend's default CORS config already allows
`http://localhost:5173`, Vite's default port.

```bash
npm run build   # type-checks (tsc -b) then bundles with Vite
npm test        # vitest run — or `npx vitest` to watch
npm run lint    # oxlint
```

## What's deliberately out of scope here

- **Barcode photo decode from the dashboard** — the backend exposes
  `POST /items/decode-photo` (used by `NewItemModal` to prefill a
  barcode from an uploaded photo), but live camera scanning belongs on
  the mobile app, not a desktop-oriented office dashboard.
- **Offline support** — the requirements spec calls for the platform to
  be always-online; the dashboard makes no attempt to cache or queue
  requests.
- **Pagination** — list endpoints return everything for a site in one
  response. Fine at prototype scale; the first thing to add before a
  large company's real inventory hits this.

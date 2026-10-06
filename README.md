# Stocktaker

Inventory tracking for warehouses: office staff manage stock from a web
dashboard, and warehouse workers scan barcodes with a phone app.

| Folder | What it is |
|---|---|
| [`stocktaker-api/`](stocktaker-api/) | FastAPI backend: the only thing that touches the database |
| [`stocktaker-web/`](stocktaker-web/) | React dashboard for admins and managers |
| [`stocktaker-mobile/`](stocktaker-mobile/) | Expo (React Native) app for warehouse workers |

In production, the API and dashboard run as **one service at one URL**.
The root [`Dockerfile`](Dockerfile) builds the dashboard into the API's
image: the dashboard is served at `/` and the API at `/api`. The phone app
is an installable Android APK that talks to that same URL.

```
https://stocktaker.onrender.com/        -> web dashboard
https://stocktaker.onrender.com/api/... -> API (also used by the phone app)
https://stocktaker.onrender.com/api/docs -> interactive API docs
```

---

## Deploying (free: Render + Neon)

You'll need free accounts on [GitHub](https://github.com),
[Neon](https://neon.tech), [Render](https://render.com) and
[Expo](https://expo.dev). It takes about 20 minutes the first time.

### 1. Put the code on GitHub

Create an **empty private** repository on GitHub named `stocktaker` (no
README or .gitignore), then from this folder:

```powershell
git remote add origin https://github.com/<your-username>/stocktaker.git
git push -u origin main
```

### 2. Create the database (Neon)

1. Sign in to Neon and click **New Project**. Pick the region nearest you;
   Render's Frankfurt region pairs well with Neon's EU Frankfurt.
2. On the project dashboard, click **Connect** and copy the connection
   string. It looks like
   `postgresql://neondb_owner:...@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require`.

Keep it somewhere safe: it contains the database password.

### 3. Deploy the server (Render)

1. Sign in to Render with your GitHub account.
2. Click **New → Blueprint** and pick the `stocktaker` repository. Render
   reads [`render.yaml`](render.yaml) and asks for two values:
   - `DATABASE_URL`: paste the Neon connection string.
   - `INITIAL_ADMIN_PASSWORD`: choose the password for the `admin` login.
     (`JWT_SECRET` is generated for you.)
3. Click **Apply**. The first build takes 5–10 minutes. When it shows
   **Live**, open the URL Render gives you, e.g.
   `https://stocktaker.onrender.com`.
   **If Render added a suffix** (e.g. `stocktaker-a1b2.onrender.com`),
   note it down: you need it in step 5.
4. Sign in as `admin` with the password from step 2. Then, in the
   dashboard:
   - **Admin → Sites:** create your warehouse.
   - **Categories:** add a few, e.g. Wires or Laptops.
   - **Admin → Users:** create a manager and the workers, each assigned to
     the site.

From now on, every `git push` to `main` redeploys automatically.

### 4. About the free tier

- **The server sleeps after 15 minutes without traffic.** The next
  request wakes it up, which takes about a minute. After that it's fast
  again. Opening the dashboard first thing in the morning is a good way to
  wake it.
- **Neon free** gives 0.5 GB of storage, roughly a few thousand flagged-item
  photos plus all the inventory data. It doesn't expire.
- **To remove the sleep**, upgrade the Render service to the Starter plan
  (about $7/month). Nothing else changes.

### 5. Install the phone app (Android APK)

The APK has the server's URL built in, so it works anywhere with internet.
Your PC doesn't need to be on.

1. If Render gave your service a different URL than
   `stocktaker.onrender.com`, edit
   [`stocktaker-mobile/eas.json`](stocktaker-mobile/eas.json) and set
   `EXPO_PUBLIC_API_BASE_URL` to `https://<your-url>/api`.
2. Build it in Expo's cloud (free):

   ```powershell
   cd stocktaker-mobile
   npx eas-cli@latest login
   npx eas-cli@latest build -p android --profile preview
   ```

   The first time, answer **Yes** when it asks to create the project and
   to generate an Android keystore. The build takes about 10–15 minutes.
3. When it finishes, it prints a link and a QR code. Open it on the phone,
   download the APK and install it. Android will ask you to allow installs
   from your browser.
4. Sign in as one of the workers you created.

To ship a new version of the app, run the same build command and install
the new APK over the old one.

---

## Local development

Each app's README covers this in detail. In short, you need two
terminals:

```powershell
# API: http://localhost:8000 (docs at /docs)
cd stocktaker-api
.\.venv\Scripts\Activate.ps1
uvicorn app.main:app --host 0.0.0.0 --reload

# Dashboard: http://localhost:5173
cd stocktaker-web
npm run dev
```

The phone app runs in Expo Go against your PC (`npx expo start` in
`stocktaker-mobile/`). See [its README](stocktaker-mobile/README.md).

Locally the API serves routes at the root (`/items`, not `/api/items`).
The `/api` prefix only exists in the combined deploy, where
`API_PREFIX=/api` is set by the Dockerfile.

## Checks before pushing

```powershell
cd stocktaker-api; python -m pytest tests -q
cd stocktaker-web; npm run build; npm test; npm run lint
cd stocktaker-mobile; npm run typecheck; npm run lint
```

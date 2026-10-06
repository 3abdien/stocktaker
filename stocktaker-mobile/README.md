# Stocktaker — Mobile App

The warehouse-floor app for the Stocktaker platform: the piece warehouse
workers carry. It talks only to `stocktaker-api`, the same backend the web
dashboard uses, and never to the database directly.

What a worker can do:

- **Scan** a barcode with the phone camera, or type it in when a label is
  damaged.
- **Check stock in or out** for a known item and see the new quantity and
  any low-stock warning.
- **Flag an unknown barcode** for the office, with a required photo and an
  optional note.
- **Track their flagged reports** (waiting, identified, rejected with a
  reason).

Adjusting counts, registering items and resolving reports are not in the
app. The API restricts them to managers and admins, who do them from the
web dashboard.

## Tech stack and why

- **Expo (SDK 57) + React Native + TypeScript.** One codebase covers
  Android and iOS, and it runs in **Expo Go** during development, so no
  Android Studio or Xcode is needed. Every native module used here
  (camera, secure store) ships inside Expo Go.
- **Expo Router.** File-based routing, the Expo default. `src/app/` is the
  route tree.
- **expo-camera (`CameraView`).** Decodes barcodes on the device, so a
  scan needs one API call (the lookup) rather than uploading an image.
  The web dashboard's `/items/decode-photo` exists only because browsers
  can't do this as easily.
- **expo-secure-store.** Stores the refresh token in the Android
  Keystore / iOS Keychain instead of plain storage. Phones get lost.

## Running it

1. Start the API so the phone can reach it. "localhost" on a phone means
   the phone itself, so the API must listen on your network:

   ```bash
   cd ../stocktaker-api
   python seed_data.py                                  # optional demo data
   uvicorn app.main:app --host 0.0.0.0 --reload
   ```

2. Start the app:

   ```bash
   npm install
   npx expo start
   ```

3. Scan the QR code with **Expo Go** (Android) or the Camera app (iOS).
   The phone and the computer must be on the same Wi-Fi network.

4. Sign in as `worker1` / `password123` (from the seed data) and scan or
   type `DELL-5420-STOCK`.

**API address.** In development the app reuses the host of the Expo dev
server it was loaded from, on port 8000. Your computer runs both, so this
usually just works. To point somewhere else, copy `.env.example` to `.env`
and set `EXPO_PUBLIC_API_BASE_URL`. The sign-in and Account screens show
which server the app is using. If you get "Can't reach the server", check
the Windows firewall for port 8000.

## Project layout

```
src/
  app/                          routes (Expo Router)
    _layout.tsx                 AuthProvider + Stack.Protected auth guard
    sign-in.tsx
    (app)/_layout.tsx           signed-in stack: tabs + pushed screens
    (app)/(tabs)/index.tsx      Scan
    (app)/(tabs)/reports.tsx    My reports
    (app)/(tabs)/account.tsx    Account / sign out
    (app)/item/[id].tsx         Item detail: check in / check out
    (app)/flag.tsx              Flag unknown barcode (photo + note)
  api/                          one file per backend router, as in stocktaker-web
  auth/AuthContext.tsx          who's signed in; restores the session at launch
  components/ui.tsx             colour tokens, Button, Field, Card
  types/index.ts                mirrors app/schemas.py (worker subset)
```

The mobile app keeps the same contract conventions as the web app:
`src/api/*.ts` matches `app/routers/*.py`, and `src/types/index.ts`
matches `app/schemas.py`. The three projects share no code; they agree
only on the HTTP contract.

## Design notes

- **One scan, one lookup.** `onBarcodeScanned` fires many times a second
  while a code is in view. A ref-based lock lets the first read through
  and drops the rest. The lock resets when the scanner tab regains focus,
  and the camera is unmounted while the tab is in the background.
- **Session handling** is the same as the web client: the access token
  stays in memory, an expired one is refreshed automatically, and
  concurrent 401s share a single refresh call (refresh tokens are
  single-use because the backend rotates them). If the refresh fails, the
  `Stack.Protected` guard in the root layout sends the user back to
  sign-in.
- **The guards are UX, not security.** A worker's token cannot read
  another site's data whatever the app does. The API enforces that in
  `app/deps.py`.
- **Photos.** The camera captures at quality 0.5, which stays well under
  the API's 8 MB limit. The upload sends a React Native `{uri, name, type}`
  `FormData` part, so the file streams from disk. Report thumbnails load
  through `Image` with an `Authorization` header, which React Native
  supports and a browser `<img>` does not.

## Verification

```bash
npm run typecheck     # tsc --noEmit
npm run lint          # expo lint
npx expo-doctor       # dependency/config health
```

## Not done yet / notes

- **Automated tests.** There's no jest-expo or React Native Testing Library
  setup yet.
- **Offline queueing.** Warehouse Wi-Fi can be patchy. Today a failed
  check-in shows an error, and the worker has to retry.
- **Installable app:** `npx eas-cli@latest build -p android --profile preview`
  builds an APK pointed at the hosted server (the URL is in `eas.json`).
  See the root `README.md`, step 5. Android blocks plain `http://` in
  release builds, so the hosted URL must be `https://`, which Render
  provides.
- **Web.** `expo-secure-store` doesn't work in a browser, and the web
  dashboard already covers that platform.

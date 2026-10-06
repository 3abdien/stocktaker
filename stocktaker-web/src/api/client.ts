// The API client: every network call in this app funnels through here.
//
// Centralizing this in one file (instead of calling `fetch` from inside
// components) buys us three things every page gets for free:
//   1. The access token is attached automatically - no page has to know
//      it exists.
//   2. An expired access token is refreshed automatically, and the failed
//      request is retried once, transparently.
//   3. Errors come back as one consistent `ApiError` type, so every page
//      can catch the same thing instead of reinventing error parsing.
//
// This mirrors the backend's own layering: routers/*.py don't talk to the
// database directly, they go through services.py. Same idea here - pages
// don't talk to fetch() directly, they go through this file.

import type { TokenPair } from '../types'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------
//
// The access token lives ONLY in memory (a module-level variable). It's
// short-lived (30 min - see the backend's ACCESS_TOKEN_EXPIRE_MINUTES) and
// never written to disk, so a page refresh loses it - that's deliberate:
// it shrinks the window in which a cross-site-scripting bug could steal a
// usable token. The longer-lived refresh token goes in localStorage so a
// page refresh doesn't force a full re-login; losing that to an XSS bug is
// a real risk this design accepts in exchange for simplicity. The
// backend's refresh-token rotation (see stocktaker-api README) limits the
// damage if that trade-off ever bites: a stolen refresh token stops
// working the moment the legitimate client uses it next.

let accessToken: string | null = null

const REFRESH_TOKEN_KEY = 'stocktaker_refresh_token'

export function getAccessToken(): string | null {
  return accessToken
}

export function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY)
}

export function setTokens(tokens: TokenPair): void {
  accessToken = tokens.access_token
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token)
}

export function clearTokens(): void {
  accessToken = null
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

// AuthContext registers a callback here so the client can force a
// redirect-to-login whenever a refresh attempt fails - the one place that
// truly knows "this session is over" is this file (it's the one making
// the refresh call), but only AuthContext/the router should decide what
// the UI does about it. This callback is how that decision crosses the
// boundary without client.ts importing React Router.
let onSessionExpired: (() => void) | null = null

export function setOnSessionExpired(callback: () => void): void {
  onSessionExpired = callback
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

async function readErrorDetail(res: Response): Promise<string> {
  // FastAPI's default error shape is {"detail": "..."}; fall back to the
  // HTTP status text if the body isn't JSON (e.g. a proxy's error page).
  try {
    const body = await res.json()
    return typeof body.detail === 'string' ? body.detail : res.statusText
  } catch {
    return res.statusText
  }
}

// ---------------------------------------------------------------------------
// Refresh - deduplicated so concurrent 401s only trigger one network call
// ---------------------------------------------------------------------------
//
// If a page fires five requests at once and the access token has expired,
// all five come back 401 at roughly the same time. Without this dedup,
// each would independently call /auth/refresh - and since the backend
// rotates refresh tokens (each one is single-use), the second refresh call
// would arrive with an already-spent token and fail. Stashing the *in-
// flight promise* (not just a boolean flag) means every caller that asks
// "is a refresh happening?" while one is already running gets handed the
// same promise and simply waits for its result, rather than starting a
// second one.

let refreshInFlight: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  const refresh_token = getRefreshToken()
  if (!refresh_token) return false

  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token }),
    })
    if (!res.ok) return false

    const tokens: TokenPair = await res.json()
    setTokens(tokens)
    return true
  } catch {
    // Network error - treat the same as a failed refresh.
    return false
  }
}

function ensureFreshAccessToken(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null
    })
  }
  return refreshInFlight
}

// ---------------------------------------------------------------------------
// The actual request functions pages call
// ---------------------------------------------------------------------------

function buildHeaders(options: RequestInit): Headers {
  const headers = new Headers(options.headers)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  // FormData sets its own multipart Content-Type (with the boundary) -
  // setting one ourselves would break the upload, so only default to JSON
  // when the caller isn't sending FormData and hasn't set one already.
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return headers
}

async function rawFetch(path: string, options: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, { ...options, headers: buildHeaders(options) })
}

/** Runs one request; on a 401, refreshes the token once and retries once. */
async function fetchWithRefresh(path: string, options: RequestInit): Promise<Response> {
  let res = await rawFetch(path, options)

  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await ensureFreshAccessToken()
    if (refreshed) {
      res = await rawFetch(path, options)
    }
  }

  if (res.status === 401) {
    // Either there was no refresh token, or the refresh itself failed
    // (expired/revoked) - the session is genuinely over.
    clearTokens()
    onSessionExpired?.()
  }

  return res
}

/** For JSON endpoints - the vast majority of the API. */
export async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetchWithRefresh(path, options)

  if (!res.ok) {
    throw new ApiError(res.status, await readErrorDetail(res))
  }
  if (res.status === 204) {
    return undefined as T
  }
  return res.json() as Promise<T>
}

/** For the CSV export endpoints, which return a file rather than JSON. */
export async function apiRequestBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  const res = await fetchWithRefresh(path, options)
  if (!res.ok) {
    throw new ApiError(res.status, await readErrorDetail(res))
  }
  return res.blob()
}

/** Builds the URL for an authenticated image (a flagged-item photo).
 *  <img src> can't attach an Authorization header, so pages fetch the
 *  photo as a blob via apiRequestBlob and turn it into an object URL -
 *  see ReportsPage for the pattern. This helper just keeps the path
 *  construction in one place. */
export function photoPath(storedName: string): string {
  return `/photos/${storedName}`
}

export { BASE_URL }

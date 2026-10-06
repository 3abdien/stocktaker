// The API client: every network call in the app goes through here. Same
// design as stocktaker-web/src/api/client.ts - token attached automatically,
// an expired access token refreshed once and the request retried, errors
// surfaced as one ApiError type - with two mobile-specific differences:
//
//   1. The refresh token lives in the OS keychain/keystore (expo-secure-store)
//      instead of localStorage. A phone gets lost; the keystore is encrypted
//      at rest and not readable by other apps.
//   2. The base URL can't default to localhost - on a phone, "localhost" is
//      the phone. See resolveBaseUrl() below.

import Constants from 'expo-constants'
import * as SecureStore from 'expo-secure-store'
import type { TokenPair } from '../types'

// ---------------------------------------------------------------------------
// Base URL
// ---------------------------------------------------------------------------

function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_API_BASE_URL
  if (configured) return configured.replace(/\/+$/, '')

  // In development the app is loaded from the Expo dev server running on
  // your computer (hostUri looks like "192.168.1.50:8081"). The API almost
  // certainly runs on that same computer, so reuse its host on port 8000.
  const hostUri = Constants.expoConfig?.hostUri
  const host = hostUri?.split(':')[0]
  if (host) return `http://${host}:8000`

  return 'http://localhost:8000'
}

export const BASE_URL = resolveBaseUrl()

// ---------------------------------------------------------------------------
// Token storage
// ---------------------------------------------------------------------------
//
// The access token is short-lived and kept only in memory. The refresh
// token is persisted so the worker stays signed in between app launches;
// a cached copy in memory saves a keystore round-trip on every request.

const REFRESH_TOKEN_KEY = 'stocktaker_refresh_token'

let accessToken: string | null = null
let refreshToken: string | null = null

export function getAccessToken(): string | null {
  return accessToken
}

export function getRefreshToken(): string | null {
  return refreshToken
}

/** Loads the persisted refresh token into memory. Call once at startup. */
export async function loadStoredRefreshToken(): Promise<string | null> {
  refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_KEY)
  return refreshToken
}

export async function setTokens(tokens: TokenPair): Promise<void> {
  accessToken = tokens.access_token
  refreshToken = tokens.refresh_token
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refresh_token)
}

export async function clearTokens(): Promise<void> {
  accessToken = null
  refreshToken = null
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY)
}

// AuthContext registers this so the client can end the session (which
// sends the user back to sign-in) without importing any UI code.
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
  try {
    const body = await res.json()
    return typeof body.detail === 'string' ? body.detail : `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

/** Turns any thrown value into a message fit for an Alert or error label. */
export function errorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message
  if (err instanceof TypeError) {
    // fetch() throws TypeError when the server is unreachable - by far the
    // most common failure on a phone (wrong IP, API not bound to 0.0.0.0,
    // warehouse Wi-Fi dropped).
    return `Can't reach the server at ${BASE_URL}. Check your connection.`
  }
  return err instanceof Error ? err.message : 'Something went wrong.'
}

// ---------------------------------------------------------------------------
// Refresh - deduplicated so concurrent 401s only trigger one network call
// ---------------------------------------------------------------------------
//
// Refresh tokens are single-use (the backend rotates them), so two
// parallel refreshes would make the second fail. Sharing the in-flight
// promise makes every concurrent caller wait on the same refresh.

let refreshInFlight: Promise<boolean> | null = null

async function refreshAccessToken(): Promise<boolean> {
  if (!refreshToken) return false
  try {
    const res = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    })
    if (!res.ok) return false
    await setTokens(await res.json())
    return true
  } catch {
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
// Requests
// ---------------------------------------------------------------------------

function buildHeaders(options: RequestInit): Headers {
  const headers = new Headers(options.headers)
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)
  // FormData must set its own multipart Content-Type (with the boundary).
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  return headers
}

function rawFetch(path: string, options: RequestInit): Promise<Response> {
  return fetch(`${BASE_URL}${path}`, { ...options, headers: buildHeaders(options) })
}

/** Runs one request; on a 401, refreshes the token once and retries once. */
async function fetchWithRefresh(path: string, options: RequestInit): Promise<Response> {
  let res = await rawFetch(path, options)

  if (res.status === 401 && refreshToken) {
    if (await ensureFreshAccessToken()) {
      res = await rawFetch(path, options)
    }
  }

  if (res.status === 401) {
    await clearTokens()
    onSessionExpired?.()
  }

  return res
}

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

export function toQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return ''
  const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))
  return `?${search.toString()}`
}

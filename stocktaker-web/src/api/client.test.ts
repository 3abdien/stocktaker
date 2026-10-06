// Covers the one piece of this app that's genuinely tricky to get right by
// eye: the token-refresh interceptor in client.ts. Three behaviours matter
// enough to pin down with a test rather than "it looked fine in the
// browser":
//   1. A 401 triggers exactly one refresh call, then retries the original
//      request with the new token.
//   2. Several requests failing with 401 at the same time share ONE
//      refresh call (see the `refreshInFlight` comment in client.ts) -
//      firing two refresh calls would burn the single-use refresh token
//      twice and log the user out for no reason.
//   3. A refresh that itself fails (expired/revoked refresh token) clears
//      stored tokens and notifies AuthContext that the session is over.
//
// `client.ts` keeps its access token in a module-level variable, so each
// test re-imports it fresh via `vi.resetModules()` + dynamic `import()` -
// otherwise state (and any pending refreshInFlight promise) would leak
// between tests.

import { beforeEach, describe, expect, it, vi } from 'vitest'

const REFRESH_KEY = 'stocktaker_refresh_token'

async function freshClient() {
  vi.resetModules()
  return import('./client')
}

beforeEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

describe('apiRequest - token refresh', () => {
  it('refreshes once on a 401 and retries the original request', async () => {
    const client = await freshClient()
    localStorage.setItem(REFRESH_KEY, 'old-refresh-token')

    const fetchMock = vi
      .fn()
      // 1st call: the original request, rejected as unauthorized.
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      // 2nd call: POST /auth/refresh succeeds with a new token pair.
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'bearer' }), {
          status: 200,
        }),
      )
      // 3rd call: the retried original request, now succeeding.
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await client.apiRequest<{ ok: boolean }>('/items')

    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock.mock.calls[1][0]).toContain('/auth/refresh')
    // The retried request must carry the NEW access token, not the old
    // (missing) one.
    const retryHeaders = fetchMock.mock.calls[2][1].headers as Headers
    expect(retryHeaders.get('Authorization')).toBe('Bearer new-access')
    // The new refresh token replaces the old one in storage.
    expect(localStorage.getItem(REFRESH_KEY)).toBe('new-refresh')
  })

  it('deduplicates concurrent refreshes into a single network call', async () => {
    const client = await freshClient()
    localStorage.setItem(REFRESH_KEY, 'old-refresh-token')

    let refreshCalls = 0
    const fetchMock = vi.fn((url: string) => {
      if (typeof url === 'string' && url.includes('/auth/refresh')) {
        refreshCalls += 1
        return Promise.resolve(
          new Response(JSON.stringify({ access_token: 'new-access', refresh_token: 'new-refresh', token_type: 'bearer' }), {
            status: 200,
          }),
        )
      }
      // Every non-refresh call starts out 401'ing until a token exists,
      // then succeeds - simulating several components firing requests at
      // once while the access token is expired.
      const hasToken = client.getAccessToken() !== null
      return Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: hasToken ? 200 : 401 }))
    })
    vi.stubGlobal('fetch', fetchMock)

    // Three "pages" all making a request at the same moment.
    const results = await Promise.all([
      client.apiRequest('/items'),
      client.apiRequest('/categories'),
      client.apiRequest('/reports/unidentified'),
    ])

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    expect(refreshCalls).toBe(1)
  })

  it('clears tokens and signals session-expired when refresh itself fails', async () => {
    const client = await freshClient()
    localStorage.setItem(REFRESH_KEY, 'expired-refresh-token')

    const onExpired = vi.fn()
    client.setOnSessionExpired(onExpired)

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // original request
      .mockResolvedValueOnce(new Response(null, { status: 401 })) // refresh itself rejected
    vi.stubGlobal('fetch', fetchMock)

    await expect(client.apiRequest('/items')).rejects.toThrow(client.ApiError)

    expect(onExpired).toHaveBeenCalledTimes(1)
    expect(localStorage.getItem(REFRESH_KEY)).toBeNull()
    expect(client.getAccessToken()).toBeNull()
  })

  it('does not attempt a refresh when there is no refresh token at all', async () => {
    const client = await freshClient()
    // No refresh token in localStorage - a logged-out request.

    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(client.apiRequest('/items')).rejects.toThrow(client.ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1) // no refresh call was made
  })
})

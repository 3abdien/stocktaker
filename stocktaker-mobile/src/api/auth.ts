// Mirrors stocktaker-api/app/routers/auth.py
import { apiRequest, clearTokens, getRefreshToken, setTokens } from './client'
import type { TokenPair } from '../types'

export async function login(username: string, password: string): Promise<void> {
  const tokens = await apiRequest<TokenPair>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  await setTokens(tokens)
}

/** Revokes the refresh token server-side, then forgets it locally. The
 *  local clear happens even if the server call fails (e.g. offline) - the
 *  worker asked to sign out, so this device must not stay signed in. */
export async function logout(): Promise<void> {
  const refresh_token = getRefreshToken()
  try {
    if (refresh_token) {
      await apiRequest<void>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token }),
      })
    }
  } finally {
    await clearTokens()
  }
}

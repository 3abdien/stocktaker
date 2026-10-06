// Mirrors stocktaker-api/app/routers/auth.py
import { apiRequest, setTokens, clearTokens } from './client'
import type { TokenPair } from '../types'

export async function login(username: string, password: string): Promise<TokenPair> {
  const tokens = await apiRequest<TokenPair>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  })
  setTokens(tokens)
  return tokens
}

export async function logout(refreshToken: string | null): Promise<void> {
  if (refreshToken) {
    // Best-effort: even if this call fails (e.g. we're already offline),
    // we still clear local tokens below so the UI logs the user out.
    try {
      await apiRequest('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      })
    } catch {
      // Ignore - see comment above.
    }
  }
  clearTokens()
}

// AuthContext is the single source of truth for "who is signed in right
// now" - every component that needs the current user (the nav bar, a
// role-gated page, a "signed in as..." label) reads it from here via
// `useAuth()` instead of each fetching its own copy.
//
// It also owns the trickiest bit of state in the whole app: what happens
// on a page refresh. The access token lives only in memory (see
// client.ts), so a refresh wipes it - but the user shouldn't have to log
// in again every time they hit F5. The fix is the `bootstrap` effect
// below: on mount, if a refresh token is sitting in localStorage, we
// silently exchange it for a new access token and fetch the user's
// profile, before rendering any page that needs auth. Until that finishes,
// we render nothing (a full-page loading state) rather than "logged out"
// UI, so no page ever briefly flashes a login screen it shouldn't.

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import * as authApi from '../api/auth'
import { getMe } from '../api/users'
import { getRefreshToken, setOnSessionExpired } from '../api/client'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  // Starts true: we don't know yet whether there's a valid session until
  // the bootstrap effect below finishes.
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // If client.ts ever decides the session is over (a refresh attempt
    // failed - the refresh token expired or was revoked), it calls this.
    // Clearing `user` here is what makes ProtectedRoute redirect to
    // /login on the next render.
    setOnSessionExpired(() => setUser(null))

    async function bootstrap() {
      if (!getRefreshToken()) {
        setIsLoading(false)
        return
      }
      try {
        // We don't have an access token yet on a fresh page load, but
        // `getMe()` will 401, and the client's refresh-and-retry logic
        // (see client.ts) will silently trade the stored refresh token
        // for a new access token before retrying - so this single call
        // both re-authenticates us AND fetches the profile.
        const me = await getMe()
        setUser(me)
      } catch {
        // Refresh token was invalid/expired - nothing to restore.
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    bootstrap()
  }, [])

  const login = useCallback(async (username: string, password: string) => {
    await authApi.login(username, password)
    const me = await getMe()
    setUser(me)
  }, [])

  const logout = useCallback(async () => {
    await authApi.logout(getRefreshToken())
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>')
  return ctx
}

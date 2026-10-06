// Who is signed in, for the whole app. Mirrors stocktaker-web's
// AuthContext, including the startup bootstrap: if a refresh token is in
// the keystore from a previous launch, trade it for a session before
// showing any screen, so a worker reopening the app lands on the scanner
// instead of a sign-in screen it then has to skip past.

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import * as authApi from '../api/auth'
import { getMe } from '../api/users'
import { loadStoredRefreshToken, setOnSessionExpired } from '../api/client'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  isLoading: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setOnSessionExpired(() => setUser(null))

    async function bootstrap() {
      try {
        if (!(await loadStoredRefreshToken())) return
        // No access token yet, so this 401s and the client silently
        // refreshes and retries - re-authenticating and fetching the
        // profile in one call.
        setUser(await getMe())
      } catch {
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    bootstrap()
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    await authApi.login(username, password)
    setUser(await getMe())
  }, [])

  const signOut = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      setUser(null)
    }
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth() must be used inside <AuthProvider>')
  return ctx
}

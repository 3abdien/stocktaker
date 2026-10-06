// Root layout. Stack.Protected is Expo Router's auth guard: while `user`
// is null the (app) screens don't exist in the navigator at all, so a
// deep link can't open the scanner without a session - and when the
// session ends (sign-out, or a failed token refresh) the router moves to
// sign-in automatically. Like the web app's ProtectedRoute, this is a UX
// guard; the API enforces the real rules.

import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from '../auth/AuthContext'
import { CenteredSpinner } from '../components/ui'

function RootNavigator() {
  const { user, isLoading } = useAuth()

  if (isLoading) return <CenteredSpinner />

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  )
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  )
}

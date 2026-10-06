// Signed-in area: the tab bar, plus the screens a scan leads to (item
// detail, flag-for-review) pushed on top of it so "back" returns to the
// scanner.

import { Stack } from 'expo-router'
import { colors } from '../../components/ui'

export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerTintColor: colors.accent, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="item/[id]" options={{ title: 'Item' }} />
      <Stack.Screen name="flag" options={{ title: 'Flag unknown item' }} />
    </Stack>
  )
}

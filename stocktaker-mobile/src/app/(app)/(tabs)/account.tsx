import { useEffect, useState } from 'react'
import { Alert, ScrollView, Text, View } from 'react-native'
import { useAuth } from '../../../auth/AuthContext'
import { listSites } from '../../../api/sites'
import { BASE_URL } from '../../../api/client'
import { Button, Card, styles } from '../../../components/ui'

const ROLE_LABEL = { admin: 'Administrator', manager: 'Site manager', worker: 'Warehouse worker' } as const

export default function AccountScreen() {
  const { user, signOut } = useAuth()
  const [siteName, setSiteName] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    if (user?.site_id == null) return
    listSites()
      .then((sites) => setSiteName(sites.find((s) => s.id === user.site_id)?.name ?? null))
      .catch(() => setSiteName(null))
  }, [user?.site_id])

  if (!user) return null

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need your password to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true)
          await signOut()
        },
      },
    ])
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card>
        <Text style={styles.title}>{user.full_name || user.username}</Text>
        <Text style={styles.subtitle}>@{user.username}</Text>
        <View style={{ marginTop: 8, gap: 4 }}>
          <Text style={styles.body}>{ROLE_LABEL[user.role]}</Text>
          <Text style={styles.body}>
            {user.site_id == null ? 'All sites' : `Site: ${siteName ?? `#${user.site_id}`}`}
          </Text>
        </View>
      </Card>

      <Button title="Sign out" variant="danger" onPress={confirmSignOut} loading={signingOut} />

      <Text style={[styles.subtitle, { fontSize: 12, textAlign: 'center' }]}>Server: {BASE_URL}</Text>
    </ScrollView>
  )
}

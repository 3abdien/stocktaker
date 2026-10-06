// The worker's own flagged items and what the office did with them -
// closes the loop so a worker knows whether that mystery box got
// identified (and can now be scanned) or was rejected, and why.

import { useCallback, useState } from 'react'
import { FlatList, Image, RefreshControl, Text, View } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { myReports, photoUrlPath } from '../../../api/reports'
import { BASE_URL, errorMessage, getAccessToken } from '../../../api/client'
import { Card, CenteredSpinner, ErrorText, colors, styles } from '../../../components/ui'
import type { ReportStatus, UnidentifiedReport } from '../../../types'

const STATUS_STYLE: Record<ReportStatus, { label: string; fg: string; bg: string }> = {
  pending: { label: 'Waiting for office', fg: colors.warning, bg: colors.warningBg },
  resolved: { label: 'Identified', fg: colors.success, bg: '#dafbe1' },
  rejected: { label: 'Rejected', fg: colors.danger, bg: '#ffebe9' },
}

export default function MyReportsScreen() {
  const [reports, setReports] = useState<UnidentifiedReport[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      setReports(await myReports())
    } catch (err) {
      setError(errorMessage(err))
    }
  }, [])

  // Reload whenever the tab is opened, so a report sent a moment ago (or
  // resolved by the office since) shows up without pulling to refresh.
  useFocusEffect(
    useCallback(() => {
      load()
    }, [load]),
  )

  async function onRefresh() {
    setRefreshing(true)
    await load()
    setRefreshing(false)
  }

  if (reports === null && !error) return <CenteredSpinner />

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={[styles.content, { flexGrow: 1 }]}
      data={reports ?? []}
      keyExtractor={(r) => String(r.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={<ErrorText message={error} />}
      ListEmptyComponent={
        error ? null : (
          <View style={styles.centered}>
            <Text style={[styles.subtitle, { textAlign: 'center' }]}>
              Nothing flagged yet. When you scan a barcode nobody recognises, you can send it to the office from the
              scanner.
            </Text>
          </View>
        )
      }
      renderItem={({ item }) => <ReportRow report={item} />}
    />
  )
}

function ReportRow({ report }: { report: UnidentifiedReport }) {
  const status = STATUS_STYLE[report.status]
  const token = getAccessToken()
  return (
    <Card style={{ flexDirection: 'row', gap: 12 }}>
      {/* Photos are access-controlled, so the token goes in a header -
          React Native's Image supports that, unlike a browser <img>. */}
      <Image
        source={{
          uri: `${BASE_URL}${photoUrlPath(report.photo_path)}`,
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        }}
        style={{ width: 72, height: 72, borderRadius: 8, backgroundColor: colors.border }}
        accessibilityIgnoresInvertColors
      />
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={[styles.body, { fontWeight: '600' }]} numberOfLines={1}>
          {report.barcode}
        </Text>
        <Text style={styles.subtitle}>{new Date(report.reported_at).toLocaleString()}</Text>
        <View style={{ alignSelf: 'flex-start', backgroundColor: status.bg, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ color: status.fg, fontWeight: '600', fontSize: 13 }}>{status.label}</Text>
        </View>
        {report.status === 'rejected' && report.rejection_reason ? (
          <Text style={styles.subtitle}>Reason: {report.rejection_reason}</Text>
        ) : null}
        {report.note ? <Text style={styles.subtitle} numberOfLines={2}>Note: {report.note}</Text> : null}
      </View>
    </Card>
  )
}

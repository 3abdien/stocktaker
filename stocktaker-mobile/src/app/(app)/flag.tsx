// Flag an unknown barcode for the office to identify. The API requires a
// photo - the office can't categorise "a box with barcode X" without
// seeing it - so the flow is: take photo -> optional note -> send.
//
// Workers and managers always report against their own site. Admins have
// no home site, so they pick one; the API checks access either way.

import { useEffect, useRef, useState } from 'react'
import { Alert, Image, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { router, useLocalSearchParams } from 'expo-router'
import { useAuth } from '../../auth/AuthContext'
import { flagUnidentifiedItem } from '../../api/reports'
import { listSites } from '../../api/sites'
import { errorMessage } from '../../api/client'
import { Button, Card, CenteredSpinner, ErrorText, Field, colors, styles } from '../../components/ui'
import type { Site } from '../../types'

export default function FlagScreen() {
  const { barcode } = useLocalSearchParams<{ barcode: string }>()
  const { user } = useAuth()
  const [permission, requestPermission] = useCameraPermissions()
  const cameraRef = useRef<CameraView>(null)

  const [photoUri, setPhotoUri] = useState<string | null>(null)
  const [capturing, setCapturing] = useState(false)
  const [note, setNote] = useState('')
  const [sites, setSites] = useState<Site[] | null>(null)
  const [siteId, setSiteId] = useState<number | null>(user?.site_id ?? null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const needsSitePicker = user?.site_id == null

  useEffect(() => {
    if (!needsSitePicker) return
    listSites()
      .then((list) => {
        setSites(list)
        if (list.length === 1) setSiteId(list[0].id)
      })
      .catch((err) => setError(errorMessage(err)))
  }, [needsSitePicker])

  async function takePhoto() {
    if (!cameraRef.current) return
    setCapturing(true)
    try {
      // Quality 0.5 keeps a typical phone photo well under the API's 8 MB
      // limit while staying sharp enough to read a label.
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.5 })
      setPhotoUri(photo.uri)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setCapturing(false)
    }
  }

  async function submit() {
    if (!photoUri || siteId == null || !barcode) return
    setSubmitting(true)
    setError(null)
    try {
      await flagUnidentifiedItem({ barcode, siteId, note: note.trim(), photoUri })
      Alert.alert('Sent for review', 'The office will identify this item. Track it under My reports.')
      router.back()
    } catch (err) {
      setError(errorMessage(err))
      setSubmitting(false)
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.label}>Barcode</Text>
          <Text style={[styles.title, { fontSize: 20 }]} selectable>
            {barcode}
          </Text>
        </Card>

        <View style={{ height: 360, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
          {photoUri ? (
            <Image source={{ uri: photoUri }} style={{ flex: 1 }} resizeMode="cover" accessibilityLabel="Captured photo" />
          ) : !permission ? (
            <CenteredSpinner />
          ) : !permission.granted ? (
            <View style={[styles.centered, { gap: 12 }]}>
              <Text style={[styles.body, { textAlign: 'center' }]}>A photo is required to flag an item.</Text>
              {permission.canAskAgain ? (
                <Button title="Allow camera" onPress={requestPermission} />
              ) : (
                <Button title="Open settings" onPress={() => Linking.openSettings()} />
              )}
            </View>
          ) : (
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
          )}
        </View>

        {photoUri ? (
          <Button title="Retake photo" variant="secondary" onPress={() => setPhotoUri(null)} disabled={submitting} />
        ) : (
          <Button
            title="Take photo"
            onPress={takePhoto}
            loading={capturing}
            disabled={!permission?.granted}
          />
        )}

        {needsSitePicker && (
          <Card>
            <Text style={styles.label}>Site</Text>
            {sites === null ? (
              <CenteredSpinner />
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {sites.map((site) => (
                  <Pressable
                    key={site.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: site.id === siteId }}
                    onPress={() => setSiteId(site.id)}
                    style={{
                      paddingVertical: 10,
                      paddingHorizontal: 14,
                      borderRadius: 20,
                      borderWidth: 1,
                      borderColor: site.id === siteId ? colors.accent : colors.border,
                      backgroundColor: site.id === siteId ? colors.accent : colors.surface,
                    }}
                  >
                    <Text style={{ color: site.id === siteId ? '#fff' : colors.text, fontSize: 15 }}>{site.name}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </Card>
        )}

        <Field
          label="Note (optional)"
          value={note}
          onChangeText={setNote}
          placeholder="Where you found it, what it looks like…"
          multiline
          style={{ minHeight: 80, textAlignVertical: 'top' }}
        />

        <ErrorText message={error} />
        <Button
          title="Send for review"
          onPress={submit}
          loading={submitting}
          disabled={!photoUri || siteId == null}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

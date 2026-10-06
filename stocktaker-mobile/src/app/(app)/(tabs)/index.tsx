// The scanner - the screen a worker spends almost all their time on.
//
// Scan (or type) a barcode -> look it up -> known item: open it to check
// stock in/out; unknown: offer to flag it for the office with a photo.
//
// Two details matter on a real device:
//   - The camera fires onBarcodeScanned many times a second while a code
//     is in view. `lockedRef` makes the first read win; it's a ref, not
//     state, because state updates are async and several reads can land
//     before a re-render.
//   - The camera is only mounted while this tab is focused, so it isn't
//     running (and draining battery) behind the item screen, and the lock
//     resets when the worker comes back to scan the next thing.

import { useCallback, useRef, useState } from 'react'
import { Alert, KeyboardAvoidingView, Linking, Platform, ScrollView, Text, View } from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import type { BarcodeScanningResult, BarcodeType, PermissionResponse } from 'expo-camera'
import { router, useFocusEffect } from 'expo-router'
import { findItemByBarcode } from '../../../api/items'
import { errorMessage } from '../../../api/client'
import { Button, Card, CenteredSpinner, Field, colors, styles } from '../../../components/ui'

const BARCODE_TYPES: BarcodeType[] = [
  'qr', 'code128', 'code39', 'code93', 'ean13', 'ean8', 'upc_a', 'upc_e', 'itf14', 'codabar', 'datamatrix', 'pdf417',
]

export default function ScanScreen() {
  const [permission, requestPermission] = useCameraPermissions()
  const [focused, setFocused] = useState(false)
  const [looking, setLooking] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const lockedRef = useRef(false)

  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      lockedRef.current = false
      return () => setFocused(false)
    }, []),
  )

  const lookUp = useCallback(async (raw: string) => {
    const barcode = raw.trim()
    if (!barcode || lockedRef.current) return
    lockedRef.current = true
    setLooking(true)

    const unlock = () => {
      lockedRef.current = false
    }

    try {
      const item = await findItemByBarcode(barcode)
      if (item) {
        setManualCode('')
        router.push({ pathname: '/item/[id]', params: { id: String(item.id) } })
        return // stays locked until this tab regains focus
      }
      Alert.alert(
        'Unknown barcode',
        `"${barcode}" isn't registered at your site.`,
        [
          { text: 'Scan again', style: 'cancel', onPress: unlock },
          {
            text: 'Flag for review',
            onPress: () => {
              setManualCode('')
              router.push({ pathname: '/flag', params: { barcode } })
            },
          },
        ],
        { cancelable: false },
      )
    } catch (err) {
      Alert.alert('Lookup failed', errorMessage(err), [{ text: 'OK', onPress: unlock }])
    } finally {
      setLooking(false)
    }
  }, [])

  const handleScanned = useCallback(
    (result: BarcodeScanningResult) => {
      lookUp(result.data)
    },
    [lookUp],
  )

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ height: 320, borderRadius: 12, overflow: 'hidden', backgroundColor: '#000' }}>
          <CameraArea
            permission={permission}
            requestPermission={requestPermission}
            active={focused}
            onScanned={handleScanned}
          />
          {looking && (
            <View
              style={{
                position: 'absolute', top: 0, right: 0, bottom: 0, left: 0,
                alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.45)',
              }}
            >
              <Text style={{ color: '#fff', fontSize: 17, fontWeight: '600' }}>Looking up…</Text>
            </View>
          )}
        </View>

        <Card>
          <Text style={styles.subtitle}>Label damaged or no camera? Type the code instead.</Text>
          <Field
            label="Barcode"
            value={manualCode}
            onChangeText={setManualCode}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="search"
            onSubmitEditing={() => lookUp(manualCode)}
          />
          <Button title="Look up" onPress={() => lookUp(manualCode)} disabled={!manualCode.trim() || looking} />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function CameraArea({
  permission,
  requestPermission,
  active,
  onScanned,
}: {
  permission: PermissionResponse | null
  requestPermission: () => Promise<PermissionResponse>
  active: boolean
  onScanned: (result: BarcodeScanningResult) => void
}) {
  if (!permission) return <CenteredSpinner />

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { gap: 12 }]}>
        <Text style={[styles.body, { textAlign: 'center' }]}>Camera access is needed to scan barcodes.</Text>
        {permission.canAskAgain ? (
          <Button title="Allow camera" onPress={requestPermission} />
        ) : (
          <Button title="Open settings" onPress={() => Linking.openSettings()} />
        )}
      </View>
    )
  }

  if (!active) return null

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: BARCODE_TYPES }}
        onBarcodeScanned={onScanned}
      />
      <View
        pointerEvents="none"
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' }}
      >
        <View style={{ width: '75%', height: 140, borderWidth: 3, borderColor: colors.surface, borderRadius: 12, opacity: 0.8 }} />
        <Text style={{ color: '#fff', marginTop: 12, fontSize: 15 }}>Point at a barcode</Text>
      </View>
    </View>
  )
}

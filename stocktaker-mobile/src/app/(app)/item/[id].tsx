// A scanned item: current stock, and check in / check out. Adjusting a
// count is deliberately absent - the API restricts that to managers and
// admins, and the office does recounts from the web dashboard.

import { useCallback, useEffect, useState } from 'react'
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { Stack, router, useLocalSearchParams } from 'expo-router'
import { checkIn, checkOut, getItem } from '../../../api/items'
import { errorMessage } from '../../../api/client'
import { Button, Card, CenteredSpinner, ErrorText, Field, colors, styles } from '../../../components/ui'
import type { Item, Transaction } from '../../../types'

function formatQty(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2)
}

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const itemId = Number(id)

  const [item, setItem] = useState<Item | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [quantity, setQuantity] = useState('1')
  const [note, setNote] = useState('')
  const [pending, setPending] = useState<'in' | 'out' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [lastTxn, setLastTxn] = useState<Transaction | null>(null)

  const load = useCallback(async () => {
    try {
      setItem(await getItem(itemId))
      setLoadError(null)
    } catch (err) {
      setLoadError(errorMessage(err))
    }
  }, [itemId])

  useEffect(() => {
    let cancelled = false
    getItem(itemId)
      .then((loaded) => !cancelled && setItem(loaded))
      .catch((err) => !cancelled && setLoadError(errorMessage(err)))
    return () => {
      cancelled = true
    }
  }, [itemId])

  async function submit(direction: 'in' | 'out') {
    // Accept a comma as decimal separator too - many locales' keypads use it.
    const qty = Number(quantity.replace(',', '.'))
    if (!Number.isFinite(qty) || qty <= 0) {
      setActionError('Enter a quantity greater than zero.')
      return
    }
    setPending(direction)
    setActionError(null)
    try {
      const body = { quantity: qty, note: note.trim() }
      const txn = direction === 'in' ? await checkIn(itemId, body) : await checkOut(itemId, body)
      setLastTxn(txn)
      setNote('')
      setQuantity('1')
      await load() // refresh quantity and low-stock flag from the server
    } catch (err) {
      setActionError(errorMessage(err))
    } finally {
      setPending(null)
    }
  }

  if (loadError && !item) {
    return (
      <View style={[styles.centered, { gap: 12 }]}>
        <ErrorText message={loadError} />
        <Button title="Try again" onPress={load} />
      </View>
    )
  }
  if (!item) return <CenteredSpinner />

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: item.name }} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={styles.title}>{item.name}</Text>
          <Text style={styles.subtitle}>Barcode {item.barcode}</Text>
          {item.location ? <Text style={styles.subtitle}>Location: {item.location}</Text> : null}

          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 8 }}>
            <Text style={{ fontSize: 40, fontWeight: '700', color: colors.text }}>{formatQty(item.quantity)}</Text>
            <Text style={styles.body}>{item.unit} in stock</Text>
          </View>

          {item.is_low_stock && (
            <View style={{ backgroundColor: colors.warningBg, borderRadius: 8, padding: 10 }}>
              <Text style={{ color: colors.warning, fontWeight: '600' }}>
                Low stock (minimum {formatQty(item.min_stock)} {item.unit})
              </Text>
            </View>
          )}
        </Card>

        {lastTxn && (
          <Card style={{ borderColor: colors.success }}>
            <Text style={{ color: colors.success, fontWeight: '600', fontSize: 16 }}>
              {lastTxn.type === 'check_in' ? 'Checked in' : 'Checked out'} {formatQty(Math.abs(lastTxn.quantity_delta))}{' '}
              {item.unit} - now {formatQty(lastTxn.resulting_quantity)}
            </Text>
          </Card>
        )}

        <Card>
          <Field
            label={`Quantity (${item.unit})`}
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
          <Field label="Note (optional)" value={note} onChangeText={setNote} placeholder="e.g. delivery ref, job number" />
          <ErrorText message={actionError} />
          <View style={styles.row}>
            <Button
              title="Check in"
              variant="success"
              style={{ flex: 1 }}
              onPress={() => submit('in')}
              loading={pending === 'in'}
              disabled={pending !== null}
            />
            <Button
              title="Check out"
              variant="danger"
              style={{ flex: 1 }}
              onPress={() => submit('out')}
              loading={pending === 'out'}
              disabled={pending !== null}
            />
          </View>
        </Card>

        <Button title="Scan next item" variant="secondary" onPress={() => router.back()} />
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

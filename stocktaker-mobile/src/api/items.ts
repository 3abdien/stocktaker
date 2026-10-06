// Mirrors stocktaker-api/app/routers/items.py (the part the mobile app uses)
import { apiRequest, toQueryString } from './client'
import type { Item, StockActionRequest, Transaction } from '../types'

/** The core scan lookup. Resolves to null when the barcode isn't known at
 *  any site this user can see - the cue to offer "flag for review". */
export async function findItemByBarcode(barcode: string): Promise<Item | null> {
  const items = await apiRequest<Item[]>(`/items${toQueryString({ barcode })}`)
  return items[0] ?? null
}

export function getItem(id: number): Promise<Item> {
  return apiRequest<Item>(`/items/${id}`)
}

export function checkIn(itemId: number, body: StockActionRequest): Promise<Transaction> {
  return apiRequest<Transaction>(`/items/${itemId}/check-in`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function checkOut(itemId: number, body: StockActionRequest): Promise<Transaction> {
  return apiRequest<Transaction>(`/items/${itemId}/check-out`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

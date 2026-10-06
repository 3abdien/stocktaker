// Mirrors stocktaker-api/app/routers/items.py
import { apiRequest } from './client'
import type { AdjustRequest, Item, ItemCreate, StockActionRequest, Transaction } from '../types'

// A `type` alias here (not `interface`) is deliberate: TypeScript only
// grants an object type an implicit index signature - which
// toQueryString's `Record<string, ...>` parameter needs - when it's
// declared as a type alias. An `interface` with the exact same fields
// would fail that assignment check.
export type ListItemsParams = {
  site_id?: number
  category_id?: number
  barcode?: string
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return ''
  const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))
  return `?${search.toString()}`
}

export function listItems(params: ListItemsParams = {}): Promise<Item[]> {
  return apiRequest<Item[]>(`/items${toQueryString(params)}`)
}

export function getItem(id: number): Promise<Item> {
  return apiRequest<Item>(`/items/${id}`)
}

export function createItem(body: ItemCreate): Promise<Item> {
  return apiRequest<Item>('/items', { method: 'POST', body: JSON.stringify(body) })
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

export function adjustStock(itemId: number, body: AdjustRequest): Promise<Transaction> {
  return apiRequest<Transaction>(`/items/${itemId}/adjust`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** Upload a photo and get back any barcode(s) it contains - the web
 *  dashboard's equivalent of the mobile app's on-device camera scan. */
export function decodePhoto(file: File): Promise<{ data: string; symbology: string }[]> {
  const formData = new FormData()
  formData.append('file', file)
  return apiRequest('/items/decode-photo', { method: 'POST', body: formData })
}

// Mirrors stocktaker-api/app/routers/dashboard.py and transactions.py
import { apiRequest, apiRequestBlob } from './client'
import type { DashboardSummary, Item, Transaction } from '../types'

export function getSummary(siteId?: number): Promise<DashboardSummary> {
  const qs = siteId !== undefined ? `?site_id=${siteId}` : ''
  return apiRequest<DashboardSummary>(`/dashboard/summary${qs}`)
}

export function getLowStock(siteId?: number): Promise<Item[]> {
  const qs = siteId !== undefined ? `?site_id=${siteId}` : ''
  return apiRequest<Item[]>(`/dashboard/low-stock${qs}`)
}

export function listTransactions(params: { item_id?: number; site_id?: number; limit?: number } = {}): Promise<
  Transaction[]
> {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined)
  const qs = entries.length ? `?${new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString()}` : ''
  return apiRequest<Transaction[]>(`/transactions${qs}`)
}

export async function downloadStockCsv(siteId?: number): Promise<void> {
  const qs = siteId !== undefined ? `?site_id=${siteId}` : ''
  const blob = await apiRequestBlob(`/export/stock.csv${qs}`)
  triggerDownload(blob, 'stock.csv')
}

export async function downloadTransactionsCsv(siteId?: number): Promise<void> {
  const qs = siteId !== undefined ? `?site_id=${siteId}` : ''
  const blob = await apiRequestBlob(`/export/transactions.csv${qs}`)
  triggerDownload(blob, 'transactions.csv')
}

/** Browsers can't "save a Blob to disk" directly - the standard trick is
 *  to wrap it in an object URL, point a throwaway <a download> at it, and
 *  click it programmatically. */
function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

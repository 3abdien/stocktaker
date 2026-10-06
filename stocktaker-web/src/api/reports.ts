// Mirrors stocktaker-api/app/routers/reports.py
import { apiRequest, apiRequestBlob } from './client'
import type { Item, ReportRejectRequest, ReportResolveRequest, ReportStatus, UnidentifiedReport } from '../types'

// See the comment on ListItemsParams in api/items.ts for why this is a
// `type` alias rather than an `interface`.
export type ListReportsParams = {
  status?: ReportStatus
  site_id?: number
}

function toQueryString(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined)
  if (entries.length === 0) return ''
  const search = new URLSearchParams(entries.map(([k, v]) => [k, String(v)]))
  return `?${search.toString()}`
}

export function listReports(params: ListReportsParams = {}): Promise<UnidentifiedReport[]> {
  return apiRequest<UnidentifiedReport[]>(`/reports/unidentified${toQueryString(params)}`)
}

export function myReports(): Promise<UnidentifiedReport[]> {
  return apiRequest<UnidentifiedReport[]>('/reports/unidentified/mine')
}

export function resolveReport(reportId: number, body: ReportResolveRequest): Promise<Item> {
  return apiRequest<Item>(`/reports/unidentified/${reportId}/resolve`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function rejectReport(reportId: number, body: ReportRejectRequest): Promise<UnidentifiedReport> {
  return apiRequest<UnidentifiedReport>(`/reports/unidentified/${reportId}/reject`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

/** Fetches a flagged-item photo as a blob so it can be shown in an <img>
 *  via an object URL - see the comment on `photoPath` in client.ts for why
 *  this can't just be an <img src="..."> pointed at the API directly. */
export function fetchReportPhoto(storedName: string): Promise<Blob> {
  return apiRequestBlob(`/photos/${storedName}`)
}
